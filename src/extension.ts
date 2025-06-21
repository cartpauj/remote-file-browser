
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { RemoteFileProvider, RemoteFileItem } from './remoteFileProvider';
import { ConnectionManager } from './connectionManager';
import { ConnectionManagerView } from './connectionManagerView';
import { CredentialManager } from './credentialManager';
import { WelcomeViewProvider } from './welcomeViewProvider';

let remoteFileProvider: RemoteFileProvider;
let connectionManager: ConnectionManager;
let connectionManagerView: ConnectionManagerView;
let credentialManager: CredentialManager;
let welcomeViewProvider: WelcomeViewProvider;

export function getConnectionManager(): ConnectionManager {
    return connectionManager;
}
let currentSelectedDirectory: RemoteFileItem | undefined;
let treeDataProvider: vscode.TreeView<RemoteFileItem>;
let isAnyConnectionInProgress = false; // Global flag to prevent all connection attempts


// Global file watchers storage with connection tracking
interface FileWatcherInfo {
    disposable: any;
    connectionId: string;
    remotePath: string;
}

declare global {
    var remoteFileWatchers: Map<string, FileWatcherInfo> | undefined;
}

function generateConnectionId(config: any): string {
    return `${config.username}@${config.host}:${config.port}`;
}

export function activate(context: vscode.ExtensionContext) {

    connectionManager = new ConnectionManager();
    remoteFileProvider = new RemoteFileProvider(connectionManager);
    connectionManagerView = new ConnectionManagerView(context);
    credentialManager = new CredentialManager(context);
    welcomeViewProvider = new WelcomeViewProvider(context);
    
    // Set the welcome view provider on the connection manager for updates
    connectionManagerView.setWelcomeViewProvider(welcomeViewProvider);
    
    // Set up connection status manager between connection manager and connection manager view
    connectionManager.setStatusManager(connectionManagerView.getConnectionStatusManager());


    treeDataProvider = vscode.window.createTreeView('remoteFilesList', {
        treeDataProvider: remoteFileProvider,
        showCollapseAll: true
    });

    // Track selection changes in the remote file tree
    treeDataProvider.onDidChangeSelection(event => {
        if (event.selection.length > 0) {
            const selectedItem = event.selection[0];
            // Store the selected directory (or parent if a file is selected)
            if (selectedItem.isDirectory) {
                currentSelectedDirectory = selectedItem;
            } else {
                // For files, get the parent directory
                const parentPath = path.dirname(selectedItem.path);
                // Ensure root directory is properly formatted as '/' not empty string
                const normalizedParentPath = parentPath === '/' || parentPath === '' ? '/' : parentPath;
                currentSelectedDirectory = {
                    label: normalizedParentPath === '/' ? '/' : path.basename(normalizedParentPath),
                    path: normalizedParentPath,
                    isDirectory: true,
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded
                } as RemoteFileItem;
            }
        }
    });

    const welcomeView = vscode.window.createTreeView('remoteFilesWelcome', {
        treeDataProvider: welcomeViewProvider,
        showCollapseAll: false
    });


    // Register dynamic commands for each connection (up to 20 connections)
    for (let i = 0; i < 20; i++) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`remoteFileBrowser.connectFromWelcome.${i}`, async () => {
                // GLOBAL LOCK: If any connection is in progress, ignore all clicks
                if (isAnyConnectionInProgress) {
                    return;
                }
                
                // Set global lock
                isAnyConnectionInProgress = true;
                welcomeViewProvider.setConnecting(i, true);
                
                try {
                    await connectToSavedConnection(i);
                } finally {
                    welcomeViewProvider.setConnecting(i, false);
                    isAnyConnectionInProgress = false; // Release global lock
                }
            })
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('remoteFileBrowser.connect', async () => {
            await connectToRemoteServer();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.connectFromConfig', async () => {
            await connectFromConfig();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.manageConnections', () => {
            connectionManagerView.show();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.disconnect', async () => {
            await disconnectFromRemoteServer();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.refresh', () => {
            remoteFileProvider.refresh();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.openFile', async (item) => {
            await openRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.connectDirect', async (connectionConfig, connectionIndex) => {
            await connectDirect(connectionConfig, connectionIndex);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.cleanupTempFiles', async () => {
            await cleanupCurrentConnectionTempFiles();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.cleanupAllTempFiles', async () => {
            await cleanupAllTempFiles();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.pushToRemote', async (resourceUri) => {
            await pushToRemote(resourceUri);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.navigateToParent', () => {
            remoteFileProvider.navigateToParent();
            
            // Force refresh with delay to ensure the tree updates
            setTimeout(() => {
                remoteFileProvider.refresh();
                updateNavigationContext();
            }, 50);
        }),


        vscode.commands.registerCommand('remoteFileBrowser.connectFromWelcome', async (connectionIndex) => {
            const index = typeof connectionIndex === 'string' ? parseInt(connectionIndex, 10) : connectionIndex;
            welcomeViewProvider.setConnecting(index, true);
            try {
                await connectToSavedConnection(index);
            } finally {
                welcomeViewProvider.setConnecting(index, false);
            }
        }),

        vscode.commands.registerCommand('remoteFileBrowser.deleteFile', async (item) => {
            await deleteRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.renameFile', async (item) => {
            await renameRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.moveFile', async (item) => {
            await moveRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.copyFile', async (item) => {
            await copyRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.downloadFile', async (item) => {
            await openRemoteFile(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.editConnectionFromWelcome', async (item) => {
            await editConnectionFromWelcome(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.deleteConnectionFromWelcome', async (item) => {
            await deleteConnectionFromWelcome(item);
        }),

        vscode.commands.registerCommand('remoteFileBrowser.addNewConnectionFromWelcome', async () => {
            await addNewConnectionFromWelcome();
        }),

        vscode.commands.registerCommand('remoteFileBrowser.openUserManual', async () => {
            await openUserManual(context);
        }),

        treeDataProvider,
        welcomeView
    );
}

async function connectFromConfig() {
    try {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);

        if (connections.length === 0) {
            const result = await vscode.window.showInformationMessage(
                'No saved connections found. Set them up in Settings.',
                'Open Settings'
            );
            if (result === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'remoteFileBrowser.connections');
            }
            return;
        }

        const items = connections.map((conn, index) => ({
            label: conn.name || `${conn.username}@${conn.host}`,
            description: `${(conn.protocol || 'sftp').toUpperCase()}://${conn.host}:${conn.port || 22}`,
            detail: conn.remotePath || '/',
            index: index
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a saved connection'
        });

        if (!selected) return;

        await connectToSavedConnection(selected.index);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function connectDirect(connectionConfig: any, connectionIndex?: number) {
    try {
        await connectionManager.connect(connectionConfig);
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        // Show success in status bar instead of popup
        connectionManagerView.getConnectionStatusManager().showSuccess(connectionConfig.host);
        
        // Clear connecting state and refresh connection manager
        connectionManagerView.clearConnectingState();
        connectionManagerView.refreshConnections();
        
        // Clear welcome view spinner if connection index is provided
        if (connectionIndex !== undefined && welcomeViewProvider) {
            welcomeViewProvider.setConnecting(connectionIndex, false);
        }
    } catch (error) {
        // Clear connecting state and welcome view spinner on failure
        connectionManagerView.clearConnectingState();
        if (connectionIndex !== undefined && welcomeViewProvider) {
            welcomeViewProvider.setConnecting(connectionIndex, false);
        }
        
        // Simple error handling - let calling function handle retries
        throw error;
    }
}

async function connectToSavedConnection(connectionIndex: number) {
    
    const config = vscode.workspace.getConfiguration('remoteFileBrowser');
    const connections = config.get<any[]>('connections', []);
    
    if (connectionIndex < 0 || connectionIndex >= connections.length) {
        vscode.window.showErrorMessage('Invalid connection selected');
        return;
    }

    const connection = connections[connectionIndex];
    let connectionConfig = { ...connection };
    const connectionId = CredentialManager.generateConnectionId(connection);

    try {

        if (connection.authType?.toLowerCase() === 'key') {
            // SSH key authentication - check for stored passphrase first
            let passphrase = await credentialManager.getPassphrase(connectionId);
            
            if (!passphrase && (connection.passphrase === undefined || connection.passphrase === '')) {
                passphrase = await vscode.window.showInputBox({
                    prompt: `Enter passphrase for SSH key (leave empty if none): ${connection.keyPath}`,
                    password: true,
                    placeHolder: 'Leave empty if key has no passphrase'
                });
                
                if (passphrase !== undefined && passphrase !== '') {
                    // Ask to save passphrase
                    const savePassphrase = await vscode.window.showQuickPick(
                        ['Yes', 'No'], 
                        { placeHolder: 'Save passphrase securely for future connections?' }
                    );
                    
                    if (savePassphrase === 'Yes') {
                        const saved = await credentialManager.storePassphrase(connectionId, passphrase);
                        if (saved) {
                            connectionManagerView.getConnectionStatusManager().showTempMessage('Passphrase saved securely');
                        }
                    }
                }
            }
            
            if (passphrase) {
                connectionConfig.passphrase = passphrase;
            }
        } else {
            // Password authentication - check for stored password first
            let password = await credentialManager.getPassword(connectionId);
            
            if (!password) {
                password = await vscode.window.showInputBox({
                    prompt: `Enter password for ${connection.username}@${connection.host}`,
                    password: true
                });

                if (!password) return;
                
                // Ask to save password
                const savePassword = await vscode.window.showQuickPick(
                    ['Yes', 'No'], 
                    { placeHolder: 'Save password securely for future connections?' }
                );
                
                if (savePassword === 'Yes') {
                    const saved = await credentialManager.storePassword(connectionId, password);
                    if (saved) {
                        connectionManagerView.getConnectionStatusManager().showTempMessage('Password saved securely');
                    }
                }
            }
            
            connectionConfig.password = password;
        }

        await connectionManager.connect(connectionConfig);
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        // Show success in status bar instead of popup
        connectionManagerView.getConnectionStatusManager().showSuccess(connection.host);
        
        // Refresh connection manager to show updated connection state
        connectionManagerView.refreshConnections();
    } catch (error) {
        // Check if this is likely an authentication error
        const errorMessage = error?.toString() || '';
        const isAuthError = errorMessage.toLowerCase().includes('authentication') || 
                          errorMessage.toLowerCase().includes('login') ||
                          errorMessage.toLowerCase().includes('password') ||
                          errorMessage.toLowerCase().includes('credential') ||
                          errorMessage.toLowerCase().includes('unauthorized') ||
                          errorMessage.toLowerCase().includes('access denied') ||
                          errorMessage.toLowerCase().includes('all configured authentication methods failed') ||
                          // Handshake timeouts are often authentication issues with wrong credentials
                          (errorMessage.toLowerCase().includes('handshake') && errorMessage.toLowerCase().includes('timed out'));
        
        if (isAuthError && connectionConfig.authType?.toLowerCase() === 'password') {
            // Offer to retry with different password
            const choice = await vscode.window.showErrorMessage(
                `Authentication failed: ${errorMessage}`,
                { modal: true },
                'Retry with different password'
            );
            
            if (choice === 'Retry with different password') {
                // Prompt for new password
                const newPassword = await vscode.window.showInputBox({
                    prompt: `Enter password for ${connectionConfig.username}@${connectionConfig.host}`,
                    password: true,
                    placeHolder: 'Enter a different password'
                });
                
                if (newPassword) {
                    // Ask if they want to save the new password
                    const saveChoice = await vscode.window.showQuickPick(
                        ['Yes', 'No'], 
                        { placeHolder: 'Save this password securely for future connections?' }
                    );
                    
                    if (saveChoice === 'Yes') {
                        const connectionId = CredentialManager.generateConnectionId(connectionConfig);
                        await credentialManager.storePassword(connectionId, newPassword);
                    }
                    
                    // Retry connection with new password
                    connectionConfig.password = newPassword;
                    return await connectDirect(connectionConfig);
                }
            }
            // User chose cancel or didn't provide password - don't show additional error
            return;
        }
        
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function connectToRemoteServer() {
    try {
        const protocol = await vscode.window.showQuickPick(['SFTP', 'FTP'], {
            placeHolder: 'Select protocol'
        });

        if (!protocol) return;

        const host = await vscode.window.showInputBox({
            prompt: 'Enter hostname or IP address',
            placeHolder: 'example.com'
        });

        if (!host) return;

        const port = await vscode.window.showInputBox({
            prompt: 'Enter port (default: 22 for SFTP, 21 for FTP)',
            placeHolder: protocol === 'SFTP' ? '22' : '21'
        });

        const username = await vscode.window.showInputBox({
            prompt: 'Enter username',
            placeHolder: 'username'
        });

        if (!username) return;

        const password = await vscode.window.showInputBox({
            prompt: 'Enter password',
            password: true
        });

        if (!password) return;

        const remotePath = await vscode.window.showInputBox({
            prompt: 'Enter remote path (default: /)',
            placeHolder: '/'
        });

        const config = {
            protocol: protocol.toLowerCase() as 'sftp' | 'ftp',
            host,
            port: parseInt(port || (protocol === 'SFTP' ? '22' : '21')),
            username,
            password,
            remotePath: remotePath || '/'
        };

        await connectionManager.connect(config);
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        // Show success in status bar instead of popup
        connectionManagerView.getConnectionStatusManager().showSuccess(host);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function disconnectFromRemoteServer() {
    try {
        // Check if there are active operations
        if (connectionManager.hasActiveOperations()) {
            const activeOps = connectionManager.getActiveOperations();
            const hasFileOperations = activeOps.some(op => 
                op.includes('writing') || op.includes('deleting') || op.includes('renaming') || op.includes('copying')
            );
            
            let message = `Remote operations are still in progress: ${activeOps.join(', ')}.`;
            if (hasFileOperations) {
                message += ' Force disconnecting during file operations may cause data corruption.';
            }
            
            const choice = await vscode.window.showWarningMessage(
                message,
                { modal: true },
                'Wait for Operations',
                'Force Disconnect'
            );
            
            if (choice === 'Wait for Operations') {
                return; // Cancel disconnect
            }
            // If 'Force Disconnect', continue with disconnect and clear operations
        }
        
        await connectionManager.disconnect();
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', false);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        // Hide status bar completely to clear disconnect button
        connectionManagerView.getConnectionStatusManager().hide();
        
        // Refresh connection manager to show updated connection state
        connectionManagerView.refreshConnections();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
    }
}


function sanitizeFileName(name: string): string {
    const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    // Replace unsafe characters with safe alternatives
    let sanitized = name
        .replace(/[@]/g, '-at-')
        .replace(/[:/\\]/g, '-')
        .replace(/[<>:"|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.')
        .replace(/^[.-]/, '_')
        .substring(0, 50); // Limit length
    
    // Check for Windows reserved names
    if (process.platform === 'win32' && windowsReserved.includes(sanitized.toUpperCase())) {
        sanitized = `_${sanitized}`;
    }
    
    return sanitized;
}

function getConnectionTempDir(): string {
    const connectionInfo = connectionManager.getConnectionInfo();
    const tempDir = os.tmpdir();
    
    if (!connectionInfo) {
        return path.join(tempDir, 'remote-file-browser', 'unknown');
    }
    
    const sanitizedName = sanitizeFileName(`${connectionInfo.username}-${connectionInfo.host}-${connectionInfo.port}`);
    return path.join(tempDir, 'remote-file-browser', sanitizedName);
}

async function openRemoteFile(item: any) {
    try {
        if (item.isDirectory) {
            return;
        }

        // Create connection-specific directory structure
        const connectionDir = getConnectionTempDir();
        const remotePath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
        const localPath = remotePath.replace(/\/+/g, path.sep); // Use OS-specific separator
        const tempFilePath = path.join(connectionDir, localPath);
        const tempUri = vscode.Uri.file(tempFilePath);
        
        // Ensure directory exists
        const tempDir = path.dirname(tempFilePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(tempDir));
        
        // Check if temp file already exists
        let shouldDownload = true;
        try {
            await vscode.workspace.fs.stat(tempUri);
            
            // File exists, ask user what to do
            const fileName = path.basename(item.path);
            const choice = await vscode.window.showQuickPick([
                { label: 'Override with fresh copy from server', value: 'override' },
                { label: 'Open existing local copy', value: 'existing' },
                { label: 'Cancel', value: 'cancel' }
            ], {
                placeHolder: `Temporary file for "${fileName}" already exists. What would you like to do?`
            });
            
            if (!choice || choice.value === 'cancel') {
                return;
            }
            
            shouldDownload = choice.value === 'override';
        } catch {
            // File doesn't exist, proceed with download
        }
        
        if (shouldDownload) {
            const content = await connectionManager.readFile(item.path);
            await vscode.workspace.fs.writeFile(tempUri, Buffer.from(content));
        }
        
        const document = await vscode.workspace.openTextDocument(tempUri);
        await vscode.window.showTextDocument(document, { preview: false });

        // Get current connection info for this file
        const currentConnection = connectionManager.getConnectionInfo();
        if (!currentConnection) {
            throw new Error('No active connection');
        }
        const fileConnectionId = generateConnectionId(currentConnection);

        const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc.uri.toString() === tempUri.toString()) {
                try {
                    // Validate that we're still connected to the same server
                    const activeConnection = connectionManager.getConnectionInfo();
                    if (!activeConnection) {
                        vscode.window.showErrorMessage(`Cannot save ${path.basename(item.path)} - no active connection. Please reconnect to the server.`);
                        return;
                    }

                    const activeConnectionId = generateConnectionId(activeConnection);
                    if (activeConnectionId !== fileConnectionId) {
                        const fileName = path.basename(item.path);
                        vscode.window.showErrorMessage(
                            `Cannot save ${fileName} - file belongs to ${fileConnectionId} but you're connected to ${activeConnectionId}. ` +
                            `Disconnect and reconnect to the original server to save changes.`
                        );
                        return;
                    }

                    const updatedContent = savedDoc.getText();
                    await connectionManager.writeFile(item.path, updatedContent);
                    const fileName = path.basename(item.path);
                    connectionManagerView.getConnectionStatusManager().showTempMessage(`Uploaded ${fileName}`);
                } catch (error) {
                    const errorMessage = getUserFriendlyErrorMessage(error, 'save file');
                    vscode.window.showErrorMessage(errorMessage);
                }
            }
        });

        // Store disposable with connection metadata for cleanup command
        if (!global.remoteFileWatchers) {
            global.remoteFileWatchers = new Map();
        }
        
        // Only store valid disposables
        if (disposable && typeof disposable.dispose === 'function') {
            global.remoteFileWatchers.set(tempUri.toString(), {
                disposable: disposable,
                connectionId: fileConnectionId,
                remotePath: item.path
            });
        } else {
        }
        
    } catch (error) {
        let errorMessage: string;
        
        // Handle specific TypeError for .once function issues
        if (error instanceof TypeError && error.message.includes('once is not a function')) {
            errorMessage = `Failed to open file: Connection issue detected. Please disconnect and reconnect to the server, then try again.`;
        } else {
            errorMessage = getUserFriendlyErrorMessage(error, 'open file');
        }
        
        vscode.window.showErrorMessage(errorMessage);
    }
}

async function cleanupCurrentConnectionTempFiles() {
    try {
        if (!connectionManager.isConnected()) {
            vscode.window.showWarningMessage('No active connection. Cannot clean up temp files.');
            return;
        }

        const connectionInfo = connectionManager.getConnectionInfo();
        if (!connectionInfo) {
            vscode.window.showWarningMessage('No connection information available.');
            return;
        }

        const connectionId = generateConnectionId(connectionInfo);
        const choice = await vscode.window.showWarningMessage(
            `This will delete temporary files for the current connection (${connectionId}). Any open files from this server may no longer sync when saved. Continue?`,
            { modal: true },
            'Delete Connection Temp Files'
        );
        
        if (choice !== 'Delete Connection Temp Files') {
            return;
        }

        // Clean up file watchers for this connection only
        if (global.remoteFileWatchers) {
            const toRemove: string[] = [];
            for (const [key, watcherInfo] of global.remoteFileWatchers.entries()) {
                if (watcherInfo.connectionId === connectionId) {
                    try {
                        if (watcherInfo && watcherInfo.disposable && typeof watcherInfo.disposable.dispose === 'function') {
                            watcherInfo.disposable.dispose();
                        }
                        toRemove.push(key);
                    } catch (error) {
                    }
                }
            }
            toRemove.forEach(key => global.remoteFileWatchers?.delete(key));
        }
        
        // Delete only the current connection's temp directory
        const connectionTempDir = vscode.Uri.file(getConnectionTempDir());
        let deletedCount = 0;
        
        try {
            // Check if connection directory exists first
            try {
                await vscode.workspace.fs.stat(connectionTempDir);
                
                // Recursively count and delete files for this connection only
                async function countAndDeleteDir(dirUri: vscode.Uri): Promise<number> {
                    let count = 0;
                    try {
                        const items = await vscode.workspace.fs.readDirectory(dirUri);
                        for (const [name, type] of items) {
                            const itemUri = vscode.Uri.joinPath(dirUri, name);
                            if (type === vscode.FileType.Directory) {
                                count += await countAndDeleteDir(itemUri);
                            } else {
                                await vscode.workspace.fs.delete(itemUri);
                                count++;
                            }
                        }
                        await vscode.workspace.fs.delete(dirUri);
                    } catch (error) {
                    }
                    return count;
                }
                
                deletedCount = await countAndDeleteDir(connectionTempDir);
                
            } catch (statError) {
            }
            
            if (deletedCount > 0) {
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Deleted ${deletedCount} temp files`);
            } else {
                connectionManagerView.getConnectionStatusManager().showTempMessage('No temp files found');
            }
            
        } catch (error) {
                vscode.window.showErrorMessage(`Failed to clean up temporary files: ${error}`);
        }
        
    } catch (error) {
            vscode.window.showErrorMessage(`Failed to clean up temporary files: ${error}`);
    }
}

async function cleanupAllTempFiles() {
    try {
        const choice = await vscode.window.showWarningMessage(
            'This will delete ALL temporary files from ALL connections created by Remote File Browser. Any open files may no longer sync when saved. Continue?',
            { modal: true },
            'Delete All Temp Files'
        );
        
        if (choice !== 'Delete All Temp Files') {
            return;
        }
        
        // Clean up file watchers first
        if (global.remoteFileWatchers) {
            for (const watcherInfo of global.remoteFileWatchers.values()) {
                try {
                    if (watcherInfo && watcherInfo.disposable && typeof watcherInfo.disposable.dispose === 'function') {
                        watcherInfo.disposable.dispose();
                    }
                } catch (error) {
                }
            }
            global.remoteFileWatchers.clear();
        }
        
        // Delete the entire remote-file-browser directory using VSCode filesystem API
        const tempDir = os.tmpdir();
        const remoteBrowserDir = vscode.Uri.file(path.join(tempDir, 'remote-file-browser'));
        let deletedCount = 0;
        
        try {
            // Check if directory exists first
            try {
                await vscode.workspace.fs.stat(remoteBrowserDir);
                
                // Recursively count and delete files using VSCode API
                async function countAndDeleteDir(dirUri: vscode.Uri): Promise<number> {
                    let count = 0;
                    try {
                        const items = await vscode.workspace.fs.readDirectory(dirUri);
                        for (const [name, type] of items) {
                            const itemUri = vscode.Uri.joinPath(dirUri, name);
                            if (type === vscode.FileType.Directory) {
                                count += await countAndDeleteDir(itemUri);
                            } else {
                                await vscode.workspace.fs.delete(itemUri);
                                count++;
                            }
                        }
                        await vscode.workspace.fs.delete(dirUri);
                    } catch (error) {
                    }
                    return count;
                }
                
                deletedCount = await countAndDeleteDir(remoteBrowserDir);
            } catch {
                // Directory doesn't exist, nothing to clean
            }
            
        } catch (error) {
        }
        
        connectionManagerView.getConnectionStatusManager().showTempMessage(`Cleaned up ${deletedCount} temp files`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to cleanup temp files: ${error}`);
    }
}

function updateNavigationContext() {
    const canNavigateUp = connectionManager.isConnected() && remoteFileProvider.canNavigateToParent();
    vscode.commands.executeCommand('setContext', 'remoteFileBrowser.canNavigateUp', canNavigateUp);
}


async function pushToRemote(resourceUri: vscode.Uri) {
    try {
        // Check if connected to remote server
        if (!connectionManager.isConnected()) {
            vscode.window.showErrorMessage('Not connected to remote server. Please connect first.');
            return;
        }

        // Get the local file path
        const localFilePath = resourceUri.fsPath;
        const fileName = path.basename(localFilePath);

        // Check if local file exists
        if (!fs.existsSync(localFilePath)) {
            vscode.window.showErrorMessage(`Local file not found: ${fileName}`);
            return;
        }

        // Check if this is a temp file from the remote file browser
        const tempDir = os.tmpdir();
        const remoteBrowserTempDir = path.join(tempDir, 'remote-file-browser');
        const isTemporaryFile = localFilePath.startsWith(remoteBrowserTempDir);
        
        let remotePath: string;
        
        if (isTemporaryFile) {
            // This is a temp file - give user choice between original location and current selection
            const fileUri = resourceUri.toString();
            const watcherInfo = global.remoteFileWatchers?.get(fileUri);
            
            if (watcherInfo && watcherInfo.remotePath) {
                // Show choice dialog
                const choice = await vscode.window.showQuickPick([
                    {
                        label: 'Original Location',
                        description: `Upload to: ${watcherInfo.remotePath}`,
                        detail: 'Upload to the location where this file was originally downloaded from'
                    },
                    {
                        label: 'Current Location', 
                        description: `Upload to: ${(() => {
                            const targetPath = currentSelectedDirectory?.path || connectionManager.getRemotePath();
                            return targetPath === '/' ? `/${fileName}` : `${targetPath}/${fileName}`;
                        })()}`,
                        detail: 'Upload to the currently selected directory in the remote file tree'
                    }
                ], {
                    placeHolder: 'Choose upload destination for temporary file',
                    ignoreFocusOut: true
                });
                
                if (!choice) {
                    return; // User cancelled
                }
                
                if (choice.label === 'Original Location') {
                    remotePath = watcherInfo.remotePath;
                } else {
                    // Use current selection
                    const targetDirectory = currentSelectedDirectory || {
                        path: connectionManager.getRemotePath(),
                        isDirectory: true
                    };
                    remotePath = targetDirectory.path === '/' 
                        ? `/${fileName}` 
                        : `${targetDirectory.path}/${fileName}`;
                }
            } else {
                // Temp file but no watcher info - treat as regular file
                const targetDirectory = currentSelectedDirectory || {
                    path: connectionManager.getRemotePath(),
                    isDirectory: true
                };
                remotePath = targetDirectory.path === '/' 
                    ? `/${fileName}` 
                    : `${targetDirectory.path}/${fileName}`;
            }
        } else {
            // Regular local file - use current selection
            const targetDirectory = currentSelectedDirectory || {
                path: connectionManager.getRemotePath(),
                isDirectory: true
            };
            remotePath = targetDirectory.path === '/' 
                ? `/${fileName}` 
                : `${targetDirectory.path}/${fileName}`;
        }

        // Read the local file content
        const fileContent = fs.readFileSync(localFilePath, 'utf8');
            
        // Debug logging to understand what paths are being used
        console.log(`Push to Remote Debug:
            Local file: ${localFilePath}
            File name only: ${fileName}
            Is temporary file: ${isTemporaryFile}
            Final remote path: ${remotePath}`);

        // Show progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Pushing ${fileName} to remote server...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                // Upload the file to the remote server
                await connectionManager.writeFile(remotePath, fileContent);
                
                progress.report({ increment: 100 });
                
                // Show success message
                const targetPath = path.dirname(remotePath);
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Pushed ${fileName}`);

                // Refresh the remote file tree to show the new file
                remoteFileProvider.refresh();

            } catch (uploadError) {
                throw new Error(`Upload failed: ${uploadError}`);
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to push file to remote: ${error}`);
    }
}

function getUserFriendlyErrorMessage(error: any, operation: string): string {
    const errorMessage = error?.message || error?.toString() || '';
    
    // Connection lost errors (SFTP and FTP)
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('Connection lost') || 
        errorMessage.includes('Connection closed') ||
        errorMessage.includes('Control socket closed') ||
        errorMessage.includes('Server closed connection') ||
        errorMessage.includes('Connection interrupted')) {
        return `Connection to server was lost while trying to ${operation}. The connection has been automatically restored. Please try again.`;
    } 
    // Timeout errors (SFTP and FTP)
    else if (errorMessage.includes('ETIMEDOUT') || 
             errorMessage.includes('Connection timeout') ||
             errorMessage.includes('Data connection timeout') ||
             errorMessage.includes('Transfer timeout') ||
             errorMessage.includes('PASV timeout') ||
             errorMessage.includes('LIST timeout')) {
        return `Connection timed out while trying to ${operation}. Please check your network connection and try again.`;
    } 
    // Connection refused errors
    else if (errorMessage.includes('ECONNREFUSED') ||
             errorMessage.includes('Passive connection failed')) {
        return `Connection refused while trying to ${operation}. Please check if the server is running and accessible.`;
    } 
    // Authentication errors
    else if (errorMessage.includes('Authentication failed') || 
             errorMessage.includes('Permission denied') ||
             errorMessage.includes('All configured authentication methods failed')) {
        return `Authentication failed while trying to ${operation}. Please check your credentials.`;
    } 
    // File not found errors
    else if (errorMessage.includes('No such file') || 
             errorMessage.includes('ENOENT')) {
        return `File or directory not found while trying to ${operation}. It may have been moved or deleted.`;
    } 
    // Network unreachable errors
    else if (errorMessage.includes('EHOSTUNREACH') ||
             errorMessage.includes('ENETUNREACH') ||
             errorMessage.includes('ENOTFOUND')) {
        return `Cannot reach server while trying to ${operation}. Please check your network connection and server address.`;
    } 
    else {
        return `Failed to ${operation}: ${errorMessage}`;
    }
}

async function deleteRemoteFile(item: any) {
    try {
        if (!connectionManager.isConnected()) {
            vscode.window.showErrorMessage('Not connected to remote server.');
            return;
        }

        const itemType = item.isDirectory ? 'directory' : 'file';
        const itemName = item.label;
        
        // Show confirmation dialog
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the ${itemType} "${itemName}"?${item.isDirectory ? ' This will delete all contents recursively.' : ''}`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (result !== 'Delete') {
            return;
        }

        // Show progress for the deletion
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Deleting ${itemType} "${itemName}"...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                await connectionManager.deleteFile(item.path, item.isDirectory);
                progress.report({ increment: 100 });
                
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Deleted ${itemName}`);
                
                // Refresh the remote file tree
                remoteFileProvider.refresh();
                
            } catch (deleteError) {
                throw new Error(`Delete failed: ${deleteError}`);
            }
        });

    } catch (error) {
        const itemType = item.isDirectory ? 'directory' : 'file';
        const errorMessage = getUserFriendlyErrorMessage(error, `delete ${itemType}`);
        vscode.window.showErrorMessage(errorMessage);
    }
}

async function renameRemoteFile(item: any) {
    try {
        if (!connectionManager.isConnected()) {
            vscode.window.showErrorMessage('Not connected to remote server.');
            return;
        }

        const itemType = item.isDirectory ? 'directory' : 'file';
        const currentName = item.label;
        
        // Show input box for new name
        const newName = await vscode.window.showInputBox({
            prompt: `Enter new name for ${itemType} "${currentName}"`,
            value: currentName,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'Name cannot contain path separators';
                }
                if (value === currentName) {
                    return 'New name must be different from current name';
                }
                return null;
            }
        });

        if (!newName) {
            return;
        }

        // Calculate the new path
        const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
        const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;

        // Show progress for the rename
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Renaming ${itemType} "${currentName}" to "${newName}"...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                await connectionManager.renameFile(item.path, newPath);
                progress.report({ increment: 100 });
                
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Renamed to ${newName}`);
                
                // Refresh the remote file tree
                remoteFileProvider.refresh();
                
            } catch (renameError) {
                throw new Error(`Rename failed: ${renameError}`);
            }
        });

    } catch (error) {
        const itemType = item.isDirectory ? 'directory' : 'file';
        const errorMessage = getUserFriendlyErrorMessage(error, `rename ${itemType}`);
        vscode.window.showErrorMessage(errorMessage);
    }
}

async function moveRemoteFile(item: any) {
    const itemType = item.isDirectory ? 'directory' : 'file';
    const currentPath = item.path;
    let newPath: string | undefined;
    
    try {
        if (!connectionManager.isConnected()) {
            vscode.window.showErrorMessage('Not connected to remote server.');
            return;
        }
        
        // Show input box for new path, pre-populated with current path
        newPath = await vscode.window.showInputBox({
            prompt: `Enter new path for ${itemType} "${item.label}"`,
            value: currentPath,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Path cannot be empty';
                }
                if (!value.startsWith('/')) {
                    return 'Path must start with /';
                }
                if (value === currentPath) {
                    return 'New path must be different from current path';
                }
                // Prevent moving a directory into itself
                if (item.isDirectory && value.startsWith(currentPath + '/')) {
                    return 'Cannot move directory into itself';
                }
                return null;
            },
            placeHolder: '/path/to/new/location'
        });

        if (!newPath) {
            return;
        }

        // TypeScript assertion since we've already checked for null
        const targetPath: string = newPath;

        // Check if target file already exists
        const targetExists = await connectionManager.fileExists(targetPath);
        if (targetExists) {
            const fileName = path.basename(targetPath);
            const choice = await vscode.window.showWarningMessage(
                `A ${itemType} named "${fileName}" already exists at the target location. What would you like to do?`,
                { modal: true },
                'Overwrite',
                'Cancel'
            );
            
            if (choice !== 'Overwrite') {
                return; // User cancelled
            }
        }

        // Show progress for the move
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Moving ${itemType} "${item.label}"...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                await connectionManager.renameFile(currentPath, targetPath);
                progress.report({ increment: 50 });
                
                // Update temporary file paths if the file is currently open
                await updateTempFileLocation(currentPath, targetPath);
                progress.report({ increment: 100 });
                
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Moved to ${path.basename(targetPath)}`);
                
                // Refresh the remote file tree
                remoteFileProvider.refresh();
                
            } catch (moveError) {
                throw new Error(`Move failed: ${moveError}`);
            }
        });

    } catch (error) {
        const itemType = item.isDirectory ? 'directory' : 'file';
        const errorMessage = getMoveErrorMessage(error, item, newPath, itemType);
        
        // Show error with potential actions
        const errorDetails = getMoveErrorDetails(error, newPath);
        if (errorDetails.showRetry || errorDetails.suggestion) {
            const actions: string[] = [];
            if (errorDetails.showRetry) actions.push('Retry');
            if (errorDetails.suggestion && errorDetails.actionLabel) actions.push(errorDetails.actionLabel);
            
            const result = await vscode.window.showErrorMessage(errorMessage, ...actions);
            
            if (result === 'Retry') {
                // Retry the move operation
                await moveRemoteFile(item);
                return;
            } else if (result === errorDetails.actionLabel && errorDetails.suggestion) {
                vscode.window.showInformationMessage(errorDetails.suggestion);
            }
        } else {
            vscode.window.showErrorMessage(errorMessage);
        }
    }
}

async function updateTempFileLocation(oldPath: string, newPath: string): Promise<void> {
    // Check if this file has a temporary copy that needs to be moved
    if (!global.remoteFileWatchers) {
        return;
    }
    
    for (const [tempUri, watcherInfo] of global.remoteFileWatchers.entries()) {
        if (watcherInfo.remotePath === oldPath) {
            try {
                // Calculate old and new temp file paths
                const connectionInfo = connectionManager.getConnectionInfo();
                if (!connectionInfo) continue;
                
                const tempDir = os.tmpdir();
                const sanitizedName = sanitizeFileName(`${connectionInfo.username}-${connectionInfo.host}-${connectionInfo.port}`);
                const baseTempDir = path.join(tempDir, 'remote-file-browser', sanitizedName);
                
                const oldTempPath = path.join(baseTempDir, oldPath.startsWith('/') ? oldPath.substring(1) : oldPath);
                const newTempPath = path.join(baseTempDir, newPath.startsWith('/') ? newPath.substring(1) : newPath);
                
                // Create new directory structure if needed
                const newTempDir = path.dirname(newTempPath);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(newTempDir));
                
                // Move the temp file
                const oldTempUri = vscode.Uri.file(oldTempPath);
                const newTempUri = vscode.Uri.file(newTempPath);
                
                try {
                    await vscode.workspace.fs.stat(oldTempUri);
                    await vscode.workspace.fs.copy(oldTempUri, newTempUri);
                    await vscode.workspace.fs.delete(oldTempUri);
                    
                    // Update the watcher info
                    global.remoteFileWatchers.delete(tempUri);
                    global.remoteFileWatchers.set(newTempUri.toString(), {
                        ...watcherInfo,
                        remotePath: newPath
                    });
                    
                    // Update editor tab if the file is currently open
                    await updateEditorTab(oldTempUri, newTempUri, newPath);
                    
                } catch (statError) {
                    // Temp file doesn't exist, just update the watcher info
                    global.remoteFileWatchers.delete(tempUri);
                    global.remoteFileWatchers.set(newTempUri.toString(), {
                        ...watcherInfo,
                        remotePath: newPath
                    });
                    
                    // Still try to update editor tab if file is open
                    await updateEditorTab(oldTempUri, newTempUri, newPath);
                }
            } catch (error) {
            }
            break;
        }
    }
}

async function updateEditorTab(oldTempUri: vscode.Uri, newTempUri: vscode.Uri, newRemotePath: string): Promise<void> {
    try {
        // Find if the old file is currently open in any editor
        const openDocument = vscode.workspace.textDocuments.find(doc => 
            doc.uri.toString() === oldTempUri.toString()
        );
        
        if (openDocument) {
            // Find the editor showing this document
            const editor = vscode.window.visibleTextEditors.find(ed => 
                ed.document.uri.toString() === oldTempUri.toString()
            );
            
            if (editor) {
                // Store current selection and view state
                const selection = editor.selection;
                const visibleRanges = editor.visibleRanges;
                
                // Close the old document
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                
                // Small delay to ensure the close operation completes
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Open the new document
                const newDocument = await vscode.workspace.openTextDocument(newTempUri);
                const newEditor = await vscode.window.showTextDocument(newDocument);
                
                // Restore the selection and view state
                newEditor.selection = selection;
                if (visibleRanges.length > 0) {
                    newEditor.revealRange(visibleRanges[0], vscode.TextEditorRevealType.InCenter);
                }
                
                // Show a notification about the tab update
                const fileName = path.basename(newRemotePath);
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Updated tab: ${fileName}`);
                
            }
        }
    } catch (error) {
        // Don't throw error - this is a nice-to-have feature
    }
}

function getMoveErrorMessage(error: any, item: any, newPath: string | undefined, itemType: string): string {
    const errorMessage = error?.message || error?.toString() || '';
    const currentPath = item.path;
    const targetPath = newPath || 'unknown';
    
    // Directory doesn't exist errors
    if (errorMessage.includes('No such file or directory') || 
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('does not exist')) {
        const targetDir = path.dirname(targetPath);
        return `Cannot move ${itemType} to "${targetPath}": Directory "${targetDir}" does not exist.`;
    }
    
    // Permission errors
    if (errorMessage.includes('Permission denied') || 
        errorMessage.includes('EACCES') ||
        errorMessage.includes('Access denied')) {
        return `Cannot move ${itemType} to "${targetPath}": Permission denied. Check that you have write access to the target directory.`;
    }
    
    // File already exists errors
    if (errorMessage.includes('File exists') || 
        errorMessage.includes('EEXIST') ||
        errorMessage.includes('already exists')) {
        return `Cannot move ${itemType} to "${targetPath}": A file or directory with that name already exists.`;
    }
    
    // Disk space errors
    if (errorMessage.includes('No space left') || 
        errorMessage.includes('ENOSPC')) {
        return `Cannot move ${itemType} to "${targetPath}": No space left on device.`;
    }
    
    // Connection errors
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('Connection lost') || 
        errorMessage.includes('Connection closed')) {
        return `Failed to move ${itemType}: Connection to server was lost. The connection has been restored automatically.`;
    }
    
    // Timeout errors
    if (errorMessage.includes('ETIMEDOUT') || 
        errorMessage.includes('timeout')) {
        return `Failed to move ${itemType}: Operation timed out. Please check your network connection.`;
    }
    
    // Cross-device/filesystem errors
    if (errorMessage.includes('Invalid cross-device link') || 
        errorMessage.includes('EXDEV')) {
        return `Cannot move ${itemType} to "${targetPath}": Cannot move across different filesystems or devices.`;
    }
    
    // Generic fallback
    return `Failed to move ${itemType} from "${currentPath}" to "${targetPath}": ${errorMessage}`;
}

function getMoveErrorDetails(error: any, newPath: string | undefined): {
    showRetry: boolean,
    suggestion?: string,
    actionLabel?: string
} {
    const errorMessage = error?.message || error?.toString() || '';
    const targetDir = newPath ? path.dirname(newPath) : '';
    
    // Directory doesn't exist - offer helpful suggestion
    if (errorMessage.includes('No such file or directory') || 
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('does not exist')) {
        return {
            showRetry: false,
            suggestion: `To fix this, first create the directory "${targetDir}" using your server's file manager or terminal, then try moving the file again.`,
            actionLabel: 'How to Fix'
        };
    }
    
    // Permission errors - offer helpful suggestion
    if (errorMessage.includes('Permission denied') || 
        errorMessage.includes('EACCES') ||
        errorMessage.includes('Access denied')) {
        return {
            showRetry: false,
            suggestion: `To fix this, check that you have write permissions for the target directory "${targetDir}". You may need to change permissions using chmod or contact your system administrator.`,
            actionLabel: 'How to Fix'
        };
    }
    
    // File already exists - offer helpful suggestion
    if (errorMessage.includes('File exists') || 
        errorMessage.includes('EEXIST') ||
        errorMessage.includes('already exists')) {
        return {
            showRetry: false,
            suggestion: `A file or directory already exists at "${newPath}". Choose a different name or delete the existing file first.`,
            actionLabel: 'How to Fix'
        };
    }
    
    // Connection errors - offer retry
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('Connection lost') || 
        errorMessage.includes('Connection closed') ||
        errorMessage.includes('ETIMEDOUT') || 
        errorMessage.includes('timeout')) {
        return {
            showRetry: true,
            suggestion: 'This is usually a temporary network issue. The connection has been restored automatically.',
            actionLabel: 'Network Info'
        };
    }
    
    // No special handling needed
    return {
        showRetry: false
    };
}

async function copyRemoteFile(item: any) {
    const itemType = item.isDirectory ? 'directory' : 'file';
    const currentPath = item.path;
    let newPath: string | undefined;
    
    try {
        if (!connectionManager.isConnected()) {
            vscode.window.showErrorMessage('Not connected to remote server.');
            return;
        }
        
        // Show input box for new path, pre-populated with current path
        newPath = await vscode.window.showInputBox({
            prompt: `Enter new path for ${itemType} copy "${item.label}"`,
            value: currentPath,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Path cannot be empty';
                }
                if (!value.startsWith('/')) {
                    return 'Path must start with /';
                }
                if (value === currentPath) {
                    return 'New path must be different from current path';
                }
                // Prevent copying a directory into itself
                if (item.isDirectory && value.startsWith(currentPath + '/')) {
                    return 'Cannot copy directory into itself';
                }
                return null;
            },
            placeHolder: '/path/to/new/copy'
        });

        if (!newPath) {
            return;
        }

        // TypeScript assertion since we've already checked for null
        const targetPath: string = newPath;

        // Check if target file already exists
        const targetExists = await connectionManager.fileExists(targetPath);
        if (targetExists) {
            const fileName = path.basename(targetPath);
            const choice = await vscode.window.showWarningMessage(
                `A ${itemType} named "${fileName}" already exists at the target location. What would you like to do?`,
                { modal: true },
                'Overwrite',
                'Cancel'
            );
            
            if (choice !== 'Overwrite') {
                return; // User cancelled
            }
        }

        // Show progress for the copy
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Copying ${itemType} "${item.label}"...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                await connectionManager.copyFile(currentPath, targetPath, item.isDirectory);
                progress.report({ increment: 80 });
                
                connectionManagerView.getConnectionStatusManager().showTempMessage(`Copied to ${path.basename(targetPath)}`);
                
                // Refresh the remote file tree
                remoteFileProvider.refresh();
                progress.report({ increment: 90 });
                
                // Open the copied file in editor if it's a file (not directory)
                if (!item.isDirectory) {
                    const copiedItem = {
                        path: targetPath,
                        label: path.basename(targetPath),
                        isDirectory: false
                    };
                    await openRemoteFile(copiedItem);
                }
                
                progress.report({ increment: 100 });
                
            } catch (copyError) {
                throw new Error(`Copy failed: ${copyError}`);
            }
        });

    } catch (error) {
        const errorMessage = getCopyErrorMessage(error, item, newPath, itemType);
        
        // Show error with potential actions (reuse move error logic)
        const errorDetails = getMoveErrorDetails(error, newPath);
        if (errorDetails.showRetry || errorDetails.suggestion) {
            const actions: string[] = [];
            if (errorDetails.showRetry) actions.push('Retry');
            if (errorDetails.suggestion && errorDetails.actionLabel) actions.push(errorDetails.actionLabel);
            
            const result = await vscode.window.showErrorMessage(errorMessage, ...actions);
            
            if (result === 'Retry') {
                // Retry the copy operation
                await copyRemoteFile(item);
                return;
            } else if (result === errorDetails.actionLabel && errorDetails.suggestion) {
                vscode.window.showInformationMessage(errorDetails.suggestion);
            }
        } else {
            vscode.window.showErrorMessage(errorMessage);
        }
    }
}

function getCopyErrorMessage(error: any, item: any, newPath: string | undefined, itemType: string): string {
    const errorMessage = error?.message || error?.toString() || '';
    const currentPath = item.path;
    const targetPath = newPath || 'unknown';
    
    // Directory doesn't exist errors
    if (errorMessage.includes('No such file or directory') || 
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('does not exist')) {
        const targetDir = path.dirname(targetPath);
        return `Cannot copy ${itemType} to "${targetPath}": Directory "${targetDir}" does not exist.`;
    }
    
    // Permission errors
    if (errorMessage.includes('Permission denied') || 
        errorMessage.includes('EACCES') ||
        errorMessage.includes('Access denied')) {
        return `Cannot copy ${itemType} to "${targetPath}": Permission denied. Check that you have write access to the target directory.`;
    }
    
    // File already exists errors
    if (errorMessage.includes('File exists') || 
        errorMessage.includes('EEXIST') ||
        errorMessage.includes('already exists')) {
        return `Cannot copy ${itemType} to "${targetPath}": A file or directory with that name already exists.`;
    }
    
    // Disk space errors
    if (errorMessage.includes('No space left') || 
        errorMessage.includes('ENOSPC')) {
        return `Cannot copy ${itemType} to "${targetPath}": No space left on device.`;
    }
    
    // Connection errors
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('Connection lost') || 
        errorMessage.includes('Connection closed')) {
        return `Failed to copy ${itemType}: Connection to server was lost. The connection has been restored automatically.`;
    }
    
    // Timeout errors
    if (errorMessage.includes('ETIMEDOUT') || 
        errorMessage.includes('timeout')) {
        return `Failed to copy ${itemType}: Operation timed out. Please check your network connection.`;
    }
    
    // Cross-device/filesystem errors
    if (errorMessage.includes('Invalid cross-device link') || 
        errorMessage.includes('EXDEV')) {
        return `Cannot copy ${itemType} to "${targetPath}": Cannot copy across different filesystems or devices.`;
    }
    
    // Generic fallback
    return `Failed to copy ${itemType} from "${currentPath}" to "${targetPath}": ${errorMessage}`;
}

async function editConnectionFromWelcome(item: any) {
    try {
        // Extract connection index from the tree item
        let connectionIndex: number | undefined;
        
        // Method 1: From tree item ID
        if (item.id && item.id.startsWith('connection-')) {
            connectionIndex = parseInt(item.id.replace('connection-', ''), 10);
        }
        // Method 2: From command arguments in tree item
        else if (item.command?.command) {
            const match = item.command.command.match(/remoteFileBrowser\.connectFromWelcome\.(\d+)/);
            if (match) {
                connectionIndex = parseInt(match[1], 10);
            }
        }
        // Method 3: From connectionIndex property
        else if (item.connectionIndex !== undefined) {
            connectionIndex = item.connectionIndex;
        }
        
        if (connectionIndex === undefined || isNaN(connectionIndex)) {
            vscode.window.showErrorMessage('Unable to identify connection');
            return;
        }
        
        // Show the connection manager and pass the edit index
        connectionManagerView.showWithEdit(connectionIndex);
        
    } catch (error) {
        vscode.window.showErrorMessage('Failed to edit connection');
    }
}

async function deleteConnectionFromWelcome(item: any) {
    try {
        // Extract connection index from the tree item
        let connectionIndex: number | undefined;
        
        // Method 1: From tree item ID
        if (item.id && item.id.startsWith('connection-')) {
            connectionIndex = parseInt(item.id.replace('connection-', ''), 10);
        }
        // Method 2: From command arguments in tree item
        else if (item.command?.command) {
            const match = item.command.command.match(/remoteFileBrowser\.connectFromWelcome\.(\d+)/);
            if (match) {
                connectionIndex = parseInt(match[1], 10);
            }
        }
        // Method 3: From connectionIndex property
        else if (item.connectionIndex !== undefined) {
            connectionIndex = item.connectionIndex;
        }
        
        if (connectionIndex === undefined || isNaN(connectionIndex)) {
            vscode.window.showErrorMessage('Unable to identify connection');
            return;
        }
        
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        if (connectionIndex < 0 || connectionIndex >= connections.length) {
            vscode.window.showErrorMessage('Connection not found');
            return;
        }
        
        const connection = connections[connectionIndex];
        const connectionName = connection.name || `${connection.username}@${connection.host}`;
        
        // Show confirmation dialog
        const confirmed = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the connection "${connectionName}"?`,
            { modal: true },
            'Delete'
        );
        
        if (confirmed === 'Delete') {
            const connectionId = `${connection.host}:${connection.port}:${connection.username}`;
            
            // Clean up stored credentials
            await credentialManager.deleteCredentials(connectionId);
            
            connections.splice(connectionIndex, 1);
            await config.update('connections', connections, vscode.ConfigurationTarget.Global);
            connectionManagerView.getConnectionStatusManager().showTempMessage('Connection deleted');
            welcomeViewProvider.refresh();
        }
        
    } catch (error) {
        vscode.window.showErrorMessage('Failed to delete connection');
    }
}

async function addNewConnectionFromWelcome() {
    try {
        // Show the connection manager and trigger add new connection mode
        connectionManagerView.showWithAddNew();
    } catch (error) {
        vscode.window.showErrorMessage('Failed to open add new connection');
    }
}

async function openUserManual(context: vscode.ExtensionContext) {
    try {
        // Get the path to the extension's README.md file
        const readmePath = vscode.Uri.joinPath(context.extensionUri, 'readme.md');
        
        // Open the README.md file using markdown preview (truly read-only)
        await vscode.commands.executeCommand('markdown.showPreview', readmePath);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to open user manual');
    }
}

export function deactivate() {
    if (connectionManager) {
        connectionManager.disconnect();
    }
    
    // Clean up connection status manager
    if (connectionManagerView) {
        connectionManagerView.getConnectionStatusManager().dispose();
    }
    
    // Clean up file watchers on deactivation
    if (global.remoteFileWatchers) {
        for (const watcherInfo of global.remoteFileWatchers.values()) {
            try {
                if (watcherInfo && watcherInfo.disposable && typeof watcherInfo.disposable.dispose === 'function') {
                    watcherInfo.disposable.dispose();
                }
            } catch (error) {
            }
        }
        global.remoteFileWatchers.clear();
    }
}
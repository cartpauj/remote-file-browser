
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
    console.log('Remote File Browser extension is now active');

    connectionManager = new ConnectionManager();
    remoteFileProvider = new RemoteFileProvider(connectionManager);
    connectionManagerView = new ConnectionManagerView(context);
    credentialManager = new CredentialManager(context);
    welcomeViewProvider = new WelcomeViewProvider(context);
    
    // Set the welcome view provider on the connection manager for updates
    connectionManagerView.setWelcomeViewProvider(welcomeViewProvider);

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
                // For files, we could potentially get the parent directory
                // For now, we'll keep the last selected directory
            }
        }
    });

    const welcomeView = vscode.window.createTreeView('remoteFilesWelcome', {
        treeDataProvider: welcomeViewProvider,
        showCollapseAll: false
    });

    console.log('Remote File Browser extension: Views and commands registered successfully');

    // Register dynamic commands for each connection (up to 20 connections)
    for (let i = 0; i < 20; i++) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`remoteFileBrowser.connectFromWelcome.${i}`, async () => {
                // GLOBAL LOCK: If any connection is in progress, ignore all clicks
                if (isAnyConnectionInProgress) {
                    console.log(`Connection attempt ignored for index ${i} - another connection already in progress`);
                    return;
                }
                
                // Set global lock
                isAnyConnectionInProgress = true;
                console.log('Starting connection to index:', i);
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

        vscode.commands.registerCommand('remoteFileBrowser.connectDirect', async (connectionConfig) => {
            await connectDirect(connectionConfig);
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

async function connectDirect(connectionConfig: any) {
    try {
        await connectionManager.connect(connectionConfig);
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        vscode.window.showInformationMessage(`Connected to ${connectionConfig.host} via ${(connectionConfig.protocol || 'SFTP').toUpperCase()}`);
    } catch (error) {
        // Simple error handling - let calling function handle retries
        throw error;
    }
}

async function connectToSavedConnection(connectionIndex: number) {
    console.log('[Extension] Connecting to saved connection...');
    
    const config = vscode.workspace.getConfiguration('remoteFileBrowser');
    const connections = config.get<any[]>('connections', []);
    
    if (connectionIndex < 0 || connectionIndex >= connections.length) {
        console.error(`[Extension] Invalid connection index: ${connectionIndex}`);
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
                            vscode.window.showInformationMessage('Passphrase saved securely');
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
                        vscode.window.showInformationMessage('Password saved securely');
                    }
                }
            }
            
            connectionConfig.password = password;
        }

        console.log('[Extension] Connecting...');
        await connectionManager.connect(connectionConfig);
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        vscode.window.showInformationMessage(`Connected to ${connection.host} via ${(connection.protocol || 'SFTP').toUpperCase()}`);
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
        
        vscode.window.showInformationMessage(`Connected to ${host} via ${protocol}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function disconnectFromRemoteServer() {
    try {
        await connectionManager.disconnect();
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', false);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        vscode.window.showInformationMessage('Disconnected from remote server');
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
                    vscode.window.showInformationMessage(`Uploaded ${fileName} to remote server`);
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
            console.warn('File watcher disposable is invalid, skipping storage');
        }
        
    } catch (error) {
        let errorMessage: string;
        
        // Handle specific TypeError for .once function issues
        if (error instanceof TypeError && error.message.includes('once is not a function')) {
            errorMessage = `Failed to open file: Connection issue detected. Please disconnect and reconnect to the server, then try again.`;
            console.error('File opening failed with .once error:', error);
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
                        console.warn('Failed to dispose file watcher:', error);
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
                        console.warn(`Failed to delete directory ${dirUri.fsPath}:`, error);
                    }
                    return count;
                }
                
                deletedCount = await countAndDeleteDir(connectionTempDir);
                
            } catch (statError) {
                // Directory doesn't exist, which is fine
                console.log('Connection temp directory does not exist:', connectionTempDir.fsPath);
            }
            
            if (deletedCount > 0) {
                vscode.window.showInformationMessage(`Deleted ${deletedCount} temporary files for connection: ${connectionId}`);
            } else {
                vscode.window.showInformationMessage(`No temporary files found for connection: ${connectionId}`);
            }
            
        } catch (error) {
            console.error('Error cleaning up connection temp files:', error);
            vscode.window.showErrorMessage(`Failed to clean up temporary files: ${error}`);
        }
        
    } catch (error) {
        console.error('Error in cleanupCurrentConnectionTempFiles:', error);
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
                    console.warn('Failed to dispose file watcher:', error);
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
                        console.error(`Failed to process directory ${dirUri.fsPath}:`, error);
                    }
                    return count;
                }
                
                deletedCount = await countAndDeleteDir(remoteBrowserDir);
            } catch {
                // Directory doesn't exist, nothing to clean
            }
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        
        vscode.window.showInformationMessage(`Cleaned up ${deletedCount} temporary file(s)`);
        
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

        // Use selected directory or fall back to root directory if none selected
        const targetDirectory = currentSelectedDirectory || {
            path: connectionManager.getRemotePath(),
            isDirectory: true
        };

        // Get the local file path
        const localFilePath = resourceUri.fsPath;
        const fileName = path.basename(localFilePath);

        // Check if local file exists
        if (!fs.existsSync(localFilePath)) {
            vscode.window.showErrorMessage(`Local file not found: ${fileName}`);
            return;
        }

        // Read the local file content
        const fileContent = fs.readFileSync(localFilePath, 'utf8');

        // Construct the remote file path
        const remotePath = targetDirectory.path === '/' 
            ? `/${fileName}` 
            : `${targetDirectory.path}/${fileName}`;

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
                vscode.window.showInformationMessage(
                    `Successfully pushed ${fileName} to ${targetDirectory.path}`
                );

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
                
                vscode.window.showInformationMessage(`Successfully deleted ${itemType} "${itemName}"`);
                
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
                
                vscode.window.showInformationMessage(`Successfully renamed ${itemType} "${currentName}" to "${newName}"`);
                
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
                
                vscode.window.showInformationMessage(`Successfully moved ${itemType} to "${targetPath}"`);
                
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
                console.warn('Failed to update temp file location:', error);
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
                vscode.window.showInformationMessage(
                    `Editor tab updated: "${fileName}" now points to ${newRemotePath}`
                );
                
            }
        }
    } catch (error) {
        console.warn('Failed to update editor tab:', error);
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
                
                vscode.window.showInformationMessage(`Successfully copied ${itemType} to "${targetPath}"`);
                
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
        console.error('Error editing connection from welcome:', error);
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
            vscode.window.showInformationMessage('Connection deleted successfully');
            welcomeViewProvider.refresh();
        }
        
    } catch (error) {
        console.error('Error deleting connection from welcome:', error);
        vscode.window.showErrorMessage('Failed to delete connection');
    }
}

async function addNewConnectionFromWelcome() {
    try {
        // Show the connection manager and trigger add new connection mode
        connectionManagerView.showWithAddNew();
    } catch (error) {
        console.error('Error opening add new connection from welcome:', error);
        vscode.window.showErrorMessage('Failed to open add new connection');
    }
}

export function deactivate() {
    if (connectionManager) {
        connectionManager.disconnect();
    }
    
    // Clean up file watchers on deactivation
    if (global.remoteFileWatchers) {
        for (const watcherInfo of global.remoteFileWatchers.values()) {
            try {
                if (watcherInfo && watcherInfo.disposable && typeof watcherInfo.disposable.dispose === 'function') {
                    watcherInfo.disposable.dispose();
                }
            } catch (error) {
                console.warn('Failed to dispose file watcher during deactivation:', error);
            }
        }
        global.remoteFileWatchers.clear();
    }
}
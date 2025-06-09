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
            await cleanupTempFiles();
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
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function connectToSavedConnection(connectionIndex: number) {
    try {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        if (connectionIndex < 0 || connectionIndex >= connections.length) {
            vscode.window.showErrorMessage('Invalid connection selected');
            return;
        }

        const connection = connections[connectionIndex];
        
        // Handle authentication for the connection
        let connectionConfig = { ...connection };
        const connectionId = CredentialManager.generateConnectionId(connection);

        if (connection.authType === 'key') {
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

        await connectionManager.connect(connectionConfig);
        remoteFileProvider.resetToDefaultDirectory();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
        updateNavigationContext();
        remoteFileProvider.refresh();
        
        vscode.window.showInformationMessage(`Connected to ${connection.host} via ${(connection.protocol || 'SFTP').toUpperCase()}`);
    } catch (error) {
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
        await vscode.window.showTextDocument(document);

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

async function cleanupTempFiles() {
    try {
        const choice = await vscode.window.showWarningMessage(
            'This will delete all temporary files created by Remote File Browser. Any open files may no longer sync when saved. Continue?',
            { modal: true },
            'Delete All Temp Files',
            'Cancel'
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

        // Check if a directory is selected in the remote file tree
        if (!currentSelectedDirectory) {
            vscode.window.showErrorMessage('Please select a directory in the remote file tree first.');
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

        // Read the local file content
        const fileContent = fs.readFileSync(localFilePath, 'utf8');

        // Construct the remote file path
        const remotePath = currentSelectedDirectory.path === '/' 
            ? `/${fileName}` 
            : `${currentSelectedDirectory.path}/${fileName}`;

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
                    `Successfully pushed ${fileName} to ${currentSelectedDirectory!.path}`
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
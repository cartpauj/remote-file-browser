import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { RemoteFileProvider } from './remoteFileProvider';
import { ConnectionManager } from './connectionManager';
import { ConnectionManagerView } from './connectionManagerView';
import { CredentialManager } from './credentialManager';
import { WelcomeViewProvider } from './welcomeViewProvider';

let remoteFileProvider: RemoteFileProvider;
let connectionManager: ConnectionManager;
let connectionManagerView: ConnectionManagerView;
let credentialManager: CredentialManager;
let welcomeViewProvider: WelcomeViewProvider;

// Global file watchers storage
declare global {
    var remoteFileWatchers: Map<string, any> | undefined;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Remote File Browser extension is now active');

    connectionManager = new ConnectionManager();
    remoteFileProvider = new RemoteFileProvider(connectionManager);
    connectionManagerView = new ConnectionManagerView(context);
    credentialManager = new CredentialManager(context);
    welcomeViewProvider = new WelcomeViewProvider(context);

    const treeDataProvider = vscode.window.createTreeView('remoteFilesList', {
        treeDataProvider: remoteFileProvider,
        showCollapseAll: true
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

        vscode.commands.registerCommand('remoteFileBrowser.connectFromWelcome', async (connectionIndex) => {
            welcomeViewProvider.setConnecting(connectionIndex, true);
            try {
                await connectToSavedConnection(connectionIndex);
            } finally {
                welcomeViewProvider.setConnecting(connectionIndex, false);
            }
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
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
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
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', true);
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
        remoteFileProvider.refresh();
        
        vscode.window.showInformationMessage(`Connected to ${host} via ${protocol}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function disconnectFromRemoteServer() {
    try {
        await connectionManager.disconnect();
        await vscode.commands.executeCommand('setContext', 'remoteFileBrowser.connected', false);
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

        const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc.uri.toString() === tempUri.toString()) {
                try {
                    const updatedContent = savedDoc.getText();
                    await connectionManager.writeFile(item.path, updatedContent);
                    const fileName = path.basename(item.path);
                    vscode.window.showInformationMessage(`Uploaded ${fileName} to remote server`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to upload file: ${error}`);
                }
            }
        });

        // Store disposable for cleanup command
        if (!global.remoteFileWatchers) {
            global.remoteFileWatchers = new Map();
        }
        global.remoteFileWatchers.set(tempUri.toString(), disposable);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
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
            for (const disposable of global.remoteFileWatchers.values()) {
                disposable.dispose();
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

export function deactivate() {
    if (connectionManager) {
        connectionManager.disconnect();
    }
    
    // Clean up file watchers on deactivation
    if (global.remoteFileWatchers) {
        for (const disposable of global.remoteFileWatchers.values()) {
            disposable.dispose();
        }
        global.remoteFileWatchers.clear();
    }
}
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { CredentialManager } from './credentialManager';
import { WelcomeViewProvider } from './welcomeViewProvider';
import { ConnectionStatusManager } from './connectionStatusManager';
import { getConnectionManager } from './extension';

export class ConnectionManagerView {
    private panel: vscode.WebviewPanel | undefined;
    private credentialManager: CredentialManager;
    private welcomeViewProvider: WelcomeViewProvider | undefined;
    private connectionStatusManager: ConnectionStatusManager;

    constructor(private context: vscode.ExtensionContext) {
        this.credentialManager = new CredentialManager(context);
        this.connectionStatusManager = new ConnectionStatusManager();
    }

    public setWelcomeViewProvider(welcomeViewProvider: WelcomeViewProvider) {
        this.welcomeViewProvider = welcomeViewProvider;
    }

    public getConnectionStatusManager(): ConnectionStatusManager {
        return this.connectionStatusManager;
    }

    public refreshConnections() {
        this.loadConnections();
    }

    public clearConnectingState() {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'clearConnecting'
            });
        }
    }


    public showWithEdit(connectionIndex: number) {
        this.show();
        // Delay sending the edit message to ensure webview is ready
        setTimeout(() => {
            this.panel?.webview.postMessage({
                type: 'editConnection',
                index: connectionIndex
            });
        }, 200);
    }

    public showWithAddNew() {
        this.show();
        // Delay sending the add new message to ensure webview is ready
        setTimeout(() => {
            this.panel?.webview.postMessage({
                type: 'addNewConnection'
            });
        }, 200);
    }

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'connectionManager',
            'Manage Remote Connections',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Delay loading connections to ensure webview is ready
        setTimeout(() => {
            this.loadConnections();
        }, 100);
    }

    private async handleMessage(message: any) {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);

        switch (message.type) {
            case 'addConnection':
                // Store password securely if provided
                if (message.data.password && message.data.password.trim() !== '') {
                    const connectionId = CredentialManager.generateConnectionId(message.data);
                    await this.credentialManager.storePassword(connectionId, message.data.password);
                    // Remove password from stored connection data (it's in secure storage now)
                    delete message.data.password;
                }
                
                connections.push(message.data);
                await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                this.connectionStatusManager.showTempMessage('Connection added');
                this.loadConnections();
                this.welcomeViewProvider?.refresh();
                break;

            case 'updateConnection':
                // Store password securely if provided
                if (message.data.password && message.data.password.trim() !== '') {
                    const connectionId = CredentialManager.generateConnectionId(message.data);
                    await this.credentialManager.storePassword(connectionId, message.data.password);
                    // Remove password from stored connection data (it's in secure storage now)
                    delete message.data.password;
                } else if (message.data.password !== undefined) {
                    // Password field exists but is empty - don't delete existing stored password
                    delete message.data.password;
                }
                
                // Merge updated data with existing connection to preserve existing properties
                connections[message.index] = { ...connections[message.index], ...message.data };
                await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                this.connectionStatusManager.showTempMessage('Connection updated');
                this.loadConnections();
                this.welcomeViewProvider?.refresh();
                break;

            case 'deleteConnection':
                const connectionToDelete = connections[message.index];
                const connectionName = connectionToDelete.name || `${connectionToDelete.username}@${connectionToDelete.host}`;
                
                // Show confirmation dialog
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the connection "${connectionName}"?`,
                    { modal: true },
                    'Delete'
                );
                
                if (confirmed === 'Delete') {
                    const connectionId = `${connectionToDelete.host}:${connectionToDelete.port}:${connectionToDelete.username}`;
                    
                    // Clean up stored credentials
                    await this.credentialManager.deleteCredentials(connectionId);
                    
                    connections.splice(message.index, 1);
                    await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                    this.connectionStatusManager.showTempMessage('Connection deleted');
                    this.loadConnections();
                    this.welcomeViewProvider?.refresh();
                }
                break;

            case 'testConnection':
                this.connectionStatusManager.showTempMessage('Test feature coming soon');
                break;

            case 'browseKeyFile':
                const fileUri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'SSH Keys': ['key', 'pem', 'ppk', 'openssh'],
                        'PuTTY Keys': ['ppk'],
                        'All Files': ['*']
                    },
                    defaultUri: vscode.Uri.file((() => {
                        const homeDir = process.env.HOME || process.env.USERPROFILE || (process.platform === 'win32' ? 'C:\\Users\\Default' : '/home');
                        return path.join(homeDir, '.ssh');
                    })())
                });

                if (fileUri && fileUri[0]) {
                    this.panel?.webview.postMessage({
                        type: 'keyFileSelected',
                        path: fileUri[0].fsPath
                    });
                }
                break;

            case 'connectToConnection':
                this.connectToSavedConnection(message.index);
                break;

            case 'disconnect':
                vscode.commands.executeCommand('remoteFileBrowser.disconnect');
                break;

            case 'cleanupTempFiles':
                vscode.commands.executeCommand('remoteFileBrowser.cleanupAllTempFiles');
                break;

            case 'openTempDirectory':
                const tempDir = os.tmpdir();
                const tempDirPath = path.join(tempDir, 'remote-file-browser');
                
                // Check if directory exists first
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(tempDirPath));
                } catch {
                    this.connectionStatusManager.showTempMessage('Connect to a server first');
                    return;
                }
                
                // Always open terminal - simple and reliable across all platforms
                this.openTempDirectoryInTerminal(tempDirPath);
                break;

            case 'cloneConnection':
                const connectionToClone = connections[message.index];
                const clonedConnection = { 
                    ...connectionToClone, 
                    name: `copy of ${connectionToClone.name || 'Unnamed Connection'}`
                };
                
                // Show confirmation dialog
                const cloneName = connectionToClone.name || `${connectionToClone.username}@${connectionToClone.host}`;
                const confirmClone = await vscode.window.showWarningMessage(
                    `Are you sure you want to clone "${cloneName}"?`,
                    { modal: true },
                    'Clone'
                );
                
                if (confirmClone === 'Clone') {
                    connections.push(clonedConnection);
                    await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                    this.connectionStatusManager.showTempMessage('Connection cloned');
                    this.loadConnections();
                    this.welcomeViewProvider?.refresh();
                }
                break;

            case 'getStoredPassword':
                // Retrieve stored password for editing
                try {
                    const connectionId = CredentialManager.generateConnectionId(message.connection);
                    const storedPassword = await this.credentialManager.getPassword(connectionId);
                    this.panel?.webview.postMessage({
                        type: 'storedPassword',
                        password: storedPassword || '',
                        editIndex: message.editIndex
                    });
                } catch (error) {
                    console.error('Error retrieving stored password:', error);
                    this.panel?.webview.postMessage({
                        type: 'storedPassword',
                        password: '',
                        editIndex: message.editIndex
                    });
                }
                break;

            case 'webviewReady':
                // Webview is ready, load connections
                this.loadConnections();
                break;
        }
    }

    private openTempDirectoryInTerminal(tempDirPath: string) {
        // Fallback: Open terminal and navigate to temp directory automatically
        const terminal = vscode.window.createTerminal({
            name: 'Remote Temp Files',
            cwd: tempDirPath
        });
        
        terminal.show();
        
        // Send commands to list the contents - use cross-platform command
        setTimeout(() => {
            if (process.platform === 'win32') {
                terminal.sendText('dir', true);
            } else {
                terminal.sendText('ls -la', true);
            }
        }, 500);
        
        this.connectionStatusManager.showTempMessage('Terminal opened');
    }

    private async connectToSavedConnection(index: number) {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        if (index < 0 || index >= connections.length) {
            vscode.window.showErrorMessage('Invalid connection index');
            return;
        }

        // Continue with connection

        const connection = connections[index];
        
        // Check if already connected
        const currentConnectionState = await this.getCurrentConnectionState();
        if (currentConnectionState.isConnected) {
            // If trying to connect to the same connection, do nothing
            if (currentConnectionState.connectionIndex === index) {
                this.connectionStatusManager.showTempMessage('Already connected');
                return;
            }
            
            // Ask for confirmation to disconnect and connect to new server
            const newConnectionName = connection.name || `${connection.username}@${connection.host}`;
            const currentHost = currentConnectionState.host || 'unknown';
            
            const choice = await vscode.window.showWarningMessage(
                `Disconnect from ${currentHost} and connect to ${newConnectionName}?`,
                { modal: true },
                'Disconnect & Connect'
            );
            
            if (choice !== 'Disconnect & Connect') {
                return; // User cancelled
            }
            
            // Disconnect first
            await vscode.commands.executeCommand('remoteFileBrowser.disconnect');
            
            // Small delay to ensure disconnect completes
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
            let connectionConfig = { ...connection };
            const connectionId = CredentialManager.generateConnectionId(connection);

            if (connection.authType?.toLowerCase() === 'key') {
                // SSH key authentication - check for stored passphrase first
                let passphrase = await this.credentialManager.getPassphrase(connectionId);
                
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
                            const saved = await this.credentialManager.storePassphrase(connectionId, passphrase);
                            if (saved) {
                                this.connectionStatusManager.showTempMessage('Passphrase saved securely');
                            }
                        }
                    }
                }
                
                if (passphrase) {
                    connectionConfig.passphrase = passphrase;
                }
            } else {
                // Password authentication - check for stored password first
                let password = await this.credentialManager.getPassword(connectionId);
                
                // Skip password prompting for anonymous FTP
                if (!password && !connection.anonymous) {
                    password = await vscode.window.showInputBox({
                        prompt: `Enter password for ${connection.username}@${connection.host}`,
                        password: true
                    });

                    if (!password) return;
                    
                    // Ask to save password (only for non-anonymous connections)
                    const savePassword = await vscode.window.showQuickPick(
                        ['Yes', 'No'], 
                        { placeHolder: 'Save password securely for future connections?' }
                    );
                    
                    if (savePassword === 'Yes') {
                        const saved = await this.credentialManager.storePassword(connectionId, password);
                        if (saved) {
                            this.connectionStatusManager.showTempMessage('Password saved securely');
                        }
                    }
                }
                
                // For anonymous FTP, use the stored password if any, or let connection manager handle defaults
                connectionConfig.password = password || connection.password;
            }

            // Show connection status in status bar
            this.connectionStatusManager.showConnecting(connection.host);
            
            // Show spinner in welcome view if this connection is in the recent connections
            if (this.welcomeViewProvider) {
                this.welcomeViewProvider.setConnecting(index, true);
            }
            
            // Send connection data to main extension with connection index
            vscode.commands.executeCommand('remoteFileBrowser.connectDirect', connectionConfig, index);
            
        } catch (error) {
            // Don't show error here - let the main extension handle it
            console.error('Connection manager error:', error);
        }
    }

    private async loadConnections() {
        if (!this.panel) return;

        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        // Get current connection state
        const connectionState = await this.getCurrentConnectionState();
        
        this.panel.webview.postMessage({
            type: 'loadConnections',
            data: connections,
            currentConnection: connectionState
        });
    }

    private async getCurrentConnectionState(): Promise<{isConnected: boolean, host?: string, connectionIndex?: number}> {
        try {
            const connectionManager = getConnectionManager();
            const connectionInfo = connectionManager.getCurrentConnectionInfo();
            
            if (!connectionInfo.isConnected || !connectionInfo.config) {
                return { isConnected: false };
            }

            // Find the connection index in saved connections
            const config = vscode.workspace.getConfiguration('remoteFileBrowser');
            const connections = config.get<any[]>('connections', []);
            
            const connectionIndex = connections.findIndex(conn => 
                conn.host === connectionInfo.config!.host && 
                conn.port === connectionInfo.config!.port && 
                conn.username === connectionInfo.config!.username &&
                (conn.protocol || 'sftp') === connectionInfo.config!.protocol
            );

            return { 
                isConnected: true, 
                host: connectionInfo.host,
                connectionIndex: connectionIndex >= 0 ? connectionIndex : undefined
            };
        } catch (error) {
            return { isConnected: false };
        }
    }

    private getWebviewContent(): string {
        try {
            const templatePath = path.join(__dirname, 'templates', 'connection-manager.html');
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            // Fallback to a minimal template if file read fails
            return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Error Loading Template</title>
</head>
<body>
    <h1>Error</h1>
    <p>Could not load connection manager template. Please reinstall the extension.</p>
    <p>Error: ${error}</p>
</body>
</html>`;
        }
    }
}
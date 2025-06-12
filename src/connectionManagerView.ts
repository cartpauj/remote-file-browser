import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { CredentialManager } from './credentialManager';

export class ConnectionManagerView {
    private panel: vscode.WebviewPanel | undefined;
    private credentialManager: CredentialManager;

    constructor(private context: vscode.ExtensionContext) {
        this.credentialManager = new CredentialManager(context);
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
                connections.push(message.data);
                await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Connection added successfully');
                this.loadConnections();
                break;

            case 'updateConnection':
                connections[message.index] = message.data;
                await config.update('connections', connections, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Connection updated successfully');
                this.loadConnections();
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
                    vscode.window.showInformationMessage('Connection deleted successfully');
                    this.loadConnections();
                }
                break;

            case 'testConnection':
                vscode.window.showInformationMessage('Connection test feature coming soon');
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
                await this.connectToSavedConnection(message.index);
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
                    vscode.window.showInformationMessage('No temporary files directory found. Connect to a server and open some files first.');
                    return;
                }
                
                // Always open terminal - simple and reliable across all platforms
                this.openTempDirectoryInTerminal(tempDirPath);
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
        
        vscode.window.showInformationMessage('Opened terminal in temp files directory');
    }

    private async connectToSavedConnection(index: number) {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        if (index < 0 || index >= connections.length) {
            vscode.window.showErrorMessage('Invalid connection index');
            return;
        }

        const connection = connections[index];
        
        try {
            let connectionConfig = { ...connection };
            const connectionId = CredentialManager.generateConnectionId(connection);

            if (connection.authType === 'key') {
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
                let password = await this.credentialManager.getPassword(connectionId);
                
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
                        const saved = await this.credentialManager.storePassword(connectionId, password);
                        if (saved) {
                            vscode.window.showInformationMessage('Password saved securely');
                        }
                    }
                }
                
                connectionConfig.password = password;
            }

            // Signal successful connection attempt and close panel
            vscode.window.showInformationMessage(`Connecting to ${connection.host}...`);
            
            // Send connection data to main extension
            vscode.commands.executeCommand('remoteFileBrowser.connectDirect', connectionConfig);
            
            // Close the connection manager panel
            this.panel?.dispose();
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
    }

    private loadConnections() {
        if (!this.panel) return;

        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        this.panel.webview.postMessage({
            type: 'loadConnections',
            data: connections
        });
    }

    private getWebviewContent(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manage Remote Connections</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 5px;
            }
        }
        
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-textSeparator-foreground);
            padding-bottom: 10px;
        }
        
        .form-section {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input, select {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            box-sizing: border-box;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .danger {
            background: var(--vscode-errorForeground);
            color: white;
        }
        
        .danger:hover {
            background: var(--vscode-errorForeground);
            opacity: 0.8;
        }
        
        .advanced-toggle {
            background: transparent;
            color: var(--vscode-foreground);
            border: none;
            padding: 8px;
            margin: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            text-align: left;
            width: auto;
            border-radius: 3px;
        }
        
        .advanced-toggle:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .toggle-icon {
            font-size: 12px;
            transition: transform 0.2s ease;
            font-family: monospace;
        }
        
        .toggle-icon.expanded {
            transform: rotate(90deg);
        }
        
        .advanced-settings {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            padding-left: 15px;
            margin-left: 10px;
            margin-top: 10px;
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 5px;
        }
        
        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
            cursor: pointer;
        }
        
        .checkbox-group label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
        }
        
        .connection-list {
            margin-top: 20px;
        }
        
        .connection-item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        
        .connection-header {
            margin-bottom: 10px;
        }
        
        .connection-actions {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .connection-name {
            font-weight: bold;
            font-size: 16px;
        }
        
        .connection-details {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .input-group {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .input-group input {
            flex: 1;
            min-width: 0;
        }
        
        .browse-btn {
            padding: 8px 12px;
            min-width: auto;
            white-space: nowrap;
            flex-shrink: 0;
        }
        
        @media (max-width: 768px) {
            .form-section {
                padding: 15px;
            }
            
            .connection-item {
                padding: 12px;
            }
            
            .button-group {
                justify-content: flex-start;
            }
            
            .input-group {
                flex-direction: column;
                align-items: stretch;
            }
            
            .browse-btn {
                align-self: flex-start;
                margin-top: 5px;
            }
            
            h1 {
                font-size: 1.5em;
            }
            
            h2 {
                font-size: 1.2em;
            }
        }
        
        @media (max-width: 480px) {
            .form-section {
                padding: 10px;
            }
            
            .connection-item {
                padding: 10px;
            }
            
            .button-group {
                flex-direction: column;
                gap: 5px;
            }
            
            button {
                width: 100%;
                margin-right: 0;
            }
            
            .browse-btn {
                width: auto;
                align-self: flex-start;
                max-width: 120px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Manage Remote Connections</h1>
        
        <div class="form-section">
            <h2 id="formTitle">Add New Connection</h2>
            <form id="connectionForm">
                <div class="form-group">
                    <label for="name">Connection Name:</label>
                    <input type="text" id="name" name="name" required>
                </div>
                
                <div class="form-group">
                    <label for="protocol">Protocol:</label>
                    <select id="protocol" name="protocol" required>
                        <option value="sftp">SFTP</option>
                        <option value="ftp">FTP</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="host">Host:</label>
                    <input type="text" id="host" name="host" placeholder="example.com or 192.168.1.100" required>
                </div>
                
                <div class="form-group">
                    <label for="port">Port:</label>
                    <input type="number" id="port" name="port" value="22" required>
                </div>
                
                <div class="form-group">
                    <label for="username">Username:</label>
                    <input type="text" id="username" name="username" required>
                </div>
                
                <div class="form-group">
                    <label for="authType">Authentication:</label>
                    <select id="authType" name="authType" required>
                        <option value="password">Password</option>
                        <option value="key">SSH Key</option>
                    </select>
                </div>
                
                <div class="form-group" id="keyPathGroup" style="display: none;">
                    <label for="keyPath">SSH Key Path:</label>
                    <div class="input-group">
                        <input type="text" id="keyPath" name="keyPath" placeholder="/home/user/.ssh/id_rsa">
                        <button type="button" id="browseKeyBtn" class="browse-btn">Browse...</button>
                    </div>
                    <small style="color: var(--vscode-descriptionForeground);">Path to your private SSH key file</small>
                </div>
                
                <div class="form-group" id="passphraseGroup" style="display: none;">
                    <label for="passphrase">Key Passphrase (optional):</label>
                    <input type="password" id="passphrase" name="passphrase" placeholder="Leave empty if key has no passphrase">
                </div>
                
                <div class="form-group">
                    <label for="remotePath">Remote Path:</label>
                    <input type="text" id="remotePath" name="remotePath" value="/" placeholder="/">
                </div>
                
                <!-- Advanced Settings Toggle -->
                <div class="form-group">
                    <button type="button" id="advancedToggle" class="advanced-toggle">
                        <span class="toggle-icon">▶</span>
                        Advanced Connection Settings (Optional)
                    </button>
                </div>
                
                <!-- Advanced Connection Settings (Initially Hidden) -->
                <div id="advancedSettings" class="advanced-settings" style="display: none;">
                    <div class="form-group">
                        <label for="connectionTimeout">Connection Timeout (ms):</label>
                        <input type="number" id="connectionTimeout" name="connectionTimeout" 
                               value="20000" min="5000" max="120000" step="1000">
                        <small style="color: #666; font-size: 12px;">Time to wait for initial connection (5-120 seconds)</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="operationTimeout">File Operation Timeout (ms):</label>
                        <input type="number" id="operationTimeout" name="operationTimeout" 
                               value="60000" min="10000" max="300000" step="5000">
                        <small style="color: #666; font-size: 12px;">Time to wait for file operations (10-300 seconds)</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="maxRetries">Max Retry Attempts:</label>
                        <input type="number" id="maxRetries" name="maxRetries" 
                               value="3" min="1" max="10" step="1">
                        <small style="color: #666; font-size: 12px;">Number of retry attempts on connection failure</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="retryDelay">Retry Base Delay (ms):</label>
                        <input type="number" id="retryDelay" name="retryDelay" 
                               value="1000" min="500" max="10000" step="500">
                        <small style="color: #666; font-size: 12px;">Base delay between retries (uses exponential backoff)</small>
                    </div>
                    
                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="enableKeepAlive" name="enableKeepAlive" checked>
                            <label for="enableKeepAlive">Enable Keep-Alive</label>
                        </div>
                        <small style="color: #666; font-size: 12px;">Automatically ping server to maintain connection</small>
                    </div>
                    
                    <div class="form-group" id="keepAliveGroup">
                        <label for="keepAliveInterval">Keep-Alive Interval (ms):</label>
                        <input type="number" id="keepAliveInterval" name="keepAliveInterval" 
                               value="30000" min="10000" max="300000" step="5000">
                        <small style="color: #666; font-size: 12px;">How often to ping the server (10-300 seconds)</small>
                    </div>
                </div>
                
                <div class="button-group">
                    <button type="submit" id="submitBtn">Add Connection</button>
                    <button type="button" id="cancelBtn" style="display: none;">Cancel</button>
                </div>
            </form>
        </div>
        
        <div class="connection-list">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h2 style="margin: 0;">Saved Connections</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" id="openTempDirBtn">💻 View tmp files in shell</button>
                    <button type="button" id="cleanupBtn" class="danger">🗑️ Clean Up Temp Files</button>
                </div>
            </div>
            <div id="connectionsList"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let connections = [];
        let editingIndex = -1;

        // Global functions for onclick handlers
        function connectToConnection(index) {
            vscode.postMessage({
                type: 'connectToConnection',
                index: index
            });
        }

        function deleteConnection(index) {
            vscode.postMessage({
                type: 'deleteConnection',
                index: index
            });
        }

        // Load connections
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'loadConnections') {
                connections = message.data;
                renderConnections();
            } else if (message.type === 'keyFileSelected') {
                document.getElementById('keyPath').value = message.path;
            }
        });

        // Send ready message when webview is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                vscode.postMessage({ type: 'webviewReady' });
            });
        } else {
            // DOM is already loaded
            vscode.postMessage({ type: 'webviewReady' });
        }

        // Handle form submission
        document.getElementById('connectionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const connection = {
                name: formData.get('name'),
                protocol: formData.get('protocol'),
                host: formData.get('host'),
                port: parseInt(formData.get('port')),
                username: formData.get('username'),
                remotePath: formData.get('remotePath') || '/',
                authType: formData.get('authType'),
                keyPath: formData.get('keyPath'),
                passphrase: formData.get('passphrase'),
                // Advanced connection settings
                connectionTimeout: formData.get('connectionTimeout') ? parseInt(formData.get('connectionTimeout')) : undefined,
                operationTimeout: formData.get('operationTimeout') ? parseInt(formData.get('operationTimeout')) : undefined,
                maxRetries: formData.get('maxRetries') ? parseInt(formData.get('maxRetries')) : undefined,
                retryDelay: formData.get('retryDelay') ? parseInt(formData.get('retryDelay')) : undefined,
                enableKeepAlive: formData.get('enableKeepAlive') === 'on',
                keepAliveInterval: formData.get('keepAliveInterval') ? parseInt(formData.get('keepAliveInterval')) : undefined
            };

            if (editingIndex >= 0) {
                vscode.postMessage({
                    type: 'updateConnection',
                    index: editingIndex,
                    data: connection
                });
                resetForm();
            } else {
                vscode.postMessage({
                    type: 'addConnection',
                    data: connection
                });
            }

            e.target.reset();
            document.getElementById('port').value = '22';
            document.getElementById('remotePath').value = '/';
        });

        // Cancel editing
        document.getElementById('cancelBtn').addEventListener('click', resetForm);

        // Protocol change handler
        document.getElementById('protocol').addEventListener('change', (e) => {
            const port = document.getElementById('port');
            const connectionTimeout = document.getElementById('connectionTimeout');
            
            if (e.target.value === 'sftp') {
                port.value = '22';
                // Only update timeout if it's still at the default value
                if (connectionTimeout.value === '30000' || connectionTimeout.value === '') {
                    connectionTimeout.value = '20000';
                }
            } else if (e.target.value === 'ftp') {
                port.value = '21';
                // Only update timeout if it's still at the default value
                if (connectionTimeout.value === '20000' || connectionTimeout.value === '') {
                    connectionTimeout.value = '30000';
                }
            }
        });

        // Authentication type change handler
        document.getElementById('authType').addEventListener('change', (e) => {
            const keyPathGroup = document.getElementById('keyPathGroup');
            const passphraseGroup = document.getElementById('passphraseGroup');
            
            if (e.target.value === 'key') {
                keyPathGroup.style.display = 'block';
                passphraseGroup.style.display = 'block';
            } else {
                keyPathGroup.style.display = 'none';
                passphraseGroup.style.display = 'none';
            }
        });

        // Keep-alive checkbox change handler
        document.getElementById('enableKeepAlive').addEventListener('change', (e) => {
            const keepAliveGroup = document.getElementById('keepAliveGroup');
            
            if (e.target.checked) {
                keepAliveGroup.style.display = 'block';
            } else {
                keepAliveGroup.style.display = 'none';
            }
        });

        // Advanced settings toggle handler
        document.getElementById('advancedToggle').addEventListener('click', () => {
            const advancedSettings = document.getElementById('advancedSettings');
            const toggleIcon = document.querySelector('.toggle-icon');
            
            if (advancedSettings.style.display === 'none') {
                advancedSettings.style.display = 'block';
                toggleIcon.textContent = '▼';
                toggleIcon.classList.add('expanded');
            } else {
                advancedSettings.style.display = 'none';
                toggleIcon.textContent = '▶';
                toggleIcon.classList.remove('expanded');
            }
        });

        // Browse key file button handler
        document.getElementById('browseKeyBtn').addEventListener('click', () => {
            vscode.postMessage({
                type: 'browseKeyFile'
            });
        });

        // Cleanup temp files button handler
        document.getElementById('cleanupBtn').addEventListener('click', () => {
            vscode.postMessage({
                type: 'cleanupTempFiles'
            });
        });

        // Open temp directory button handler
        document.getElementById('openTempDirBtn').addEventListener('click', () => {
            vscode.postMessage({
                type: 'openTempDirectory'
            });
        });

        function renderConnections() {
            const container = document.getElementById('connectionsList');
            
            if (connections.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No connections saved yet.</p>';
                return;
            }

            container.innerHTML = connections.map((conn, index) => \`
                <div class="connection-item">
                    <div class="connection-header">
                        <div class="connection-name">\${conn.name || 'Unnamed Connection'}</div>
                        <div class="connection-details">
                            \${(conn.protocol || 'sftp').toUpperCase()}://\${conn.username}@\${conn.host}:\${conn.port || 22}
                            <br>Path: \${conn.remotePath || '/'} | Auth: \${conn.authType === 'key' ? 'SSH Key' : 'Password'}
                            \${conn.authType === 'key' ? \`<br>Key: \${conn.keyPath || 'Not specified'}\` : ''}
                        </div>
                    </div>
                    <div class="connection-actions">
                        <div class="button-group">
                            <button onclick="connectToConnection(\${index})">Connect</button>
                            <button onclick="editConnection(\${index})">Edit</button>
                            <button onclick="deleteConnection(\${index})" class="danger">Delete</button>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        function editConnection(index) {
            const conn = connections[index];
            editingIndex = index;

            document.getElementById('formTitle').textContent = 'Edit Connection';
            document.getElementById('submitBtn').textContent = 'Update Connection';
            document.getElementById('cancelBtn').style.display = 'inline-block';

            document.getElementById('name').value = conn.name || '';
            document.getElementById('protocol').value = conn.protocol || 'sftp';
            document.getElementById('host').value = conn.host || '';
            document.getElementById('port').value = conn.port || 22;
            document.getElementById('username').value = conn.username || '';
            document.getElementById('remotePath').value = conn.remotePath || '/';
            document.getElementById('authType').value = conn.authType || 'password';
            document.getElementById('keyPath').value = conn.keyPath || '';
            document.getElementById('passphrase').value = conn.passphrase || '';

            // Advanced connection settings - show defaults if not set
            const protocolDefault = conn.protocol === 'ftp' ? '30000' : '20000';
            document.getElementById('connectionTimeout').value = conn.connectionTimeout || protocolDefault;
            document.getElementById('operationTimeout').value = conn.operationTimeout || '60000';
            document.getElementById('maxRetries').value = conn.maxRetries || '3';
            document.getElementById('retryDelay').value = conn.retryDelay || '1000';
            document.getElementById('enableKeepAlive').checked = conn.enableKeepAlive !== false; // Default to true
            document.getElementById('keepAliveInterval').value = conn.keepAliveInterval || '30000';

            // Trigger auth type change to show/hide fields
            const authTypeEvent = new Event('change');
            document.getElementById('authType').dispatchEvent(authTypeEvent);

            // Trigger keep-alive change to show/hide interval field
            const keepAliveEvent = new Event('change');
            document.getElementById('enableKeepAlive').dispatchEvent(keepAliveEvent);

            // Show advanced settings if any non-default values are configured
            const hasAdvancedSettings = conn.connectionTimeout || conn.operationTimeout || 
                                       conn.maxRetries || conn.retryDelay || 
                                       conn.keepAliveInterval || conn.enableKeepAlive === false;
            
            if (hasAdvancedSettings) {
                const advancedSettings = document.getElementById('advancedSettings');
                const toggleIcon = document.querySelector('.toggle-icon');
                advancedSettings.style.display = 'block';
                toggleIcon.textContent = '▼';
                toggleIcon.classList.add('expanded');
            }

            document.getElementById('connectionForm').scrollIntoView({ behavior: 'smooth' });
        }

        function resetForm() {
            editingIndex = -1;
            document.getElementById('formTitle').textContent = 'Add New Connection';
            document.getElementById('submitBtn').textContent = 'Add Connection';
            document.getElementById('cancelBtn').style.display = 'none';
            document.getElementById('connectionForm').reset();
            document.getElementById('port').value = '22';
            document.getElementById('remotePath').value = '/';
            document.getElementById('authType').value = 'password';
            
            // Reset advanced connection settings to defaults
            document.getElementById('connectionTimeout').value = '20000'; // Default for SFTP
            document.getElementById('operationTimeout').value = '60000';
            document.getElementById('maxRetries').value = '3';
            document.getElementById('retryDelay').value = '1000';
            document.getElementById('enableKeepAlive').checked = true;
            document.getElementById('keepAliveInterval').value = '30000';
            
            // Hide SSH key fields
            document.getElementById('keyPathGroup').style.display = 'none';
            document.getElementById('passphraseGroup').style.display = 'none';
            
            // Show keep-alive interval field (since keep-alive is checked by default)
            document.getElementById('keepAliveGroup').style.display = 'block';
            
            // Hide advanced settings section
            const advancedSettings = document.getElementById('advancedSettings');
            const toggleIcon = document.querySelector('.toggle-icon');
            advancedSettings.style.display = 'none';
            toggleIcon.textContent = '▶';
            toggleIcon.classList.remove('expanded');
        }
    </script>
</body>
</html>`;
    }
}
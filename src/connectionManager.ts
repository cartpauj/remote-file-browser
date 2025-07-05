import SftpClient from 'pure-js-sftp';
import { Client as FtpClient } from 'basic-ftp';
import * as fs from 'fs';
import { Readable, PassThrough } from 'stream';
import { ConnectionStatusManager } from './connectionStatusManager';
import * as vscode from 'vscode';

export interface ConnectionConfig {
    protocol: 'sftp' | 'ftp';
    host: string;
    port: number;
    username?: string;
    password?: string;
    remotePath: string;
    authType?: 'password' | 'key';
    keyPath?: string;
    passphrase?: string;
    anonymous?: boolean;
    // FTP over TLS settings
    enableFTPS?: boolean;          // Enable FTP over TLS (default: false)
    ftpsMode?: 'explicit' | 'implicit'; // FTPS mode (default: 'explicit')
    // Connection timeout settings
    connectionTimeout?: number;     // Connection timeout in milliseconds (default: 20000 for SFTP, 30000 for FTP)
    operationTimeout?: number;      // File operation timeout in milliseconds (default: 60000)
}

export interface RemoteFileInfo {
    name: string;
    isDirectory: boolean;
    size?: number;
    modifyTime?: Date;
}


export class ConnectionManager {
    private sftpClient?: SftpClient;
    private ftpClient?: FtpClient;
    private config?: ConnectionConfig;
    private connected = false;
    private statusManager?: ConnectionStatusManager;
    private operationLocks = new Set<string>();
    private connectionInProgress = false;
    private lastActivity = Date.now();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;

    public setStatusManager(statusManager: ConnectionStatusManager) {
        this.statusManager = statusManager;
        statusManager.setConnectionManager(this);
    }

    private updateLastActivity() {
        this.lastActivity = Date.now();
    }

    public async ensureConnection(): Promise<void> {
        if (!this.connected || !this.isConnectionAlive()) {
            // Bağlantı konfigürasyonu yoksa manuel reconnect gerekli
            if (!this.config) {
                throw new Error('Connection configuration has been lost. Please disconnect and reconnect manually to restore the connection.');
            }
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                if (this.statusManager) {
                    this.statusManager.showTempMessage('Reconnecting to server...');
                }
                await this.reconnect();
            } else {
                throw new Error('Connection to server was lost and could not be restored. Please reconnect manually.');
            }
        }
        this.updateLastActivity();
    }

    private isConnectionAlive(): boolean {
        // Session timeout check (30 dakika inaktivite sonrası bağlantı süresi dolmuş kabul edilir)
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        const timeSinceLastActivity = Date.now() - this.lastActivity;
        
        if (timeSinceLastActivity > sessionTimeout) {
            return false;
        }
        
        // FTP ve SFTP için farklı connection check
        if (this.config?.protocol === 'sftp') {
            return this.sftpClient !== undefined && this.connected;
        } else if (this.config?.protocol === 'ftp') {
            return this.ftpClient?.closed !== true && this.connected;
        }
        return false;
    }

    private async reconnect(): Promise<void> {
        if (!this.config) {
            throw new Error('No connection configuration available for reconnection');
        }

        try {
            // Mevcut bağlantıyı temizle ama config'i koru
            await this.disconnect(false);
            
            // Tekrar bağlan
            await this.connect(this.config);
            
            this.reconnectAttempts = 0; // Başarılı olursa sayacı sıfırla
            
            if (this.statusManager) {
                this.statusManager.showTempMessage('Reconnected successfully');
            }
        } catch (error) {
            throw new Error(`Reconnection failed: ${error}`);
        }
    }

    private setupSftpEventListeners() {
        if (!this.sftpClient) return;

        // Configure pure-js-sftp 5.0.0 enhanced event system
        if (typeof (this.sftpClient as any).setEventOptions === 'function') {
            (this.sftpClient as any).setEventOptions({
                enableProgressEvents: true,
                enablePerformanceEvents: false,
                progressThrottle: 100
            });
        }

        // Event listeners for pure-js-sftp 5.0.0 enhanced event system
        this.sftpClient.on('operationStart', (data: any) => {
            if (!this.statusManager) return;
            
            const fileName = data.fileName || data.remotePath?.split('/').pop() || 'file';
            
            
            // Enhanced event format: { type, operation_id, remotePath, fileName, startTime, totalBytes?, etc. }
            
            if (data.type === 'upload') {
                this.statusManager.showUploadProgress(fileName);
            } else if (data.type === 'download') {
                this.statusManager.showTempMessage(`Downloading ${fileName}`);
            } else if (data.type === 'delete') {
                this.statusManager.showTempMessage(`Deleting ${fileName}`);
            } else if (data.type === 'mkdir') {
                this.statusManager.showTempMessage(`Creating directory ${fileName}`);
            } else if (data.type === 'rename') {
                this.statusManager.showTempMessage(`Renaming ${fileName}`);
            } else if (data.type === 'list') {
                this.statusManager.showLoadingFiles(this.config?.host || 'server');
            }
        });

        this.sftpClient.on('operationProgress', (data: any) => {
            if (!this.statusManager) return;
            // Enhanced event format includes percentage, bytesTransferred, totalBytes
            const fileName = data.fileName || data.remotePath?.split('/').pop() || 'file';
            
            if (data.percentage && data.type === 'upload') {
                this.statusManager.showUploadProgress(`${fileName} (${Math.round(data.percentage)}%)`);
            } else if (data.percentage && data.type === 'download') {
                this.statusManager.showTempMessage(`Downloading ${fileName} (${Math.round(data.percentage)}%)`);
            }
        });

        this.sftpClient.on('operationComplete', (data: any) => {
            if (!this.statusManager) return;
            
            const fileName = data.fileName || data.remotePath?.split('/').pop() || 'file';
            
            
            // Enhanced event format: { type, operation_id, remotePath, fileName, duration?, etc. }
            
            if (data.type === 'upload') {
                this.statusManager.showTempMessage(`Uploaded ${fileName}`);
            } else if (data.type === 'download') {
                this.statusManager.showTempMessage(`Downloaded ${fileName}`);
            } else if (data.type === 'delete') {
                this.statusManager.showTempMessage(`Deleted ${fileName}`);
            } else if (data.type === 'rename') {
                // For rename, show the new name from the complete event
                const newFileName = data.fileName || data.remotePath?.split('/').pop() || 'file';
                this.statusManager.showTempMessage(`Renamed to ${newFileName}`);
            } else if (data.type === 'mkdir') {
                this.statusManager.showTempMessage(`Created directory ${fileName}`);
            } else if (data.type === 'list') {
                const connectionInfo = this.getCurrentConnectionInfo();
                if (connectionInfo.host) {
                    this.statusManager.showConnected(connectionInfo.host);
                }
            }
        });

        this.sftpClient.on('operationError', (data: any) => {
            if (!this.statusManager) return;
            
            // Enhanced event format: { error, category, isRetryable, suggestedAction, operation_id, type }
            const error = data.error || data;
            const errorMessage = error.message || String(error);
            
            // Show contextual error based on operation type
            if (data.type === 'upload') {
                this.statusManager.showError(this.config?.host || 'server', `Upload failed: ${errorMessage}`);
            } else if (data.type === 'download') {
                this.statusManager.showError(this.config?.host || 'server', `Download failed: ${errorMessage}`);
            } else {
                this.statusManager.showError(this.config?.host || 'server', errorMessage);
            }
        });

        // Monitor auto-reconnection events from pure-js-sftp 5.0.0
        this.sftpClient.on('autoReconnect', (data: any) => {
            if (this.statusManager) {
                this.statusManager.showTempMessage(`Auto-reconnecting (${data.operations} ops completed)...`, 0);
            }
        });

        // Connection monitoring events
        this.sftpClient.on('connectionStart', (data: any) => {
            if (this.statusManager) {
                this.statusManager.showConnecting(data.host);
            }
        });

        this.sftpClient.on('connectionReady', (data: any) => {
            // Mark as truly connected only when SFTP is ready
            this.connected = true;
            
            if (this.statusManager) {
                this.statusManager.showSuccess(data.host);
            }
        });
    }

    public getStatusManager(): ConnectionStatusManager | undefined {
        return this.statusManager;
    }


    public getCurrentConnectionInfo(): {isConnected: boolean, host?: string, config?: ConnectionConfig} {
        return {
            isConnected: this.connected,
            host: this.config?.host,
            config: this.config
        };
    }

    async connect(config: ConnectionConfig): Promise<void> {
        // Prevent concurrent connection attempts
        if (this.connectionInProgress) {
            return;
        }
        
        // Check if already connected to same server
        if (this.connected && this.config && 
            this.config.host === config.host && 
            this.config.port === config.port && 
            this.config.username === config.username) {
            return;
        }
        
        this.connectionInProgress = true;
        try {
            this.config = config;

            await this.connectWithRetry();
            // For SFTP, connected status is set by connectionReady event
            // For FTP, set it here since FTP doesn't have a separate ready event
            if (this.config.protocol === 'ftp') {
                this.connected = true;
            }
        } finally {
            this.connectionInProgress = false;
        }
    }

    private async connectWithRetry(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');
        
        try {
            if (this.config.protocol === 'sftp') {
                await this.connectSftp();
            } else {
                await this.connectFtp();
            }
                
            // Show success and initial file loading
            if (this.statusManager) {
                this.statusManager.showLoadingFiles(this.config.host);
            }
        } catch (error) {
            if (this.statusManager) {
                this.statusManager.showError(this.config.host, (error as any).message || String(error));
            }
            throw error;
        }
    }

    async disconnect(clearConfig: boolean = true): Promise<void> {
        const host = this.config?.host || 'server';
        
        if (this.statusManager) {
            this.statusManager.showTempMessage(`Disconnecting from ${host}`);
        }
        
        if (this.sftpClient) {
            await this.sftpClient.end();
            this.sftpClient = undefined;
        }

        if (this.ftpClient) {
            this.ftpClient.close();
            this.ftpClient = undefined;
        }

        this.connected = false;
        
        // Config'i sadece manual disconnect'te temizle, auto-reconnect sırasında koru
        if (clearConfig) {
            this.config = undefined;
        }
        
        // Clear all operation locks when disconnecting
        this.operationLocks.clear();
        this.connectionInProgress = false;
        
        if (this.statusManager) {
            this.statusManager.showDisconnected();
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    getRemotePath(): string {
        return this.config?.remotePath || '/';
    }

    async listFiles(path: string): Promise<RemoteFileInfo[]> {
        // Bağlantının aktif olduğundan emin ol
        await this.ensureConnection();

        if (this.config?.protocol === 'sftp') {
            return await this.listFilesSftp(path);
        } else {
            return await this.listFilesFtp(path);
        }
    }

    async readFile(path: string): Promise<string> {
        // Bağlantının aktif olduğundan emin ol
        await this.ensureConnection();

        // Prevent concurrent operations on the same file
        const operationKey = `read:${path}`;
        if (this.operationLocks.has(operationKey)) {
            throw new Error('File operation already in progress');
        }

        this.operationLocks.add(operationKey);
        try {
            if (this.config?.protocol === 'sftp') {
                return await this.readFileSftp(path);
            } else {
                return await this.readFileFtp(path);
            }
        } catch (error) {
            // Eğer bağlantı hatası ise, bir kez daha yeniden bağlanmayı dene
            if (this.isConnectionError(error)) {
                try {
                    await this.reconnect();
                    if (this.config?.protocol === 'sftp') {
                        return await this.readFileSftp(path);
                    } else {
                        return await this.readFileFtp(path);
                    }
                } catch (retryError) {
                    throw new Error(`Connection to server was lost while trying to open file. The connection has been automatically restored. Please try again.`);
                }
            }
            throw error;
        } finally {
            this.operationLocks.delete(operationKey);
        }
    }

    public isConnectionError(error: any): boolean {
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        return errorMessage.includes('connection') || 
               errorMessage.includes('socket') || 
               errorMessage.includes('timeout') ||
               errorMessage.includes('disconnected') ||
               errorMessage.includes('broken pipe') ||
               errorMessage.includes('enotconn') ||
               errorMessage.includes('econnreset');
    }

    async writeFile(path: string, content: string): Promise<void> {
        // Bağlantının aktif olduğundan emin ol
        await this.ensureConnection();

        // Prevent concurrent operations on the same file
        const operationKey = `write:${path}`;
        if (this.operationLocks.has(operationKey)) {
            throw new Error('File operation already in progress');
        }

        this.operationLocks.add(operationKey);
        try {
            if (this.config?.protocol === 'sftp') {
                await this.writeFileSftp(path, content);
            } else {
                await this.writeFileFtp(path, content);
            }
        } finally {
            this.operationLocks.delete(operationKey);
        }
    }

    private async connectSftp(): Promise<void> {        
        if (!this.config) throw new Error('No configuration provided');
        
        // Set up a promise that resolves when connectionReady fires
        const connectionReadyPromise = new Promise<void>((resolve, reject) => {
            const onReady = () => {
                this.sftpClient?.off('connectionReady', onReady);
                this.sftpClient?.off('error', onError);
                resolve();
            };
            
            const onError = (error: any) => {
                this.sftpClient?.off('connectionReady', onReady);
                this.sftpClient?.off('error', onError);
                reject(error);
            };
            
            // These will be set up after the client is created
            setTimeout(() => {
                if (this.sftpClient) {
                    this.sftpClient.on('connectionReady', onReady);
                    this.sftpClient.on('error', onError);
                }
            }, 100);
        });

        
        // Validate required fields
        const validationErrors: string[] = [];
        
        if (!this.config.host || this.config.host.trim() === '') {
            validationErrors.push('Host is required and cannot be empty');
        }
        
        if (!this.config.port || this.config.port <= 0 || this.config.port > 65535) {
            validationErrors.push(`Port must be between 1-65535, got: ${this.config.port}`);
        }
        
        if (!this.config.username || this.config.username.trim() === '') {
            validationErrors.push('Username is required and cannot be empty');
        }
        
        if (!this.config.authType || (this.config.authType !== 'key' && this.config.authType !== 'password')) {
            validationErrors.push(`AuthType must be 'key' or 'password', got: "${this.config.authType}"`);
        }
        
        if (this.config.authType === 'key') {
            if (!this.config.keyPath || this.config.keyPath.trim() === '') {
                validationErrors.push('Key path is required for key authentication');
            } else {
                // Check if key file exists and is readable
                try {
                    const keyStats = fs.statSync(this.config.keyPath);
                    const testRead = fs.readFileSync(this.config.keyPath, { encoding: 'utf8', flag: 'r' });
                    
                    // Basic format validation
                    if (!testRead.startsWith('-----BEGIN') && !testRead.startsWith('PuTTY-User-Key-File-')) {
                        validationErrors.push('Key file format not recognized (should start with -----BEGIN or PuTTY-User-Key-File-)');
                    }
                    
                } catch (keyError: any) {
                    if (keyError.code === 'ENOENT') {
                        validationErrors.push(`Key file not found: ${this.config.keyPath}`);
                    } else if (keyError.code === 'EACCES') {
                        validationErrors.push(`Permission denied reading key file: ${this.config.keyPath}`);
                    } else {
                        validationErrors.push(`Key file error: ${keyError.message}`);
                    }
                }
            }
        } else if (this.config.authType === 'password') {
            if (!this.config.password || this.config.password.trim() === '') {
                validationErrors.push('Password is required for password authentication');
            }
        }
        
        // Show validation results
        if (validationErrors.length > 0) {
            throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
        }
        
        try {
            // Create SFTP client with VSCode-optimized concurrency settings
            this.sftpClient = new (SftpClient as any)('remote-file-browser', {
                maxConcurrentOps: 3,    // Conservative for VSCode stability
                queueOnLimit: true      // Queue rather than fail operations
            });
            
            this.setupSftpEventListeners();
            
        } catch (clientError: any) {
            throw new Error(`Failed to create SFTP client: ${clientError?.message || clientError}`);
        }
        
        try {
            
            // Create explicit connection options based on auth type
            let connectOptions: any;
            
            if (this.config.authType?.toLowerCase() === 'key' && this.config.keyPath) {
                // pure-js-sftp 4.0.1+ uses ssh2-streams for proper SSH key handling
                
                // SSH Key authentication
                try {
                    let privateKeyContent = fs.readFileSync(this.config.keyPath, 'utf8');
                    
                    // Check if this is a PPK file by content (not extension)
                    if (privateKeyContent.startsWith('PuTTY-User-Key-File-')) {
                        
                        const { PPKParser } = require('ppk-to-openssh');
                        
                        // Use traditional PEM format for maximum compatibility with pure-js-sftp
                        // PEM format remains the most reliable option
                        const shouldEncrypt = !!(this.config.passphrase && this.config.passphrase.trim() !== '');
                        
                        try {
                            // Create parser with PEM output format and optional encryption
                            const parserOptions: any = {
                                outputFormat: 'pem'  // Use traditional PEM format for reliability
                            };
                            
                            if (shouldEncrypt) {
                                parserOptions.outputPassphrase = this.config.passphrase;
                            }
                            
                            const parser = new PPKParser(parserOptions);
                            const result = await parser.parse(privateKeyContent, this.config.passphrase || '');
                            privateKeyContent = result.privateKey;
                            
                        } catch (ppkError: any) {
                            throw new Error(`PPK conversion failed: ${ppkError.message}`);
                        }
                    }
                    
                    // Strip http:// and https:// from host if present
                    const cleanHost = this.config.host.replace(/^https?:\/\//, '');
                    
                    connectOptions = {
                        host: cleanHost,
                        port: this.config.port,
                        username: this.config.username,
                        privateKey: privateKeyContent,
                        // VSCode-optimized timeout configurations with pure-js-sftp 5.0.0
                        connectTimeout: this.config.connectionTimeout || 30000,
                        operationTimeout: this.config.operationTimeout || 30000,
                        chunkTimeout: this.config.operationTimeout || 30000,
                        gracefulTimeout: 3000,
                        // Enable connection monitoring for reliability
                        keepalive: {
                            enabled: true,
                            interval: 30000,
                            maxMissed: 3
                        },
                        autoReconnect: {
                            enabled: true,
                            maxAttempts: 2,
                            delay: 1000,
                            backoff: 2
                        }
                    };
                    
                    // Always pass passphrase if provided - let ssh2-streams decide if key is encrypted
                    // Modern OpenSSH encrypted keys don't have obvious "ENCRYPTED" markers in the PEM text
                    if (this.config.passphrase) {
                        connectOptions.passphrase = this.config.passphrase;
                    } else {
                    }
                } catch (keyError: any) {
                    // Enhanced error handling for key processing
                    const errorMessage = keyError?.message || String(keyError);
                    
                    // Handle other key file errors
                    if (errorMessage.includes('ENOENT')) {
                        throw new Error(`SSH key file not found: ${this.config.keyPath}`);
                    }
                    
                    throw new Error(`Failed to process SSH key from ${this.config.keyPath}: ${errorMessage}`);
                }
            } else {
                
                // Password authentication - only include password-related options
                // Strip http:// and https:// from host if present
                const cleanHost = this.config.host.replace(/^https?:\/\//, '');
                
                connectOptions = {
                    host: cleanHost,
                    port: this.config.port,
                    username: this.config.username,
                    password: this.config.password,
                    // VSCode-optimized timeout configurations with pure-js-sftp 5.0.0
                    connectTimeout: this.config.connectionTimeout || 30000,
                    operationTimeout: this.config.operationTimeout || 30000,
                    chunkTimeout: this.config.operationTimeout || 30000,
                    gracefulTimeout: 3000,
                    // Enable connection monitoring for reliability
                    keepalive: {
                        enabled: true,
                        interval: 30000,
                        maxMissed: 3
                    },
                    autoReconnect: {
                        enabled: true,
                        maxAttempts: 2,
                        delay: 1000,
                        backoff: 2
                    }
                };
            }
            
            
            try {
                if (this.statusManager) {
                    this.statusManager.showAuthenticating(this.config.host);
                }
                await this.sftpClient!.connect(connectOptions);
            
            } catch (connectError: any) {
                throw connectError;
            }
        } catch (error) {
            console.error('SFTP connection failed:', error);
            
            const errorMessage = (error as any).message || String(error);
            
            // Only show SSH key specific error for key authentication
            if (this.config.authType?.toLowerCase() === 'key' && (errorMessage.includes('privateKey') || errorMessage.includes('authentication'))) {
                throw new Error(`SSH key authentication failed: ${errorMessage}. Verify the key file is valid and the passphrase is correct.`);
            }
            
            // For password authentication or other errors, show generic SFTP error
            throw new Error(`SFTP connection failed: ${errorMessage}`);
        }
        
        // Wait for the connectionReady event before returning (with timeout)
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Timeout waiting for connectionReady event'));
            }, 10000); // 10 second timeout
        });
        
        try {
            await Promise.race([connectionReadyPromise, timeoutPromise]);
        } catch (error: any) {
            if (error.message?.includes('Timeout waiting for connectionReady')) {
                // If timeout, try to proceed anyway - connection might be ready
                this.connected = true; // Force connected status
            } else {
                throw error;
            }
        }
    }

    private async connectFtp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        // For FTP, use 30 second default timeout for initial connection
        const connectionTimeout = this.config.connectionTimeout || 30000;
        this.ftpClient = new FtpClient(connectionTimeout);
        try {
            // Handle anonymous FTP connections
            let username = this.config.username;
            let password = this.config.password;

            if (this.config.anonymous) {
                // For anonymous FTP, try different common patterns
                if (!username || username.trim() === '') {
                    username = 'anonymous';
                }
                if (!password || password.trim() === '') {
                    password = 'anonymous@example.com';
                }
            }

            if (this.statusManager) {
                this.statusManager.showAuthenticating(this.config.host);
            }
            
            // Strip http:// and https:// from host if present
            const cleanHost = this.config.host.replace(/^https?:\/\//, '');
            
            const accessOptions: any = {
                host: cleanHost,
                port: this.config.port,
                user: username,
                password: password
            };

            // Add FTPS support if enabled
            if (this.config.enableFTPS) {
                accessOptions.secure = this.config.ftpsMode === 'implicit' ? 'implicit' : true;
            }
            
            await this.ftpClient.access(accessOptions);
        } catch (error) {
            console.error('FTP connection failed:', error);
            throw new Error(`FTP connection failed: ${(error as any).message || error}`);
        }
    }

    private async listFilesSftp(path: string): Promise<RemoteFileInfo[]> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        const files = await this.sftpClient.list(path);
        return files
            .filter((file: any) => file.name !== '.' && file.name !== '..')
            .map((file: any) => ({
                name: file.name,
                isDirectory: file.type === 'd',
                size: file.size,
                modifyTime: new Date(file.modifyTime)
            }));
    }

    private async listFilesFtp(path: string): Promise<RemoteFileInfo[]> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        

        const files = await this.ftpClient.list(path);
        return files
            .filter((file: any) => file.name !== '.' && file.name !== '..')
            .map((file: any) => ({
                name: file.name,
                isDirectory: file.isDirectory,
                size: file.size,
                modifyTime: file.modifiedAt
            }));
    }

    private async readFileSftp(path: string): Promise<string> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        const buffer = await this.sftpClient.get(path);
        return buffer.toString();
    }

    private async readFileFtp(path: string): Promise<string> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        
        // Show manual status for FTP download operations only
        const fileName = path.split('/').pop() || 'file';
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showTempMessage(`Downloading ${fileName}`);
        }

        return new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            
            // Use PassThrough stream for better compatibility
            const stream = new PassThrough();
            
            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                // Show completion status for FTP only
                if (this.statusManager && this.config?.protocol === 'ftp') {
                    this.statusManager.showTempMessage(`Downloaded ${fileName}`);
                }
                resolve(Buffer.concat(chunks).toString());
            });

            stream.on('error', (error) => {
                reject(error);
            });

            this.ftpClient!.downloadTo(stream, path).catch(reject);
        });
    }

    private async writeFileSftp(path: string, content: string): Promise<void> {
        if (!this.sftpClient) {
            throw new Error('SFTP client not connected');
        }

        // Normalize the path to prevent creation of intermediate directories
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        
        // Use pure-js-sftp native timeout support with method-level override for large files
        const contentSize = Buffer.byteLength(content, 'utf8');
        const options: any = {};
        
        // For large files (>1MB), use extended timeout - let pure-js-sftp optimize performance
        if (contentSize > 1024 * 1024) {
            options.chunkTimeout = this.config?.operationTimeout || 30000;
        }
        
        await this.sftpClient.put(Buffer.from(content), normalizedPath, options);
    }

    private async writeFileFtp(path: string, content: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Show manual status for FTP upload operations only
        const fileName = path.split('/').pop() || 'file';
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showUploadProgress(fileName);
        }

        // Normalize the path to prevent creation of intermediate directories
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        // Create a readable stream from the content
        const buffer = Buffer.from(content);
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null); // End of stream

        await this.ftpClient.uploadFrom(stream, normalizedPath);
        
        // Show completion status for FTP only
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showTempMessage(`Uploaded ${fileName}`);
        }
    }

    async deleteFile(path: string, isDirectory: boolean = false): Promise<void> {
        // Bağlantının aktif olduğundan emin ol
        await this.ensureConnection();

        // Prevent concurrent operations on the same file
        const operationKey = `delete:${path}`;
        if (this.operationLocks.has(operationKey)) {
            throw new Error('File operation already in progress');
        }

        this.operationLocks.add(operationKey);
        try {
            if (this.config?.protocol === 'sftp') {
                await this.deleteFileSftp(path, isDirectory);
            } else {
                await this.deleteFileFtp(path, isDirectory);
            }
        } finally {
            this.operationLocks.delete(operationKey);
        }
    }

    async renameFile(oldPath: string, newPath: string): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        // Prevent concurrent operations on the same file
        const operationKey = `rename:${oldPath}`;
        if (this.operationLocks.has(operationKey)) {
            throw new Error('File operation already in progress');
        }

        this.operationLocks.add(operationKey);
        try {
            if (this.config?.protocol === 'sftp') {
                await this.renameFileSftp(oldPath, newPath);
            } else {
                await this.renameFileFtp(oldPath, newPath);
            }
        } finally {
            this.operationLocks.delete(operationKey);
        }
    }

    async fileExists(path: string): Promise<boolean> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        try {
            if (this.config?.protocol === 'sftp') {
                if (!this.sftpClient) throw new Error('SFTP client not connected');
                await this.sftpClient.stat(path);
                return true;
            } else {
                if (!this.ftpClient) throw new Error('FTP client not connected');
                
                
                try {
                    await this.ftpClient.size(path);
                    return true;
                } catch (error) {
                    // For FTP, try to list the parent directory and check if file exists
                    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                    const fileName = path.substring(path.lastIndexOf('/') + 1);
                    const files = await this.ftpClient.list(parentPath);
                    return files.some((file: any) => file.name === fileName);
                }
            }
        } catch (error) {
            // If we get an error (like "No such file"), the file doesn't exist
            return false;
        }
    }

    async copyFile(sourcePath: string, targetPath: string, isDirectory: boolean = false): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        if (isDirectory) {
            await this.copyDirectoryRecursive(sourcePath, targetPath);
        } else {
            // Read file content and write to new location
            const content = await this.readFile(sourcePath);
            await this.writeFile(targetPath, content);
        }
    }

    private async copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
        // Create the target directory first
        if (this.config?.protocol === 'sftp') {
            if (!this.sftpClient) throw new Error('SFTP client not connected');
            try {
                await this.sftpClient.mkdir(targetPath);
            } catch (error) {
                // Directory might already exist, check if it's not a "file exists" error
                if (!(error as any).message?.includes('File exists') && 
                    !(error as any).message?.includes('EEXIST')) {
                    throw error;
                }
            }
        } else {
            if (!this.ftpClient) throw new Error('FTP client not connected');
            
            
            try {
                await this.ftpClient.ensureDir(targetPath);
            } catch (error) {
                // Ignore if directory already exists
            }
        }

        // List and copy all files in the source directory
        const files = await this.listFiles(sourcePath);
        for (const file of files) {
            const sourceFilePath = sourcePath === '/' ? `/${file.name}` : `${sourcePath}/${file.name}`;
            const targetFilePath = targetPath === '/' ? `/${file.name}` : `${targetPath}/${file.name}`;
            
            if (file.isDirectory) {
                await this.copyDirectoryRecursive(sourceFilePath, targetFilePath);
            } else {
                const content = await this.readFile(sourceFilePath);
                await this.writeFile(targetFilePath, content);
            }
        }
    }

    private async deleteFileSftp(path: string, isDirectory: boolean): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        if (isDirectory) {
            // For directories, we need to recursively delete contents first
            const files = await this.sftpClient.list(path);
            for (const file of files) {
                if (file.name !== '.' && file.name !== '..') {
                    const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                    await this.deleteFileSftp(filePath, file.type === 'd');
                }
            }
            await this.sftpClient.rmdir(path);
        } else {
            await this.sftpClient.delete(path);
        }
    }

    private async deleteFileFtp(path: string, isDirectory: boolean): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Show manual status for FTP delete operations only
        const fileName = path.split('/').pop() || 'item';
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showTempMessage(`Deleting ${fileName}`);
        }

        try {
            if (isDirectory) {
                // For directories, we need to recursively delete contents first
                try {
                    const files = await this.ftpClient.list(path);
                    for (const file of files) {
                        if (file.name !== '.' && file.name !== '..') {
                            const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                            const isFileDirectory = (file as any).type === 1; // 1 = directory in basic-ftp
                            await this.deleteFileFtp(filePath, isFileDirectory);
                        }
                    }
                } catch (listError) {
                    // If listing fails, directory might be empty or inaccessible
                    console.log(`Warning: Could not list directory contents for ${path}: ${listError}`);
                }
                
                // Try to remove the directory
                await this.ftpClient.removeDir(path);
            } else {
                // For files, try to remove directly
                await this.ftpClient.remove(path);
            }
            
            // Show completion status for FTP only
            if (this.statusManager && this.config?.protocol === 'ftp') {
                this.statusManager.showTempMessage(`Deleted ${fileName}`);
            }
        } catch (error) {
            // More specific error handling
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            if (errorMessage.includes('550') && errorMessage.includes('cannot find')) {
                throw new Error(`File or directory not found: ${fileName}`);
            } else if (errorMessage.includes('550') && errorMessage.includes('not empty')) {
                throw new Error(`Directory not empty: ${fileName}. Please delete contents first.`);
            } else if (errorMessage.includes('550')) {
                throw new Error(`Permission denied or file system error: ${fileName}`);
            } else {
                throw new Error(`Delete failed: ${errorMessage}`);
            }
        }
    }

    private async renameFileSftp(oldPath: string, newPath: string): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');
        await this.sftpClient.rename(oldPath, newPath);
    }

    private async renameFileFtp(oldPath: string, newPath: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Show manual status for FTP rename operations only
        const oldFileName = oldPath.split('/').pop() || 'item';
        const newFileName = newPath.split('/').pop() || 'item';
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showTempMessage(`Renaming ${oldFileName}`);
        }
        
        await this.ftpClient.rename(oldPath, newPath);
        
        // Show completion status for FTP only
        if (this.statusManager && this.config?.protocol === 'ftp') {
            this.statusManager.showTempMessage(`Renamed to ${newFileName}`);
        }
    }


    getConnectionInfo(): ConnectionConfig | undefined {
        return this.config;
    }

    async createFile(path: string, content: string = ''): Promise<void> {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        // writeFile metodu zaten kendi lock sistemini kullanıyor, 
        // burada ayrı lock kullanmayalım
        await this.writeFile(path, content);
    }

    async createDirectory(path: string): Promise<void> {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        const lockKey = `mkdir:${path}`;
        if (this.operationLocks.has(lockKey)) {
            throw new Error('Directory creation already in progress');
        }

        this.operationLocks.add(lockKey);
        try {
            if (this.config?.protocol === 'sftp' && this.sftpClient) {
                await this.createDirectorySftp(path);
            } else if (this.config?.protocol === 'ftp' && this.ftpClient) {
                await this.createDirectoryFtp(path);
            } else {
                throw new Error('No valid connection available');
            }
        } finally {
            this.operationLocks.delete(lockKey);
        }
    }

    private async createDirectorySftp(path: string): Promise<void> {
        if (!this.sftpClient) {
            throw new Error('SFTP client not connected');
        }

        try {
            await this.sftpClient.mkdir(path);
        } catch (error) {
            throw new Error(`Failed to create directory via SFTP: ${error}`);
        }
    }

    private async createDirectoryFtp(path: string): Promise<void> {
        if (!this.ftpClient) {
            throw new Error('FTP client not connected');
        }

        try {
            await this.ftpClient.ensureDir(path);
        } catch (error) {
            throw new Error(`Failed to create directory via FTP: ${error}`);
        }
    }






}
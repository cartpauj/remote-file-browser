import SftpClient from 'pure-js-sftp';
import { Client as FtpClient } from 'basic-ftp';
import * as fs from 'fs';
import { Readable, PassThrough } from 'stream';
import { ConnectionStatusManager } from './connectionStatusManager';

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
    // Connection timeout and retry settings
    connectionTimeout?: number;     // Connection timeout in milliseconds (default: 20000 for SFTP, 30000 for FTP)
    operationTimeout?: number;      // File operation timeout in milliseconds (default: 60000)
    maxRetries?: number;           // Maximum retry attempts (default: 3)
    retryDelay?: number;          // Base delay between retries in milliseconds (default: 1000)
    enableKeepAlive?: boolean;    // Enable keep-alive mechanisms (default: true)
    keepAliveInterval?: number;   // Keep-alive interval in milliseconds (default: 30000)
}

export interface RemoteFileInfo {
    name: string;
    isDirectory: boolean;
    size?: number;
    modifyTime?: Date;
}

export interface ConnectionHealth {
    isConnected: boolean;
    lastSuccessfulOperation?: Date;
    consecutiveFailures: number;
    totalConnections: number;
    uptime?: number;           // Time connected in milliseconds
    keepAliveStatus: 'active' | 'inactive' | 'failing';
    lastError?: string;
}

export class ConnectionManager {
    private sftpClient?: SftpClient;
    private ftpClient?: FtpClient;
    private config?: ConnectionConfig;
    private connected = false;
    private keepAliveInterval?: NodeJS.Timeout;
    private connectionRetries = 0;
    private ftpConnectionLock = false;
    private statusManager?: ConnectionStatusManager;
    private activeOperations: Set<string> = new Set();
    
    // Health monitoring properties
    private lastSuccessfulOperation?: Date;
    private consecutiveFailures = 0;
    private totalConnections = 0;
    private connectionStartTime?: Date;
    private keepAliveStatus: 'active' | 'inactive' | 'failing' = 'inactive';
    private lastError?: string;

    public setStatusManager(statusManager: ConnectionStatusManager) {
        this.statusManager = statusManager;
    }

    getActiveOperations(): string[] {
        return Array.from(this.activeOperations);
    }

    hasActiveOperations(): boolean {
        return this.activeOperations.size > 0;
    }

    private addOperation(operation: string): void {
        this.activeOperations.add(operation);
    }

    private removeOperation(operation: string): void {
        this.activeOperations.delete(operation);
    }

    private clearAllOperations(): void {
        this.activeOperations.clear();
    }

    public getCurrentConnectionInfo(): {isConnected: boolean, host?: string, config?: ConnectionConfig} {
        return {
            isConnected: this.connected,
            host: this.config?.host,
            config: this.config
        };
    }

    async connect(config: ConnectionConfig): Promise<void> {
        this.config = config;
        this.connectionRetries = 0;

        this.addOperation('connecting');
        try {
            await this.connectWithRetry();
            this.connected = true;
        } finally {
            this.removeOperation('connecting');
        }
        
        // Update health metrics
        this.totalConnections++;
        this.connectionStartTime = new Date();
        this.lastSuccessfulOperation = new Date();
        this.consecutiveFailures = 0;
        this.lastError = undefined;
        
        // Start keep-alive if enabled
        if (config.enableKeepAlive !== false) {
            this.startKeepAlive();
        }
    }

    private async connectWithRetry(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');
        
        const maxRetries = this.config.maxRetries || 3;
        const baseDelay = this.config.retryDelay || 1000;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0 && this.statusManager) {
                    this.statusManager.showRetrying(this.config.host, attempt, maxRetries);
                }
                
                if (this.config.protocol === 'sftp') {
                    await this.connectSftp();
                } else {
                    await this.connectFtp();
                }
                this.connectionRetries = 0;
                
                // Show success and initial file loading
                if (this.statusManager) {
                    this.statusManager.showLoadingFiles(this.config.host);
                }
                
                return; // Success!
            } catch (error) {
                this.connectionRetries = attempt + 1;
                
                if (attempt === maxRetries) {
                    if (this.statusManager) {
                        this.statusManager.showError(this.config.host, (error as any).message || String(error));
                    }
                    throw error; // Final attempt failed
                }
                
                // Exponential backoff: delay = baseDelay * 2^attempt (capped at 10 seconds)
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async disconnect(): Promise<void> {
        // Stop keep-alive
        this.stopKeepAlive();
        
        if (this.sftpClient) {
            await this.sftpClient.end();
            this.sftpClient = undefined;
        }

        if (this.ftpClient) {
            this.ftpClient.close();
            this.ftpClient = undefined;
        }

        this.connected = false;
        this.config = undefined;
        this.connectionRetries = 0;
        this.ftpConnectionLock = false;
        
        // Reset health monitoring
        this.connectionStartTime = undefined;
        this.keepAliveStatus = 'inactive';
        
        // Clear all active operations on disconnect
        this.clearAllOperations();
    }

    isConnected(): boolean {
        return this.connected;
    }

    getRemotePath(): string {
        return this.config?.remotePath || '/';
    }

    async listFiles(path: string): Promise<RemoteFileInfo[]> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        this.addOperation('listing files');
        try {
            if (this.config.protocol === 'sftp') {
                return await this.listFilesSftp(path);
            } else {
                return await this.listFilesFtp(path);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config.protocol === 'sftp') {
                    return await this.listFilesSftp(path);
                } else {
                    return await this.listFilesFtp(path);
                }
            }
            throw error;
        } finally {
            this.removeOperation('listing files');
        }
    }

    async readFile(path: string): Promise<string> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        this.addOperation('reading file');
        try {
            if (this.config.protocol === 'sftp') {
                return await this.readFileSftp(path);
            } else {
                return await this.readFileFtp(path);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config.protocol === 'sftp') {
                    return await this.readFileSftp(path);
                } else {
                    return await this.readFileFtp(path);
                }
            }
            throw error;
        } finally {
            this.removeOperation('reading file');
        }
    }

    async writeFile(path: string, content: string): Promise<void> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        this.addOperation('writing file');
        try {
            if (this.config.protocol === 'sftp') {
                await this.writeFileSftp(path, content);
            } else {
                await this.writeFileFtp(path, content);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config.protocol === 'sftp') {
                    await this.writeFileSftp(path, content);
                } else {
                    await this.writeFileFtp(path, content);
                }
            } else {
                throw error;
            }
        } finally {
            this.removeOperation('writing file');
        }
    }

    private async connectSftp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        
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
            console.error('[ConnectionManager] ❌ VALIDATION ERRORS:');
            validationErrors.forEach((error, index) => {
                console.error(`  ${index + 1}. ${error}`);
            });
            throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
        }
        
        try {
            this.sftpClient = new SftpClient('remote-file-browser');
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
                        privateKey: privateKeyContent
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
                    password: this.config.password
                };
            }
            
            
            try {
                if (this.statusManager) {
                    this.statusManager.showAuthenticating(this.config.host);
                }
                await this.sftpClient.connect(connectOptions);
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

        const files = await this.withOperationTimeout(
            this.sftpClient.list(path),
            'list files'
        );
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
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();

        const files = await this.withOperationTimeout(
            this.ftpClient.list(path),
            'list files'
        );
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

        const buffer = await this.withOperationTimeout(
            this.sftpClient.get(path),
            'read file'
        );
        return buffer.toString();
    }

    private async readFileFtp(path: string): Promise<string> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();

        return new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            
            // Use PassThrough stream for better compatibility
            const stream = new PassThrough();
            
            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks).toString());
            });

            stream.on('error', (error) => {
                reject(error);
            });

            this.withOperationTimeout(
                this.ftpClient!.downloadTo(stream, path),
                'read file'
            ).catch(reject);
        });
    }

    private async writeFileSftp(path: string, content: string): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        // Normalize the path to prevent creation of intermediate directories
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        
        console.log(`SFTP writeFile Debug:
            Original path: ${path}
            Normalized path: ${normalizedPath}`);
        
        await this.withOperationTimeout(
            this.sftpClient.put(Buffer.from(content), normalizedPath),
            'write file'
        );
    }

    private async writeFileFtp(path: string, content: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();

        // Normalize the path to prevent creation of intermediate directories
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        console.log(`FTP writeFile Debug:
            Original path: ${path}
            Normalized path: ${normalizedPath}`);

        // Create a readable stream from the content
        const buffer = Buffer.from(content);
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null); // End of stream

        await this.withOperationTimeout(
            this.ftpClient.uploadFrom(stream, normalizedPath),
            'write file'
        );
    }

    async deleteFile(path: string, isDirectory: boolean = false): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        this.addOperation('deleting file');
        try {
            if (this.config?.protocol === 'sftp') {
                await this.deleteFileSftp(path, isDirectory);
            } else {
                await this.deleteFileFtp(path, isDirectory);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost while deleting file, attempting to reconnect...');
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config?.protocol === 'sftp') {
                    await this.deleteFileSftp(path, isDirectory);
                } else {
                    await this.deleteFileFtp(path, isDirectory);
                }
            } else {
                throw error;
            }
        } finally {
            this.removeOperation('deleting file');
        }
    }

    async renameFile(oldPath: string, newPath: string): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        this.addOperation('renaming file');
        try {
            if (this.config?.protocol === 'sftp') {
                await this.renameFileSftp(oldPath, newPath);
            } else {
                await this.renameFileFtp(oldPath, newPath);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost while renaming file, attempting to reconnect...');
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config?.protocol === 'sftp') {
                    await this.renameFileSftp(oldPath, newPath);
                } else {
                    await this.renameFileFtp(oldPath, newPath);
                }
            } else {
                throw error;
            }
        } finally {
            this.removeOperation('renaming file');
        }
    }

    async fileExists(path: string): Promise<boolean> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        this.addOperation('checking file');
        try {
            if (this.config?.protocol === 'sftp') {
                if (!this.sftpClient) throw new Error('SFTP client not connected');
                await this.withOperationTimeout(
                    this.sftpClient.stat(path),
                    'check file existence'
                );
                return true;
            } else {
                if (!this.ftpClient) throw new Error('FTP client not connected');
                
                // Check if connection is still alive and reconnect if needed
                await this.ensureFtpConnection();
                
                try {
                    await this.withOperationTimeout(
                        this.ftpClient.size(path),
                        'check file existence'
                    );
                    return true;
                } catch (error) {
                    // For FTP, try to list the parent directory and check if file exists
                    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                    const fileName = path.substring(path.lastIndexOf('/') + 1);
                    const files = await this.withOperationTimeout(
                        this.ftpClient.list(parentPath),
                        'list directory for file check'
                    );
                    return files.some((file: any) => file.name === fileName);
                }
            }
        } catch (error) {
            // If we get an error (like "No such file"), the file doesn't exist
            return false;
        } finally {
            this.removeOperation('checking file');
        }
    }

    async copyFile(sourcePath: string, targetPath: string, isDirectory: boolean = false): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

        this.addOperation('copying file');
        try {
            if (isDirectory) {
                await this.copyDirectoryRecursive(sourcePath, targetPath);
            } else {
                // Read file content and write to new location
                const content = await this.readFile(sourcePath);
                await this.writeFile(targetPath, content);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost while copying file, attempting to reconnect...');
                await this.reconnect();
                // Retry the operation after reconnecting
                if (isDirectory) {
                    await this.copyDirectoryRecursive(sourcePath, targetPath);
                } else {
                    const content = await this.readFile(sourcePath);
                    await this.writeFile(targetPath, content);
                }
            } else {
                throw error;
            }
        } finally {
            this.removeOperation('copying file');
        }
    }

    private async copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
        // Create the target directory first
        if (this.config?.protocol === 'sftp') {
            if (!this.sftpClient) throw new Error('SFTP client not connected');
            try {
                await this.withOperationTimeout(
                    this.sftpClient.mkdir(targetPath),
                    'create directory'
                );
            } catch (error) {
                // Directory might already exist, check if it's not a "file exists" error
                if (!(error as any).message?.includes('File exists') && 
                    !(error as any).message?.includes('EEXIST')) {
                    throw error;
                }
            }
        } else {
            if (!this.ftpClient) throw new Error('FTP client not connected');
            
            // Check if connection is still alive and reconnect if needed
            await this.ensureFtpConnection();
            
            try {
                await this.withOperationTimeout(
                    this.ftpClient.ensureDir(targetPath),
                    'create directory'
                );
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
            const files = await this.withOperationTimeout(
                this.sftpClient.list(path),
                'list directory for deletion'
            );
            for (const file of files) {
                if (file.name !== '.' && file.name !== '..') {
                    const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                    await this.deleteFileSftp(filePath, file.type === 'd');
                }
            }
            await this.withOperationTimeout(
                this.sftpClient.rmdir(path),
                'delete directory'
            );
        } else {
            await this.withOperationTimeout(
                this.sftpClient.delete(path),
                'delete file'
            );
        }
    }

    private async deleteFileFtp(path: string, isDirectory: boolean): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();

        if (isDirectory) {
            // For directories, we need to recursively delete contents first
            const files = await this.withOperationTimeout(
                this.ftpClient.list(path),
                'list directory for deletion'
            );
            for (const file of files) {
                if (file.name !== '.' && file.name !== '..') {
                    const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                    const isFileDirectory = (file as any).type === 1; // 1 = directory in basic-ftp
                    await this.deleteFileFtp(filePath, isFileDirectory);
                }
            }
            await this.withOperationTimeout(
                this.ftpClient.removeDir(path),
                'delete directory'
            );
        } else {
            await this.withOperationTimeout(
                this.ftpClient.remove(path),
                'delete file'
            );
        }
    }

    private async renameFileSftp(oldPath: string, newPath: string): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');
        await this.withOperationTimeout(
            this.sftpClient.rename(oldPath, newPath),
            'rename file'
        );
    }

    private async renameFileFtp(oldPath: string, newPath: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();
        
        await this.withOperationTimeout(
            this.ftpClient.rename(oldPath, newPath),
            'rename file'
        );
    }

    private isConnectionError(error: any): boolean {
        const errorMessage = error?.message || error?.toString() || '';
        const errorCode = error?.code || '';
        
        // Common connection error patterns for both SFTP and FTP
        const connectionErrors = [
            // Network-level errors
            'ECONNRESET',
            'ECONNREFUSED', 
            'ETIMEDOUT',
            'ENOTFOUND',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'EPIPE',
            'ECONNABORTED',
            
            // Generic connection messages
            'Connection closed',
            'Connection lost',
            'Connection terminated',
            'Socket closed',
            'Socket hang up',
            'read ECONNRESET',
            'write ECONNRESET',
            
            // FTP-specific error patterns (from basic-ftp library)
            'Connection timeout',
            'Control socket closed',
            'Data connection timeout',
            'Lost connection',
            'Server closed connection',
            'Transfer timeout',
            'Passive connection failed',
            'PASV timeout',
            'LIST timeout',
            'Connection interrupted',
            
            // SSH/SFTP specific errors
            'All configured authentication methods failed',
            'Connection reset by peer',
            'Handshake failed'
        ];
        
        return connectionErrors.some(pattern => 
            errorMessage.includes(pattern) || errorCode === pattern
        );
    }

    private async reconnect(): Promise<void> {
        
        try {
            // Clean up existing connections
            this.stopKeepAlive();
            this.connected = false;
            if (this.sftpClient) {
                try {
                    await this.sftpClient.end();
                } catch (e) {
                    // Ignore cleanup errors
                }
                this.sftpClient = undefined;
            }
            if (this.ftpClient) {
                try {
                    this.ftpClient.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
                this.ftpClient = undefined;
            }

            // Reconnect using stored config with retry logic
            if (this.config) {
                await this.connectWithRetry();
                this.connected = true;
                
                // Restart keep-alive
                if (this.config.enableKeepAlive !== false) {
                    this.startKeepAlive();
                }
                
            } else {
                throw new Error('No configuration available for reconnection');
            }
        } catch (error) {
            console.error('Failed to reconnect:', error);
            this.connected = false;
            throw new Error(`Connection lost and failed to reconnect: ${error}`);
        }
    }

    getConnectionInfo(): ConnectionConfig | undefined {
        return this.config;
    }

    getConnectionHealth(): ConnectionHealth {
        const uptime = this.connectionStartTime ? 
            Date.now() - this.connectionStartTime.getTime() : undefined;

        return {
            isConnected: this.connected,
            lastSuccessfulOperation: this.lastSuccessfulOperation,
            consecutiveFailures: this.consecutiveFailures,
            totalConnections: this.totalConnections,
            uptime,
            keepAliveStatus: this.keepAliveStatus,
            lastError: this.lastError
        };
    }

    private recordOperationSuccess(): void {
        this.lastSuccessfulOperation = new Date();
        this.consecutiveFailures = 0;
        this.lastError = undefined;
    }

    private recordOperationFailure(error: any): void {
        this.consecutiveFailures++;
        this.lastError = error?.message || error?.toString() || 'Unknown error';
    }

    private async withOperationTimeout<T>(operation: Promise<T>, operationName?: string): Promise<T> {
        try {
            let result: T;
            
            const operationTimeout = this.config?.operationTimeout || 60000; // Default: 60 seconds
            
            if (operationTimeout <= 0) {
                result = await operation; // Timeout disabled
            } else {
                const timeout = operationTimeout;
                
                result = await new Promise<T>((resolve, reject) => {
                    // Set up the timeout
                    const timeoutId = setTimeout(() => {
                        reject(new Error(`Operation ${operationName || 'timeout'} exceeded ${timeout}ms timeout`));
                    }, timeout);

                    // Handle the operation
                    operation
                        .then((result) => {
                            clearTimeout(timeoutId);
                            resolve(result);
                        })
                        .catch((error) => {
                            clearTimeout(timeoutId);
                            reject(error);
                        });
                });
            }
            
            // Record success
            this.recordOperationSuccess();
            return result;
            
        } catch (error) {
            // Record failure
            this.recordOperationFailure(error);
            throw error;
        }
    }

    private startKeepAlive(): void {
        if (!this.config || this.config.enableKeepAlive === false) {
            return;
        }

        const interval = this.config.keepAliveInterval || 30000;
        this.keepAliveStatus = 'active';
        
        this.keepAliveInterval = setInterval(async () => {
            if (!this.connected) {
                this.stopKeepAlive();
                return;
            }

            try {
                await this.performKeepAliveCheck();
                // Keep-alive succeeded, ensure status is active
                if (this.keepAliveStatus === 'failing') {
                    this.keepAliveStatus = 'active';
                }
            } catch (error) {
                console.warn('Keep-alive check failed, attempting reconnection:', error);
                this.keepAliveStatus = 'failing';
                try {
                    await this.reconnect();
                    this.keepAliveStatus = 'active';
                } catch (reconnectError) {
                    console.error('Keep-alive reconnection failed:', reconnectError);
                    this.stopKeepAlive();
                }
            }
        }, interval);

    }

    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = undefined;
        }
    }

    private async performKeepAliveCheck(): Promise<void> {
        if (!this.config) return;

        if (this.config.protocol === 'sftp') {
            // For SFTP, try to list the current directory
            if (this.sftpClient) {
                await this.withOperationTimeout(
                    this.sftpClient.list(this.config.remotePath || '/'),
                    'keep-alive check'
                );
            }
        } else {
            // For FTP, try to get the current directory
            if (this.ftpClient) {
                await this.withOperationTimeout(
                    this.ftpClient.pwd(),
                    'keep-alive check'
                );
            }
        }
    }

    private async ensureFtpConnection(): Promise<void> {
        if (!this.ftpClient || !this.config) return;
        
        // Check if FTP connection is still alive by testing if it's closed
        if (this.ftpClient.closed) {
            // Prevent concurrent reconnection attempts
            if (this.ftpConnectionLock) {
                // Wait for ongoing reconnection to complete
                while (this.ftpConnectionLock) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                return;
            }
            
            this.ftpConnectionLock = true;
            try {
                // Close the old client first
                if (this.ftpClient) {
                    this.ftpClient.close();
                }
                await this.connectFtp();
            } catch (error) {
                console.error('FTP reconnection failed:', error);
                throw new Error(`FTP reconnection failed: ${(error as any).message || error}`);
            } finally {
                this.ftpConnectionLock = false;
            }
        }
    }

}
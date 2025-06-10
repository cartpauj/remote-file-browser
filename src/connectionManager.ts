import * as SftpClient from 'ssh2-sftp-client';
import { Client as FtpClient } from 'basic-ftp';
import * as fs from 'fs';

export interface ConnectionConfig {
    protocol: 'sftp' | 'ftp';
    host: string;
    port: number;
    username: string;
    password?: string;
    remotePath: string;
    authType?: 'password' | 'key';
    keyPath?: string;
    passphrase?: string;
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
    
    // Health monitoring properties
    private lastSuccessfulOperation?: Date;
    private consecutiveFailures = 0;
    private totalConnections = 0;
    private connectionStartTime?: Date;
    private keepAliveStatus: 'active' | 'inactive' | 'failing' = 'inactive';
    private lastError?: string;

    async connect(config: ConnectionConfig): Promise<void> {
        this.config = config;
        this.connectionRetries = 0;

        await this.connectWithRetry();
        this.connected = true;
        
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
                if (this.config.protocol === 'sftp') {
                    await this.connectSftp();
                } else {
                    await this.connectFtp();
                }
                this.connectionRetries = 0;
                return; // Success!
            } catch (error) {
                this.connectionRetries = attempt + 1;
                
                if (attempt === maxRetries) {
                    throw error; // Final attempt failed
                }
                
                // Exponential backoff: delay = baseDelay * 2^attempt (capped at 10 seconds)
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
                console.log(`Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
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
        
        // Reset health monitoring
        this.connectionStartTime = undefined;
        this.keepAliveStatus = 'inactive';
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

        try {
            if (this.config.protocol === 'sftp') {
                return await this.listFilesSftp(path);
            } else {
                return await this.listFilesFtp(path);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost, attempting to reconnect...');
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config.protocol === 'sftp') {
                    return await this.listFilesSftp(path);
                } else {
                    return await this.listFilesFtp(path);
                }
            }
            throw error;
        }
    }

    async readFile(path: string): Promise<string> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        try {
            if (this.config.protocol === 'sftp') {
                return await this.readFileSftp(path);
            } else {
                return await this.readFileFtp(path);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost while reading file, attempting to reconnect...');
                await this.reconnect();
                // Retry the operation after reconnecting
                if (this.config.protocol === 'sftp') {
                    return await this.readFileSftp(path);
                } else {
                    return await this.readFileFtp(path);
                }
            }
            throw error;
        }
    }

    async writeFile(path: string, content: string): Promise<void> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        try {
            if (this.config.protocol === 'sftp') {
                await this.writeFileSftp(path, content);
            } else {
                await this.writeFileFtp(path, content);
            }
        } catch (error) {
            if (this.isConnectionError(error)) {
                console.log('Connection lost while writing file, attempting to reconnect...');
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
        }
    }

    private async connectSftp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        this.sftpClient = new SftpClient();
        try {
            const connectionTimeout = this.config.connectionTimeout || 20000;
            const connectOptions: any = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                readyTimeout: connectionTimeout,
                retries: 0, // We handle retries at a higher level now
                keepaliveInterval: this.config.enableKeepAlive !== false ? 
                    (this.config.keepAliveInterval || 30000) : 0
            };

            if (this.config.authType === 'key' && this.config.keyPath) {
                // SSH key authentication
                try {
                    const keyData = fs.readFileSync(this.config.keyPath, 'utf8');
                    
                    // Check if it's a PuTTY .ppk file and use ssh2-sftp-client's built-in PPK support
                    if (keyData.startsWith('PuTTY-User-Key-File-')) {
                        
                        // ssh2-sftp-client (which uses ssh2) can handle PPK files directly
                        // Just pass the raw PPK data and passphrase
                        connectOptions.privateKey = keyData;
                        if (this.config.passphrase) {
                            connectOptions.passphrase = this.config.passphrase;
                        }
                    } else {
                        // For standard OpenSSH/PEM keys, use raw key data
                        connectOptions.privateKey = keyData;
                        if (this.config.passphrase) {
                            connectOptions.passphrase = this.config.passphrase;
                        }
                    }
                } catch (keyError) {
                    throw new Error(`Failed to process SSH key from ${this.config.keyPath}: ${keyError}`);
                }
            } else {
                // Password authentication
                connectOptions.password = this.config.password;
            }

            await this.sftpClient.connect(connectOptions);
        } catch (error) {
            console.error('SFTP connection failed:', error);
            throw new Error(`SFTP connection failed: ${(error as any).message || error}`);
        }
    }

    private async connectFtp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        // Set custom timeout for FTP via constructor
        const connectionTimeout = this.config.connectionTimeout || 30000;
        this.ftpClient = new FtpClient(connectionTimeout);
        try {
            await this.ftpClient.access({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password
            });
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

        const chunks: Buffer[] = [];
        await this.withOperationTimeout(
            this.ftpClient.downloadTo({
                write: (chunk: Buffer) => chunks.push(chunk),
                close: () => {}
            } as any, path),
            'read file'
        );
        
        return Buffer.concat(chunks).toString();
    }

    private async writeFileSftp(path: string, content: string): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        await this.withOperationTimeout(
            this.sftpClient.put(Buffer.from(content), path),
            'write file'
        );
    }

    private async writeFileFtp(path: string, content: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');

        await this.withOperationTimeout(
            this.ftpClient.uploadFrom({
                read: () => Buffer.from(content),
                close: () => {}
            } as any, path),
            'write file'
        );
    }

    async deleteFile(path: string, isDirectory: boolean = false): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

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
        }
    }

    async renameFile(oldPath: string, newPath: string): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

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
        }
    }

    async fileExists(path: string): Promise<boolean> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

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
        }
    }

    async copyFile(sourcePath: string, targetPath: string, isDirectory: boolean = false): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to server');
        }

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
        console.log('Attempting to reconnect to server...');
        
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
                
                console.log('Successfully reconnected to server');
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
                    console.log('Keep-alive recovered');
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

        console.log(`Keep-alive started with ${interval}ms interval`);
    }

    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = undefined;
            console.log('Keep-alive stopped');
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
}
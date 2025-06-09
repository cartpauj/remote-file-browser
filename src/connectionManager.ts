import * as SftpClient from 'ssh2-sftp-client';
import { Client as FtpClient } from 'basic-ftp';
import * as fs from 'fs';
import * as sshpk from 'sshpk';

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

    async connect(config: ConnectionConfig): Promise<void> {
        this.config = config;

        if (config.protocol === 'sftp') {
            await this.connectSftp();
        } else {
            await this.connectFtp();
        }

        this.connected = true;
    }

    async disconnect(): Promise<void> {
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

        if (this.config.protocol === 'sftp') {
            return this.listFilesSftp(path);
        } else {
            return this.listFilesFtp(path);
        }
    }

    async readFile(path: string): Promise<string> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        if (this.config.protocol === 'sftp') {
            return this.readFileSftp(path);
        } else {
            return this.readFileFtp(path);
        }
    }

    async writeFile(path: string, content: string): Promise<void> {
        if (!this.connected || !this.config) {
            throw new Error('Not connected to remote server');
        }

        if (this.config.protocol === 'sftp') {
            return this.writeFileSftp(path, content);
        } else {
            return this.writeFileFtp(path, content);
        }
    }

    private async connectSftp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        console.log('Connecting to SFTP:', {
            host: this.config.host,
            port: this.config.port,
            username: this.config.username
        });

        this.sftpClient = new SftpClient();
        try {
            const connectOptions: any = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                readyTimeout: 20000,
                retries: 1
            };

            if (this.config.authType === 'key' && this.config.keyPath) {
                // SSH key authentication
                try {
                    const keyData = fs.readFileSync(this.config.keyPath, 'utf8');
                    
                    // Check if it's a PuTTY .ppk file and convert to OpenSSH format
                    if (keyData.startsWith('PuTTY-User-Key-File-')) {
                        console.log('Detected PuTTY .ppk file, converting to OpenSSH format');
                        try {
                            // Parse PPK file with better error handling
                            const parseOptions: any = { filename: this.config.keyPath };
                            if (this.config.passphrase) {
                                parseOptions.passphrase = this.config.passphrase;
                            }
                            
                            const key = sshpk.parseKey(keyData, 'putty', parseOptions);
                            connectOptions.privateKey = key.toString('openssh');
                            console.log('Successfully converted .ppk file to OpenSSH format');
                        } catch (ppkError) {
                            console.error('PPK parsing error details:', ppkError);
                            throw new Error(`Failed to convert PuTTY .ppk file: ${ppkError}. Ensure the file is a valid PuTTY private key and the passphrase is correct.`);
                        }
                    } else {
                        // Try to parse as standard OpenSSH/PEM key first
                        try {
                            console.log('Attempting to parse as OpenSSH/PEM key');
                            const parseOptions: any = { filename: this.config.keyPath };
                            if (this.config.passphrase) {
                                parseOptions.passphrase = this.config.passphrase;
                            }
                            
                            // Validate key format before using
                            const key = sshpk.parseKey(keyData, 'auto', parseOptions);
                            connectOptions.privateKey = key.toString('openssh');
                            console.log('Successfully parsed key as OpenSSH format');
                        } catch (parseError) {
                            console.error('Key parsing error:', parseError);
                            // Fallback to raw key data if sshpk fails
                            console.log('Falling back to raw key data');
                            connectOptions.privateKey = keyData;
                            if (this.config.passphrase) {
                                connectOptions.passphrase = this.config.passphrase;
                            }
                        }
                    }
                    console.log('Using SSH key authentication');
                } catch (keyError) {
                    throw new Error(`Failed to process SSH key from ${this.config.keyPath}: ${keyError}`);
                }
            } else {
                // Password authentication
                connectOptions.password = this.config.password;
                console.log('Using password authentication');
            }

            await this.sftpClient.connect(connectOptions);
        } catch (error) {
            console.error('SFTP connection failed:', error);
            throw new Error(`SFTP connection failed: ${(error as any).message || error}`);
        }
    }

    private async connectFtp(): Promise<void> {
        if (!this.config) throw new Error('No configuration provided');

        console.log('Connecting to FTP:', {
            host: this.config.host,
            port: this.config.port,
            username: this.config.username
        });

        this.ftpClient = new FtpClient();
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

        const chunks: Buffer[] = [];
        await this.ftpClient.downloadTo({
            write: (chunk: Buffer) => chunks.push(chunk),
            close: () => {}
        } as any, path);
        
        return Buffer.concat(chunks).toString();
    }

    private async writeFileSftp(path: string, content: string): Promise<void> {
        if (!this.sftpClient) throw new Error('SFTP client not connected');

        await this.sftpClient.put(Buffer.from(content), path);
    }

    private async writeFileFtp(path: string, content: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');

        await this.ftpClient.uploadFrom({
            read: () => Buffer.from(content),
            close: () => {}
        } as any, path);
    }

    getConnectionInfo(): ConnectionConfig | undefined {
        return this.config;
    }
}
import SftpClient from 'pure-js-sftp';
import { Client as FtpClient } from 'basic-ftp';
import * as fs from 'fs';
import { Readable, Writable, PassThrough } from 'stream';
import { parseFromFile, parseFromString } from 'ppk-to-openssh';

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
        this.ftpConnectionLock = false;
        
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

        console.log('='.repeat(80));
        console.log('[ConnectionManager] 🚀 STARTING SFTP CONNECTION WITH COMPREHENSIVE DEBUG');
        console.log('='.repeat(80));
        
        // COMPREHENSIVE CREDENTIAL VALIDATION AND DEBUGGING
        console.log('🔍'.repeat(60));
        console.log('[ConnectionManager] 🔍 COMPREHENSIVE CREDENTIAL VALIDATION');
        console.log('🔍'.repeat(60));
        
        // Validate and debug ALL connection parameters
        console.log('[ConnectionManager] 📋 Raw Configuration Received:');
        console.log(`  - protocol: "${this.config.protocol}"`);
        console.log(`  - host: "${this.config.host}"`);
        console.log(`  - port: ${this.config.port} (type: ${typeof this.config.port})`);
        console.log(`  - username: "${this.config.username}"`);
        console.log(`  - authType: "${this.config.authType}"`);
        console.log(`  - keyPath: "${this.config.keyPath}"`);
        console.log(`  - passphrase: ${this.config.passphrase ? `"${this.config.passphrase}" (${this.config.passphrase.length} chars)` : 'NONE'}`);
        console.log(`  - password: ${this.config.password ? `"${this.config.password}" (${this.config.password.length} chars)` : 'NONE'}`);
        console.log(`  - remotePath: "${this.config.remotePath}"`);
        
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
                    console.log(`[ConnectionManager] ✅ Key file validation:`);
                    console.log(`  - File exists: YES`);
                    console.log(`  - File size: ${keyStats.size} bytes`);
                    console.log(`  - File mode: ${keyStats.mode.toString(8)}`);
                    console.log(`  - Is file: ${keyStats.isFile()}`);
                    console.log(`  - Modified: ${keyStats.mtime}`);
                    
                    // Test read permissions
                    const testRead = fs.readFileSync(this.config.keyPath, { encoding: 'utf8', flag: 'r' });
                    console.log(`  - Readable: YES (${testRead.length} chars)`);
                    console.log(`  - Starts with: "${testRead.substring(0, 50)}..."`);
                    
                    // Detect key format
                    if (testRead.startsWith('-----BEGIN')) {
                        console.log(`  - Format: OpenSSH/PEM`);
                        
                        // Check if encrypted
                        if (testRead.includes('ENCRYPTED')) {
                            console.log(`  - Encryption: ENCRYPTED (requires passphrase)`);
                            if (!this.config.passphrase) {
                                validationErrors.push('Encrypted key requires a passphrase');
                            }
                        } else {
                            console.log(`  - Encryption: NOT ENCRYPTED`);
                        }
                    } else if (testRead.startsWith('PuTTY-User-Key-File-')) {
                        console.log(`  - Format: PPK (PuTTY format)`);
                        if (testRead.includes('Encryption:') && !testRead.includes('Encryption: none')) {
                            console.log(`  - Encryption: ENCRYPTED (requires passphrase)`);
                            if (!this.config.passphrase) {
                                validationErrors.push('Encrypted PPK key requires a passphrase');
                            }
                        } else {
                            console.log(`  - Encryption: NOT ENCRYPTED`);
                        }
                    } else {
                        console.log(`  - Format: UNKNOWN/UNSUPPORTED`);
                        validationErrors.push('Key file format not recognized (should start with -----BEGIN or PuTTY-User-Key-File-)');
                    }
                    
                } catch (keyError: any) {
                    console.error(`[ConnectionManager] ❌ Key file validation failed:`, keyError.message);
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
        } else {
            console.log('[ConnectionManager] ✅ All credentials validated successfully!');
        }
        
        // Compare with working test credentials
        console.log('\n🧪'.repeat(60));
        console.log('[ConnectionManager] 🧪 COMPARING WITH KNOWN WORKING CREDENTIALS');
        console.log('🧪'.repeat(60));
        
        const workingTestCreds = {
            host: '142.93.27.188',
            port: 2390,
            username: 'cartpauj',
            keyPath: '/home/cartpauj/cartpauj-github/remote-file-browser/test-credentials.pem',
            passphrase: 'Head7Tail7Butt0'
        };
        
        console.log('[ConnectionManager] 📊 Credential Comparison:');
        console.log(`  Host: "${this.config.host}" vs "${workingTestCreds.host}" - ${this.config.host === workingTestCreds.host ? '✅ MATCH' : '❌ DIFFERENT'}`);
        console.log(`  Port: ${this.config.port} vs ${workingTestCreds.port} - ${this.config.port === workingTestCreds.port ? '✅ MATCH' : '❌ DIFFERENT'}`);
        console.log(`  Username: "${this.config.username}" vs "${workingTestCreds.username}" - ${this.config.username === workingTestCreds.username ? '✅ MATCH' : '❌ DIFFERENT'}`);
        console.log(`  KeyPath: "${this.config.keyPath}" vs "${workingTestCreds.keyPath}" - ${this.config.keyPath === workingTestCreds.keyPath ? '✅ MATCH' : '❌ DIFFERENT'}`);
        console.log(`  Passphrase: "${this.config.passphrase}" vs "${workingTestCreds.passphrase}" - ${this.config.passphrase === workingTestCreds.passphrase ? '✅ MATCH' : '❌ DIFFERENT'}`);
        
        // If any differences, highlight them
        const differences: string[] = [];
        if (this.config.host !== workingTestCreds.host) differences.push(`Host: got "${this.config.host}", expected "${workingTestCreds.host}"`);
        if (this.config.port !== workingTestCreds.port) differences.push(`Port: got ${this.config.port}, expected ${workingTestCreds.port}`);
        if (this.config.username !== workingTestCreds.username) differences.push(`Username: got "${this.config.username}", expected "${workingTestCreds.username}"`);
        if (this.config.keyPath !== workingTestCreds.keyPath) differences.push(`KeyPath: got "${this.config.keyPath}", expected "${workingTestCreds.keyPath}"`);
        if (this.config.passphrase !== workingTestCreds.passphrase) differences.push(`Passphrase: got "${this.config.passphrase}", expected "${workingTestCreds.passphrase}"`);
        
        if (differences.length > 0) {
            console.log('\n⚠️ [ConnectionManager] CREDENTIAL DIFFERENCES DETECTED:');
            differences.forEach((diff, index) => {
                console.log(`  ${index + 1}. ${diff}`);
            });
            console.log('\n💡 [ConnectionManager] If connection fails, try using the working test credentials!');
        } else {
            console.log('\n✅ [ConnectionManager] ALL CREDENTIALS MATCH WORKING TEST - Connection should succeed!');
        }
        
        // Debug environment
        console.log('\n🔧'.repeat(60));
        console.log('[ConnectionManager] 🔧 Environment Debug:');
        console.log(`  - Node version: ${process.version}`);
        console.log(`  - Platform: ${process.platform}`);
        console.log(`  - Arch: ${process.arch}`);
        console.log(`  - VSCode Extension Host: ${typeof process.versions.electron !== 'undefined'}`);
        console.log(`  - Webpack bundled: ${typeof (global as any).__webpack_require__ !== 'undefined'}`);
        
        // Debug global state
        console.log('[ConnectionManager] 🌍 Global State:');
        console.log(`  - global.process exists: ${typeof (global as any).process !== 'undefined'}`);
        console.log(`  - global.Buffer exists: ${typeof (global as any).Buffer !== 'undefined'}`);
        
        // Force pure JS mode and debug it
        console.log('[ConnectionManager] 🔧 Setting Pure JS Mode:');
        (global as any).process = (global as any).process || {};
        (global as any).process.env = (global as any).process.env || {};
        (global as any).process.env.SSH2_NO_NATIVE = '1';
        console.log(`  - SSH2_NO_NATIVE set to: ${(global as any).process.env.SSH2_NO_NATIVE}`);
        
        // Apply crypto fix BEFORE creating client
        console.log('[ConnectionManager] 🔐 Applying Crypto Fix...');
        this.applyCryptoFix();
        
        // Debug module loading
        console.log('[ConnectionManager] 📦 Module Loading Debug:');
        try {
            const SftpClient = require('pure-js-sftp').SftpClient || require('pure-js-sftp').default || require('pure-js-sftp');
            console.log(`  - pure-js-sftp module loaded: ${typeof SftpClient}`);
            console.log(`  - Constructor name: ${SftpClient.name}`);
            console.log(`  - Constructor prototype: ${Object.getOwnPropertyNames(SftpClient.prototype)}`);
        } catch (modError) {
            console.error(`  - pure-js-sftp module error:`, modError);
        }
        
        // Try to work around webpack bundling issues by dynamically creating the client
        try {
            console.log('[ConnectionManager] 🏗️ Creating SFTP Client...');
            this.sftpClient = new SftpClient('remote-file-browser-debug');
            console.log('[ConnectionManager] ✅ SFTP client created successfully');
            console.log(`  - Client type: ${typeof this.sftpClient}`);
            console.log(`  - Client constructor: ${this.sftpClient.constructor.name}`);
            console.log(`  - Client methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.sftpClient))}`);
        } catch (clientError: any) {
            console.error('[ConnectionManager] ❌ Failed to create SFTP client:', clientError);
            console.error(`  - Error type: ${typeof clientError}`);
            console.error(`  - Error name: ${clientError?.name}`);
            console.error(`  - Error message: ${clientError?.message}`);
            console.error(`  - Error stack: ${clientError?.stack}`);
            throw new Error(`Failed to create SFTP client: ${clientError?.message || clientError}`);
        }
        
        try {
            console.log('-'.repeat(60));
            console.log('[ConnectionManager] 🔑 BUILDING CONNECTION OPTIONS');
            console.log('-'.repeat(60));
            
            // pure-js-sftp only accepts specific options per SSH2StreamsConfig interface
            const connectOptions: any = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username
            };
            
            console.log('[ConnectionManager] 📋 Basic Connection Options:');
            console.log(`  - Host: ${connectOptions.host}`);
            console.log(`  - Port: ${connectOptions.port}`);
            console.log(`  - Username: ${connectOptions.username}`);
            console.log(`  - Auth Type: ${this.config.authType}`);
            
            if (this.config.authType?.toLowerCase() === 'key' && this.config.keyPath) {
                console.log('[ConnectionManager] 🔐 SSH Key Authentication Mode');
                console.log(`  - Key Path: ${this.config.keyPath}`);
                console.log(`  - Has Passphrase: ${!!this.config.passphrase}`);
                
                // SSH key authentication
                try {
                    console.log('[ConnectionManager] 📖 Reading SSH Key File...');
                    const privateKey = fs.readFileSync(this.config.keyPath);
                    console.log(`  - File size: ${privateKey.length} bytes`);
                    
                    // Handle PPK files
                    const keyString = privateKey.toString('utf8');
                    console.log(`  - Key format detection: ${keyString.startsWith('PuTTY-User-Key-File-') ? 'PPK' : keyString.startsWith('-----BEGIN') ? 'OpenSSH/PEM' : 'Unknown'}`);
                    console.log(`  - Key starts with: ${keyString.substring(0, 50)}...`);
                    
                    if (keyString.startsWith('PuTTY-User-Key-File-')) {
                        console.log('[ConnectionManager] 🔄 Converting PPK to OpenSSH format...');
                        try {
                            const result = await parseFromString(keyString, this.config.passphrase);
                            connectOptions.privateKey = Buffer.from(result.privateKey, 'utf8');
                            console.log(`  - PPK conversion successful, new size: ${connectOptions.privateKey.length}`);
                        } catch (ppkError) {
                            console.error('[ConnectionManager] ❌ PPK Conversion Failed:', ppkError);
                            const errorMessage = ppkError instanceof Error ? ppkError.message : String(ppkError);
                            
                            if (errorMessage.includes('passphrase') || errorMessage.includes('password') || errorMessage.includes('decrypt')) {
                                throw new Error(`Failed to decrypt PPK file: Invalid passphrase or corrupted key file. ${errorMessage}`);
                            } else if (errorMessage.includes('unsupported') || errorMessage.includes('format')) {
                                throw new Error(`Unsupported PPK format: ${errorMessage}. Please ensure the file is a valid PuTTY private key.`);
                            }
                            
                            throw new Error(`Failed to convert PPK file: ${errorMessage}`);
                        }
                    } else {
                        console.log('[ConnectionManager] ✅ Using key as-is (OpenSSH/PEM format)');
                        connectOptions.privateKey = privateKey;
                    }
                    
                    if (this.config.passphrase) {
                        connectOptions.passphrase = this.config.passphrase;
                        console.log(`  - Passphrase added: ${this.config.passphrase.length} characters`);
                    }
                    
                    console.log('-'.repeat(40));
                    console.log('[ConnectionManager] 🔍 MANUAL KEY PARSING TEST');
                    console.log('-'.repeat(40));
                    
                    // Debug: Test key parsing manually to see what's happening
                    try {
                        const ssh2streams = require('ssh2-streams');
                        console.log(`  - ssh2-streams loaded: ${typeof ssh2streams}`);
                        console.log(`  - ssh2streams.utils exists: ${!!ssh2streams.utils}`);
                        console.log(`  - parseKey function exists: ${!!ssh2streams.utils?.parseKey}`);
                        
                        if (ssh2streams.utils && ssh2streams.utils.parseKey) {
                            console.log('[ConnectionManager] 🧪 Testing manual key parsing...');
                            console.log(`  - Key buffer length: ${connectOptions.privateKey.length}`);
                            console.log(`  - Key buffer type: ${connectOptions.privateKey.constructor.name}`);
                            console.log(`  - Passphrase: ${connectOptions.passphrase ? `"${connectOptions.passphrase}"` : 'none'}`);
                            
                            const parsedKeys = ssh2streams.utils.parseKey(connectOptions.privateKey, connectOptions.passphrase);
                            console.log(`  - Parse result type: ${typeof parsedKeys}`);
                            console.log(`  - Parse result length: ${Array.isArray(parsedKeys) ? parsedKeys.length : 'not array'}`);
                            
                            if (parsedKeys && parsedKeys.length > 0) {
                                const key = parsedKeys[0];
                                console.log('[ConnectionManager] ✅ Manual parse SUCCESSFUL!');
                                console.log(`  - Key type: ${key.type}`);
                                console.log(`  - Key size: ${key.size}`);
                                console.log(`  - Key comment: ${key.comment || 'none'}`);
                                console.log(`  - Has sign function: ${typeof key.sign === 'function'}`);
                                console.log(`  - Has getPublicSSH: ${typeof key.getPublicSSH === 'function'}`);
                                console.log(`  - Has getPrivatePEM: ${typeof key.getPrivatePEM === 'function'}`);
                                
                                // Check if we can get the public key
                                if (key.getPublicSSH) {
                                    try {
                                        const pubKey = key.getPublicSSH();
                                        console.log(`  - Public key extracted: ${pubKey.length} bytes`);
                                        console.log(`  - Public key base64 preview: ${pubKey.toString('base64').substring(0, 60)}...`);
                                        
                                        // Parse the SSH public key format
                                        if (pubKey.length >= 4) {
                                            const keyTypeLen = pubKey.readUInt32BE(0);
                                            if (keyTypeLen > 0 && keyTypeLen < pubKey.length) {
                                                const keyType = pubKey.slice(4, 4 + keyTypeLen).toString();
                                                console.log(`  - SSH key type from public key: ${keyType}`);
                                            }
                                        }
                                    } catch (pubError) {
                                        console.error('[ConnectionManager] ❌ Public key extraction failed:', pubError);
                                    }
                                }
                                
                                // Test signing capability
                                if (key.sign) {
                                    try {
                                        console.log('[ConnectionManager] 🧪 Testing signing function...');
                                        const testData = Buffer.from('test-signing-data-12345');
                                        console.log(`  - Test data: ${testData.length} bytes`);
                                        
                                        const signature = key.sign(testData);
                                        console.log(`  - Signature result type: ${typeof signature}`);
                                        console.log(`  - Signature is Error: ${signature instanceof Error}`);
                                        
                                        if (signature instanceof Error) {
                                            console.error(`  - Signing error: ${signature.message}`);
                                        } else if (Buffer.isBuffer(signature)) {
                                            console.log(`  - Signature length: ${signature.length} bytes`);
                                            console.log(`  - Signature preview: ${signature.toString('hex').substring(0, 40)}...`);
                                        }
                                    } catch (signError) {
                                        console.error('[ConnectionManager] ❌ Signing test failed:', signError);
                                    }
                                }
                            } else {
                                console.error('[ConnectionManager] ❌ Manual key parse FAILED - no keys returned');
                                console.log(`  - Returned value: ${JSON.stringify(parsedKeys)}`);
                            }
                        } else {
                            console.error('[ConnectionManager] ❌ ssh2-streams.utils.parseKey not available');
                        }
                    } catch (manualParseError) {
                        console.error('[ConnectionManager] ❌ Manual key parse ERROR:', manualParseError);
                        console.error(`  - Error type: ${typeof manualParseError}`);
                        console.error(`  - Error name: ${(manualParseError as any)?.name}`);
                        console.error(`  - Error message: ${(manualParseError as any)?.message}`);
                        console.error(`  - Error stack: ${(manualParseError as any)?.stack}`);
                    }
                } catch (keyError) {
                    const errorMessage = keyError instanceof Error ? keyError.message : String(keyError);
                    
                    if (errorMessage.includes('PPK') || errorMessage.includes('passphrase') || errorMessage.includes('decrypt')) {
                        throw keyError;
                    }
                    
                    if (errorMessage.includes('ENOENT')) {
                        throw new Error(`SSH key file not found: ${this.config.keyPath}`);
                    }
                    
                    throw new Error(`Failed to process SSH key from ${this.config.keyPath}: ${errorMessage}`);
                }
            } else {
                console.log('[ConnectionManager] 🔑 Password Authentication Mode');
                connectOptions.password = this.config.password;
                console.log(`  - Password length: ${this.config.password?.length || 0} characters`);
            }
            
            console.log('-'.repeat(60));
            console.log('[ConnectionManager] 🚀 INITIATING CONNECTION');
            console.log('-'.repeat(60));
            
            console.log('[ConnectionManager] 📤 Final Connection Options:');
            console.log(`  - Host: ${connectOptions.host}`);
            console.log(`  - Port: ${connectOptions.port}`);
            console.log(`  - Username: ${connectOptions.username}`);
            console.log(`  - Has privateKey: ${!!connectOptions.privateKey}`);
            console.log(`  - PrivateKey type: ${connectOptions.privateKey ? connectOptions.privateKey.constructor.name : 'none'}`);
            console.log(`  - PrivateKey length: ${connectOptions.privateKey ? connectOptions.privateKey.length : 0} bytes`);
            console.log(`  - Has passphrase: ${!!connectOptions.passphrase}`);
            console.log(`  - Has password: ${!!connectOptions.password}`);
            
            // Add error handling around the specific connect call
            try {
                console.log('[ConnectionManager] 🔌 Calling pure-js-sftp.connect()...');
                console.log(`  - Client ready: ${!!this.sftpClient}`);
                console.log(`  - Connect method exists: ${typeof this.sftpClient?.connect === 'function'}`);
                
                const connectStartTime = Date.now();
                await this.sftpClient.connect(connectOptions);
                const connectDuration = Date.now() - connectStartTime;
                
                console.log('='.repeat(80));
                console.log('[ConnectionManager] 🎉 SFTP CONNECTION SUCCESSFUL!');
                console.log(`  - Connection time: ${connectDuration}ms`);
                console.log('='.repeat(80));
            } catch (connectError: any) {
                console.log('='.repeat(80));
                console.error('[ConnectionManager] ❌ SFTP CONNECTION FAILED!');
                console.log('='.repeat(80));
                console.error('[ConnectionManager] 🔍 Connect Error Analysis:');
                console.error(`  - Error type: ${typeof connectError}`);
                console.error(`  - Error constructor: ${connectError?.constructor?.name}`);
                console.error(`  - Error name: ${connectError?.name}`);
                console.error(`  - Error message: "${connectError?.message}"`);
                console.error(`  - Error code: ${connectError?.code}`);
                console.error(`  - Error level: ${connectError?.level}`);
                console.error(`  - Error errno: ${connectError?.errno}`);
                console.error(`  - Error syscall: ${connectError?.syscall}`);
                console.error(`  - Error address: ${connectError?.address}`);
                console.error(`  - Error port: ${connectError?.port}`);
                
                if (connectError?.stack) {
                    console.error('[ConnectionManager] 📚 Full Error Stack:');
                    console.error(connectError.stack);
                }
                
                // Try to identify specific error types
                const errorMsg = connectError?.message?.toLowerCase() || '';
                if (errorMsg.includes('authentication')) {
                    console.error('[ConnectionManager] 🔐 AUTHENTICATION ERROR DETECTED');
                    console.error('  - This suggests the SSH handshake completed but auth failed');
                    console.error('  - Server may be rejecting our public key or signature');
                } else if (errorMsg.includes('connection') || errorMsg.includes('connect')) {
                    console.error('[ConnectionManager] 🌐 CONNECTION ERROR DETECTED');
                    console.error('  - This suggests network-level connection issues');
                } else if (errorMsg.includes('timeout')) {
                    console.error('[ConnectionManager] ⏰ TIMEOUT ERROR DETECTED');
                    console.error('  - Connection or operation timed out');
                }
                
                console.log('='.repeat(80));
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

            await this.ftpClient.access({
                host: this.config.host,
                port: this.config.port,
                user: username,
                password: password
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

        await this.withOperationTimeout(
            this.sftpClient.put(Buffer.from(content), path),
            'write file'
        );
    }

    private async writeFileFtp(path: string, content: string): Promise<void> {
        if (!this.ftpClient) throw new Error('FTP client not connected');
        
        // Check if connection is still alive and reconnect if needed
        await this.ensureFtpConnection();

        // Create a readable stream from the content
        const buffer = Buffer.from(content);
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null); // End of stream

        await this.withOperationTimeout(
            this.ftpClient.uploadFrom(stream, path),
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
                console.log('FTP connection was closed, reconnecting...');
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

    private applyCryptoFix(): void {
        console.log('💠'.repeat(40));
        console.log('[ConnectionManager] 🔐 APPLYING COMPREHENSIVE CRYPTO FIX');
        console.log('💠'.repeat(40));
        
        // Fix 1: Patch ssh2-streams utils.parseKey
        try {
            const ssh2streams = require('ssh2-streams');
            console.log('[ConnectionManager] 📦 ssh2-streams module analysis:');
            console.log(`  - Module type: ${typeof ssh2streams}`);
            console.log(`  - Has utils: ${!!ssh2streams.utils}`);
            console.log(`  - Utils type: ${typeof ssh2streams.utils}`);
            console.log(`  - Has parseKey: ${!!ssh2streams.utils?.parseKey}`);
            console.log(`  - parseKey type: ${typeof ssh2streams.utils?.parseKey}`);
            
            if (ssh2streams.utils && ssh2streams.utils.parseKey) {
                console.log('[ConnectionManager] ✅ Patching ssh2-streams.utils.parseKey...');
                const originalParseKey = ssh2streams.utils.parseKey;
                console.log(`  - Original parseKey: ${typeof originalParseKey}`);
                
                ssh2streams.utils.parseKey = function(keyData: any, passphrase: any) {
                    console.log('🔑'.repeat(40));
                    console.log('[CRYPTO-FIX] 🎯 parseKey INTERCEPTED!');
                    console.log('🔑'.repeat(40));
                    console.log(`  - keyData type: ${typeof keyData}`);
                    console.log(`  - keyData constructor: ${keyData?.constructor?.name}`);
                    console.log(`  - keyData length: ${keyData?.length || 'unknown'}`);
                    console.log(`  - passphrase type: ${typeof passphrase}`);
                    console.log(`  - passphrase length: ${passphrase?.length || 0}`);
                    
                    const result = originalParseKey.call(this, keyData, passphrase);
                    console.log(`  - Parse result type: ${typeof result}`);
                    console.log(`  - Parse result is array: ${Array.isArray(result)}`);
                    console.log(`  - Parse result length: ${result?.length || 0}`);
                    
                    if (result && result.length > 0) {
                        console.log('[CRYPTO-FIX] ✅ Key parsed successfully!');
                        for (let i = 0; i < result.length; i++) {
                            const key = result[i];
                            console.log(`  - Key ${i}: type=${key?.type}, size=${key?.size}, comment=${key?.comment || 'none'}`);
                            console.log(`  - Key ${i}: sign=${typeof key?.sign}, getPublicSSH=${typeof key?.getPublicSSH}, getPrivatePEM=${typeof key?.getPrivatePEM}`);
                        }
                        
                        // Fix crypto signing for webpack bundled environment
                        if (result[0]?.sign) {
                            console.log('[CRYPTO-FIX] 🔧 Patching sign function...');
                            const originalSign = result[0].sign;
                            const parsedKey = result[0];
                            
                            console.log(`  - Original sign function type: ${typeof originalSign}`);
                            
                            // Get PEM key for fallback crypto
                            let pemKey = null;
                            try {
                                if (parsedKey.getPrivatePEM && typeof parsedKey.getPrivatePEM === 'function') {
                                    pemKey = parsedKey.getPrivatePEM();
                                    console.log('[CRYPTO-FIX] ✅ PEM private key extracted for fallback');
                                    console.log(`  - PEM key length: ${pemKey?.length || 0}`);
                                    console.log(`  - PEM starts with: ${pemKey?.substring(0, 50) || 'none'}...`);
                                }
                            } catch (e) {
                                console.error('[CRYPTO-FIX] ❌ Failed to extract PEM key:', e);
                            }
                            
                            result[0].sign = function(buf: any) {
                                console.log('🖊️'.repeat(30));
                                console.log('[CRYPTO-FIX] 🖊️ SIGN FUNCTION CALLED!');
                                console.log('🖊️'.repeat(30));
                                
                                if (!buf || !Buffer.isBuffer(buf)) {
                                    console.error('[CRYPTO-FIX] ❌ Invalid buffer for signing');
                                    throw new Error('Invalid buffer for signing');
                                }
                                
                                console.log(`  - Data to sign: ${buf.length} bytes`);
                                console.log(`  - Data preview: ${buf.toString('hex').substring(0, 40)}...`);
                                
                                // Try original signing first
                                console.log('[CRYPTO-FIX] 🧪 Trying original signing...');
                                let signature = originalSign.call(this, buf);
                                console.log(`  - Original result type: ${typeof signature}`);
                                console.log(`  - Original is Error: ${signature instanceof Error}`);
                                
                                // Check if original signing failed
                                if (signature instanceof Error) {
                                    console.log('[CRYPTO-FIX] ⚠️ Original signing FAILED, trying jsrsasign fallback...');
                                    console.log(`  - Original error: ${signature.message}`);
                                    
                                    if (pemKey) {
                                        try {
                                            console.log('[CRYPTO-FIX] 🔄 Using jsrsasign fallback...');
                                            const KJUR = require('jsrsasign');
                                            console.log(`  - KJUR loaded: ${typeof KJUR}`);
                                            
                                            const rsaKey = KJUR.KEYUTIL.getKey(pemKey);
                                            console.log(`  - RSA key loaded: ${typeof rsaKey}`);
                                            
                                            const sig = new KJUR.KJUR.crypto.Signature({ alg: "SHA256withRSA" });
                                            console.log(`  - Signature object created: ${typeof sig}`);
                                            
                                            sig.init(rsaKey);
                                            console.log(`  - Signature initialized`);
                                            
                                            sig.updateHex(buf.toString('hex'));
                                            console.log(`  - Data updated`);
                                            
                                            const sigHex = sig.sign();
                                            console.log(`  - Signature generated: ${sigHex?.length || 0} hex chars`);
                                            
                                            // Convert to Buffer - return raw signature, ssh2-streams will format it
                                            const rawRsaSignature = Buffer.from(sigHex, 'hex');
                                            
                                            console.log(`  - Raw RSA signature: ${rawRsaSignature.length} bytes`);
                                            console.log(`  - Raw signature preview: ${rawRsaSignature.toString('hex').substring(0, 40)}...`);
                                            
                                            console.log('[CRYPTO-FIX] ✅ jsrsasign fallback SUCCEEDED! (returning raw signature for ssh2-streams to format)');
                                            signature = rawRsaSignature;
                                        } catch (jsRsaError) {
                                            console.error('[CRYPTO-FIX] ❌ jsrsasign fallback FAILED:', jsRsaError);
                                            console.error(`  - jsRsaError type: ${typeof jsRsaError}`);
                                            console.error(`  - jsRsaError message: ${(jsRsaError as any)?.message}`);
                                            throw signature; // Throw original error
                                        }
                                    } else {
                                        console.error('[CRYPTO-FIX] ❌ No PEM key available for fallback');
                                        throw signature;
                                    }
                                } else {
                                    console.log('[CRYPTO-FIX] ✅ Original signing SUCCEEDED!');
                                    console.log(`  - Signature type: ${typeof signature}`);
                                    console.log(`  - Signature length: ${signature?.length || 0}`);
                                    if (Buffer.isBuffer(signature)) {
                                        console.log(`  - Signature preview: ${signature.toString('hex').substring(0, 40)}...`);
                                    }
                                }
                                
                                console.log('🖊️'.repeat(30));
                                return signature;
                            };
                            
                            console.log('[CRYPTO-FIX] ✅ Sign function patched successfully!');
                        } else {
                            console.log('[CRYPTO-FIX] ⚠️ No sign function found to patch');
                        }
                    } else {
                        console.error('[CRYPTO-FIX] ❌ Key parsing FAILED - no result');
                        console.log(`  - Result value: ${JSON.stringify(result)}`);
                    }
                    
                    console.log('🔑'.repeat(40));
                    return result;
                };
                
                console.log('[ConnectionManager] ✅ ssh2-streams.utils.parseKey patched successfully!');
            } else {
                console.error('[ConnectionManager] ❌ ssh2-streams.utils.parseKey not available for patching');
            }
        } catch (ssh2Error) {
            console.error('[ConnectionManager] ❌ Failed to patch ssh2-streams:', ssh2Error);
        }
        
        // Fix 2: Also patch crypto.sign if available
        console.log('[ConnectionManager] 🔧 Attempting to patch crypto.sign...');
        try {
            const crypto = require('crypto');
            console.log(`  - crypto module loaded: ${typeof crypto}`);
            console.log(`  - crypto.sign exists: ${!!crypto.sign}`);
            console.log(`  - crypto.sign type: ${typeof crypto.sign}`);
            
            if (crypto && crypto.sign) {
                console.log('[ConnectionManager] ✅ Patching crypto.sign...');
                const originalCryptoSign = crypto.sign;
                crypto.sign = function(algorithm: any, data: any, key: any) {
                    console.log('⚡'.repeat(30));
                    console.log('[CRYPTO-FIX] ⚡ crypto.sign CALLED!');
                    console.log('⚡'.repeat(30));
                    console.log(`  - Algorithm: ${algorithm}`);
                    console.log(`  - Data type: ${typeof data}`);
                    console.log(`  - Data length: ${data?.length || 0}`);
                    console.log(`  - Key type: ${typeof key}`);
                    
                    try {
                        const result = originalCryptoSign.call(this, algorithm, data, key);
                        console.log('[CRYPTO-FIX] ✅ crypto.sign succeeded');
                        console.log(`  - Result type: ${typeof result}`);
                        console.log(`  - Result length: ${result?.length || 0}`);
                        console.log('⚡'.repeat(30));
                        return result;
                    } catch (error) {
                        console.error('[CRYPTO-FIX] ❌ crypto.sign failed:', error);
                        console.error(`  - Error type: ${typeof error}`);
                        console.error(`  - Error message: ${(error as any)?.message}`);
                        console.log('⚡'.repeat(30));
                        throw error;
                    }
                };
                console.log('[ConnectionManager] ✅ crypto.sign patched successfully!');
            } else {
                console.log('[ConnectionManager] ⚠️ crypto.sign not available for patching');
            }
        } catch (cryptoError) {
            console.error('[ConnectionManager] ❌ Failed to patch crypto.sign:', cryptoError);
        }
        
        console.log('💠'.repeat(40));
        console.log('[ConnectionManager] 🎉 CRYPTO FIX APPLICATION COMPLETE');
        console.log('💠'.repeat(40));
    }
}
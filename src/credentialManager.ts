import * as vscode from 'vscode';

export class CredentialManager {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Store a password securely for a connection
     */
    async storePassword(connectionId: string, password: string): Promise<boolean> {
        try {
            const key = `remoteFileBrowser.password.${connectionId}`;
            await this.context.secrets.store(key, password);
            return true;
        } catch (error) {
            console.error('Failed to store password in keyring:', error);
            
            // Show user-friendly message about keyring issues
            const choice = await vscode.window.showWarningMessage(
                'Unable to access secure keyring for password storage. This may be due to missing keyring software on your system.',
                'Learn More',
                'Continue Without Saving'
            );
            
            if (choice === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/editor/settings-sync#_troubleshooting-keychain-issues'));
            }
            
            return false;
        }
    }

    /**
     * Retrieve a stored password for a connection
     */
    async getPassword(connectionId: string): Promise<string | undefined> {
        try {
            const key = `remoteFileBrowser.password.${connectionId}`;
            return await this.context.secrets.get(key);
        } catch (error) {
            console.error('Failed to retrieve password from keyring:', error);
            return undefined;
        }
    }

    /**
     * Store an SSH key passphrase securely
     */
    async storePassphrase(connectionId: string, passphrase: string): Promise<boolean> {
        try {
            const key = `remoteFileBrowser.passphrase.${connectionId}`;
            await this.context.secrets.store(key, passphrase);
            return true;
        } catch (error) {
            console.error('Failed to store passphrase in keyring:', error);
            
            // Show user-friendly message about keyring issues
            const choice = await vscode.window.showWarningMessage(
                'Unable to access secure keyring for passphrase storage. This may be due to missing keyring software on your system.',
                'Learn More',
                'Continue Without Saving'
            );
            
            if (choice === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/editor/settings-sync#_troubleshooting-keychain-issues'));
            }
            
            return false;
        }
    }

    /**
     * Retrieve a stored SSH key passphrase
     */
    async getPassphrase(connectionId: string): Promise<string | undefined> {
        try {
            const key = `remoteFileBrowser.passphrase.${connectionId}`;
            return await this.context.secrets.get(key);
        } catch (error) {
            console.error('Failed to retrieve passphrase from keyring:', error);
            return undefined;
        }
    }

    /**
     * Delete stored credentials for a connection
     */
    async deleteCredentials(connectionId: string): Promise<void> {
        const passwordKey = `remoteFileBrowser.password.${connectionId}`;
        const passphraseKey = `remoteFileBrowser.passphrase.${connectionId}`;
        
        await this.context.secrets.delete(passwordKey);
        await this.context.secrets.delete(passphraseKey);
    }

    /**
     * Check if credentials are stored for a connection
     */
    async hasStoredCredentials(connectionId: string): Promise<boolean> {
        const passwordKey = `remoteFileBrowser.password.${connectionId}`;
        const passphraseKey = `remoteFileBrowser.passphrase.${connectionId}`;
        
        const hasPassword = await this.context.secrets.get(passwordKey) !== undefined;
        const hasPassphrase = await this.context.secrets.get(passphraseKey) !== undefined;
        
        return hasPassword || hasPassphrase;
    }

    /**
     * Generate a unique connection ID based on connection details
     */
    static generateConnectionId(connection: any): string {
        return `${connection.protocol || 'sftp'}-${connection.username}-${connection.host}-${connection.port || 22}`;
    }
}
import * as vscode from 'vscode';

const SUCCESS_MESSAGE_DURATION = 3000;
const ERROR_MESSAGE_DURATION = 5000;
const TEMP_MESSAGE_DURATION = 3000;

export class ConnectionStatusManager {
    private statusBarItem: vscode.StatusBarItem;
    private isShowing: boolean = false;
    private connectionManager: any = null;
    private currentTimer?: NodeJS.Timeout;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }

    public setConnectionManager(connectionManager: any) {
        this.connectionManager = connectionManager;
    }

    public showConnecting(host: string) {
        this.statusBarItem.text = `$(sync~spin) Establishing connection to ${host}...`;
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public showAuthenticating(host: string) {
        this.statusBarItem.text = `$(sync~spin) Authenticating to ${host}...`;
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public showLoadingFiles(host: string) {
        this.statusBarItem.text = `$(sync~spin) Loading file structure from ${host}...`;
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public showRetrying(host: string, attempt: number, maxAttempts: number) {
        this.statusBarItem.text = `$(sync~spin) Retrying connection to ${host} (${attempt}/${maxAttempts})...`;
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public showSuccess(host: string) {
        this.statusBarItem.text = `$(check) Connected to ${host}`;
        this.statusBarItem.show();
        this.isShowing = true;
        
        // Auto-hide success message after 3 seconds, then show persistent connected state
        setTimeout(() => {
            this.showConnected(host);
        }, SUCCESS_MESSAGE_DURATION);
    }

    public showConnected(host: string) {
        this.statusBarItem.text = `$(plug) ${host} $(close)`;
        this.statusBarItem.tooltip = `Connected to ${host} - Click to disconnect`;
        this.statusBarItem.command = 'remoteFileBrowser.disconnect';
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public showError(host: string, error: string) {
        this.statusBarItem.text = `$(error) Failed to connect to ${host}: ${error}`;
        this.statusBarItem.show();
        this.isShowing = true;
        
        // Auto-hide error message after 5 seconds
        setTimeout(() => {
            this.hide();
        }, ERROR_MESSAGE_DURATION);
    }

    public showDisconnected() {
        this.statusBarItem.text = '';
        this.statusBarItem.tooltip = '';
        this.statusBarItem.command = undefined;
        this.statusBarItem.hide();
        this.isShowing = false;
    }

    public hide() {
        if (this.isShowing) {
            this.statusBarItem.text = '';
            this.statusBarItem.tooltip = '';
            this.statusBarItem.command = undefined;
            this.statusBarItem.hide();
            this.isShowing = false;
        }
    }

    public showTempMessage(message: string, duration: number = TEMP_MESSAGE_DURATION) {
        // Cancel any existing timer to prevent timer conflicts
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
            this.currentTimer = undefined;
        }
        
        this.statusBarItem.text = `$(info) ${message}`;
        this.statusBarItem.tooltip = message;
        this.statusBarItem.command = undefined;
        this.statusBarItem.show();
        this.isShowing = true;
        
        // If duration is 0, don't auto-hide (persistent message)
        if (duration > 0) {
            this.currentTimer = setTimeout(() => {
                this.currentTimer = undefined;
                
                // Always return to connected state after temp messages - don't restore previous temp messages
                const connectionInfo = this.getConnectedHost();
                if (connectionInfo) {
                    this.showConnected(connectionInfo);
                } else {
                    this.hide();
                }
            }, duration);
        }
    }

    private getConnectedHost(): string | null {
        if (this.connectionManager && this.connectionManager.isConnected()) {
            const connectionInfo = this.connectionManager.getCurrentConnectionInfo();
            return connectionInfo?.host || null;
        }
        return null;
    }

    public showUploadProgress(fileName: string) {
        this.statusBarItem.text = `$(sync~spin) Uploading ${fileName}...`;
        this.statusBarItem.tooltip = `Uploading ${fileName} to server`;
        this.statusBarItem.command = undefined;
        this.statusBarItem.show();
        this.isShowing = true;
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
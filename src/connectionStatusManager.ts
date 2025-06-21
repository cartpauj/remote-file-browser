import * as vscode from 'vscode';

export class ConnectionStatusManager {
    private statusBarItem: vscode.StatusBarItem;
    private isShowing: boolean = false;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
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
        }, 3000);
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
        }, 5000);
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

    public showTempMessage(message: string, duration: number = 3000) {
        const originalText = this.statusBarItem.text;
        const originalTooltip = this.statusBarItem.tooltip;
        const originalCommand = this.statusBarItem.command;
        
        this.statusBarItem.text = `$(info) ${message}`;
        this.statusBarItem.tooltip = message;
        this.statusBarItem.command = undefined;
        this.statusBarItem.show();
        this.isShowing = true;
        
        setTimeout(() => {
            if (originalText) {
                this.statusBarItem.text = originalText;
                this.statusBarItem.tooltip = originalTooltip;
                this.statusBarItem.command = originalCommand;
            } else {
                this.hide();
            }
        }, duration);
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
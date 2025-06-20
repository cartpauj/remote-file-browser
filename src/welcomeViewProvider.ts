import * as vscode from 'vscode';

export interface WelcomeItem {
    label: string;
    description?: string;
    command?: vscode.Command;
    iconPath?: vscode.ThemeIcon;
    connectionIndex?: number;
}

export class WelcomeViewProvider implements vscode.TreeDataProvider<WelcomeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WelcomeItem | undefined | null | void> = new vscode.EventEmitter<WelcomeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WelcomeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private connectingIndexes: Set<number> = new Set();
    private static activeConnections: Set<number> = new Set(); // Global lock across all instances
    private static lastClickTimes: Map<number, number> = new Map(); // Debounce timestamps

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateWelcomeContent(): void {
        this.refresh();
    }

    setConnecting(index: number, connecting: boolean): void {
        if (connecting) {
            this.connectingIndexes.add(index);
        } else {
            this.connectingIndexes.delete(index);
        }
        this.refresh();
    }

    isConnecting(index: number): boolean {
        return this.connectingIndexes.has(index);
    }

    clearAllConnecting(): void {
        this.connectingIndexes.clear();
        this.refresh();
    }

    // Debounce mechanism for connection clicks (500ms cooldown)
    static isClickTooSoon(index: number): boolean {
        const now = Date.now();
        const lastClick = WelcomeViewProvider.lastClickTimes.get(index) || 0;
        const timeSinceLastClick = now - lastClick;
        
        if (timeSinceLastClick < 500) { // 500ms debounce
            return true; // Too soon, ignore this click
        }
        
        // Update the last click time
        WelcomeViewProvider.lastClickTimes.set(index, now);
        return false; // Click is allowed
    }

    // Global synchronous lock methods for immediate double-click prevention
    static tryLockConnection(index: number): boolean {
        if (WelcomeViewProvider.activeConnections.has(index)) {
            return false; // Already locked
        }
        WelcomeViewProvider.activeConnections.add(index);
        return true; // Successfully locked
    }

    static unlockConnection(index: number): void {
        WelcomeViewProvider.activeConnections.delete(index);
    }

    getTreeItem(element: WelcomeItem): vscode.TreeItem {
        if (element.label === 'Recent Connections') {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
            item.iconPath = element.iconPath;
            return item;
        } else {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
            item.description = element.description;
            item.command = element.command;
            item.iconPath = element.iconPath;
            // Set context value for connection items to enable context menu
            if (element.command?.command?.startsWith('remoteFileBrowser.connectFromWelcome.')) {
                item.contextValue = 'connection';
                // Store the connection index in the tree item ID for context menu commands
                item.id = `connection-${element.connectionIndex}`;
            }
            // Set context value for manage connections item
            else if (element.command?.command === 'remoteFileBrowser.manageConnections') {
                item.contextValue = 'manageConnections';
            }
            return item;
        }
    }

    getChildren(element?: WelcomeItem): Thenable<WelcomeItem[]> {
        if (!element) {
            return Promise.resolve(this.getWelcomeItems());
        } else if (element.label === 'Recent Connections') {
            return Promise.resolve(this.getRecentConnectionItems());
        }
        return Promise.resolve([]);
    }

    private getWelcomeItems(): WelcomeItem[] {
        const items: WelcomeItem[] = [];

        // Manage Connections button
        items.push({
            label: 'Manage Connections',
            iconPath: new vscode.ThemeIcon('gear'),
            command: {
                command: 'remoteFileBrowser.manageConnections',
                title: 'Manage Connections'
            }
        });

        // Recent Connections collapsible section
        const connections = this.getRecentConnections();
        if (connections.length > 0) {
            items.push({
                label: 'Recent Connections',
                iconPath: new vscode.ThemeIcon('history')
            });
        }

        return items;
    }

    private getRecentConnectionItems(): WelcomeItem[] {
        const items: WelcomeItem[] = [];
        const connections = this.getRecentConnections();
        
        for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            const connectionName = connection.name || `${connection.username}@${connection.host}`;
            const isConnecting = this.connectingIndexes.has(i);
            
            items.push({
                label: isConnecting ? `${connectionName} (Connecting...)` : connectionName,
                iconPath: new vscode.ThemeIcon(isConnecting ? 'loading~spin' : 'plug'),
                command: isConnecting ? undefined : {
                    command: `remoteFileBrowser.connectFromWelcome.${i}`,
                    title: 'Connect'
                },
                connectionIndex: i
            });
        }

        return items;
    }

    private getRecentConnections(): any[] {
        const config = vscode.workspace.getConfiguration('remoteFileBrowser');
        const connections = config.get<any[]>('connections', []);
        
        // Return first 10 connections
        return connections.slice(0, 10);
    }
}
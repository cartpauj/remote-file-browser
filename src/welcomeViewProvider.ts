import * as vscode from 'vscode';

export interface WelcomeItem {
    label: string;
    description?: string;
    command?: vscode.Command;
    iconPath?: vscode.ThemeIcon;
}

export class WelcomeViewProvider implements vscode.TreeDataProvider<WelcomeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WelcomeItem | undefined | null | void> = new vscode.EventEmitter<WelcomeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WelcomeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private connectingIndexes: Set<number> = new Set();

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
                    command: 'remoteFileBrowser.connectFromWelcome',
                    title: 'Connect',
                    arguments: [i]
                }
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
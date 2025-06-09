import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';

export class RemoteFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly path: string,
        public readonly isDirectory: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.path;
        this.contextValue = isDirectory ? 'directory' : 'file';
        
        if (!isDirectory) {
            this.command = {
                command: 'remoteFileBrowser.openFile',
                title: 'Open File',
                arguments: [this]
            };
            this.iconPath = new vscode.ThemeIcon('file');
        } else {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}

export class RemoteFileProvider implements vscode.TreeDataProvider<RemoteFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RemoteFileItem | undefined | null | void> = new vscode.EventEmitter<RemoteFileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RemoteFileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private connectionManager: ConnectionManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RemoteFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RemoteFileItem): Promise<RemoteFileItem[]> {
        if (!this.connectionManager.isConnected()) {
            return [];
        }

        try {
            const path = element ? element.path : this.connectionManager.getRemotePath();
            const files = await this.connectionManager.listFiles(path);
            
            // Sort files: directories first (alphabetically), then files (alphabetically)
            const sortedFiles = files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            
            return sortedFiles.map(file => {
                const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                const collapsibleState = file.isDirectory 
                    ? vscode.TreeItemCollapsibleState.Collapsed 
                    : vscode.TreeItemCollapsibleState.None;
                
                return new RemoteFileItem(
                    file.name,
                    fullPath,
                    file.isDirectory,
                    collapsibleState
                );
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list files: ${error}`);
            return [];
        }
    }
}
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
    private currentDirectory: string | undefined;

    constructor(private connectionManager: ConnectionManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    navigateToParent(): void {
        if (!this.connectionManager.isConnected()) {
            return;
        }

        // Ensure currentDirectory is properly initialized
        if (!this.currentDirectory) {
            this.currentDirectory = this.connectionManager.getRemotePath();
        }

        const currentPath = this.currentDirectory;
        
        if (currentPath !== '/') {
            // Calculate parent path - handle trailing slashes properly
            let pathToProcess = currentPath.endsWith('/') && currentPath !== '/' 
                ? currentPath.slice(0, -1) 
                : currentPath;
            
            const lastSlashIndex = pathToProcess.lastIndexOf('/');
            const parentPath = lastSlashIndex <= 0 ? '/' : pathToProcess.substring(0, lastSlashIndex);
            
            
            if (parentPath !== currentPath) {
                this.currentDirectory = parentPath;
                
                // Clear the tree completely, then refresh
                this._onDidChangeTreeData.fire(null);
            } else {
            }
        } else {
        }
    }

    canNavigateToParent(): boolean {
        if (!this.connectionManager.isConnected()) {
            return false;
        }
        
        // Ensure currentDirectory is properly initialized for consistent behavior
        if (!this.currentDirectory) {
            this.currentDirectory = this.connectionManager.getRemotePath();
        }
        
        const currentPath = this.currentDirectory;
        const canNavigate = currentPath !== '/';
        return canNavigate;
    }

    getCurrentDirectory(): string {
        // Ensure currentDirectory is properly initialized
        if (!this.currentDirectory) {
            this.currentDirectory = this.connectionManager.getRemotePath();
        }
        return this.currentDirectory;
    }

    resetToDefaultDirectory(): void {
        const previousPath = this.currentDirectory;
        const defaultPath = this.connectionManager.getRemotePath();
        this.currentDirectory = defaultPath;
        
        // Fire change event to refresh the tree view
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(element: RemoteFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RemoteFileItem): Promise<RemoteFileItem[]> {
        if (!this.connectionManager.isConnected()) {
            return [];
        }

        try {
            const path = element ? element.path : this.getCurrentDirectory();
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
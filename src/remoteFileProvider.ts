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
            console.log('navigateToParent: not connected, exiting');
            return;
        }

        // Ensure currentDirectory is properly initialized
        if (!this.currentDirectory) {
            this.currentDirectory = this.connectionManager.getRemotePath();
            console.log(`navigateToParent: initialized currentDirectory to ${this.currentDirectory}`);
        }

        const currentPath = this.currentDirectory;
        console.log(`navigateToParent: currentDirectory=${this.currentDirectory}, currentPath=${currentPath}`);
        
        if (currentPath !== '/') {
            // Calculate parent path - handle trailing slashes properly
            let pathToProcess = currentPath.endsWith('/') && currentPath !== '/' 
                ? currentPath.slice(0, -1) 
                : currentPath;
            
            const lastSlashIndex = pathToProcess.lastIndexOf('/');
            const parentPath = lastSlashIndex <= 0 ? '/' : pathToProcess.substring(0, lastSlashIndex);
            
            console.log(`navigateToParent: pathToProcess=${pathToProcess}, lastSlashIndex=${lastSlashIndex}, parentPath=${parentPath}`);
            
            if (parentPath !== currentPath) {
                console.log(`navigateToParent: changing from ${currentPath} to ${parentPath}`);
                this.currentDirectory = parentPath;
                
                // Clear the tree completely, then refresh
                this._onDidChangeTreeData.fire(null);
            } else {
                console.log(`navigateToParent: parentPath equals currentPath, no change needed`);
            }
        } else {
            console.log(`navigateToParent: already at root directory`);
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
        console.log(`canNavigateToParent: currentDirectory=${this.currentDirectory}, canNavigate=${canNavigate}`);
        return canNavigate;
    }

    getCurrentDirectory(): string {
        // Ensure currentDirectory is properly initialized
        if (!this.currentDirectory) {
            this.currentDirectory = this.connectionManager.getRemotePath();
            console.log(`getCurrentDirectory: initialized currentDirectory to ${this.currentDirectory}`);
        }
        return this.currentDirectory;
    }

    resetToDefaultDirectory(): void {
        const previousPath = this.currentDirectory;
        const defaultPath = this.connectionManager.getRemotePath();
        this.currentDirectory = defaultPath;
        console.log(`resetToDefaultDirectory: reset currentDirectory from ${previousPath} to ${defaultPath}`);
        
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
            console.log(`getChildren called - element: ${element?.path || 'ROOT'}, current path: ${path}`);
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
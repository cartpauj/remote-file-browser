import * as vscode from 'vscode';
import * as path from 'path';
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
            
            // Use file extension to determine appropriate icon
            this.iconPath = this.getFileIcon(this.label);
            
            // Set resourceUri to enable VS Code's built-in file icon theming
            this.resourceUri = vscode.Uri.parse(`remote-file:///${this.label}`);
        } else {
            // Use folder/folder-opened icons for directories
            this.iconPath = this.collapsibleState === vscode.TreeItemCollapsibleState.Expanded 
                ? new vscode.ThemeIcon('folder-opened')
                : new vscode.ThemeIcon('folder');
        }
    }
    
    private getFileIcon(fileName: string): vscode.ThemeIcon {
        const ext = path.extname(fileName).toLowerCase();
        
        // Map common file extensions to VS Code's built-in theme icons
        const iconMap: { [key: string]: string } = {
            // Code files
            '.js': 'symbol-method',
            '.ts': 'symbol-method', 
            '.jsx': 'symbol-method',
            '.tsx': 'symbol-method',
            '.py': 'symbol-method',
            '.java': 'symbol-method',
            '.c': 'symbol-method',
            '.cpp': 'symbol-method',
            '.cs': 'symbol-method',
            '.php': 'symbol-method',
            '.rb': 'symbol-method',
            '.go': 'symbol-method',
            '.rs': 'symbol-method',
            '.swift': 'symbol-method',
            '.kt': 'symbol-method',
            
            // Web files
            '.html': 'symbol-property',
            '.htm': 'symbol-property',
            '.css': 'symbol-color',
            '.scss': 'symbol-color',
            '.sass': 'symbol-color',
            '.less': 'symbol-color',
            '.xml': 'symbol-property',
            '.json': 'symbol-object',
            '.yaml': 'symbol-object',
            '.yml': 'symbol-object',
            
            // Images
            '.png': 'file-media',
            '.jpg': 'file-media',
            '.jpeg': 'file-media',
            '.gif': 'file-media',
            '.svg': 'file-media',
            '.ico': 'file-media',
            '.bmp': 'file-media',
            '.webp': 'file-media',
            
            // Documents
            '.pdf': 'file-pdf',
            '.doc': 'file-text',
            '.docx': 'file-text',
            '.txt': 'file-text',
            '.md': 'markdown',
            '.readme': 'markdown',
            
            // Archives
            '.zip': 'file-zip',
            '.rar': 'file-zip',
            '.7z': 'file-zip',
            '.tar': 'file-zip',
            '.gz': 'file-zip',
            
            // Config files
            '.config': 'settings-gear',
            '.conf': 'settings-gear',
            '.ini': 'settings-gear',
            '.env': 'settings-gear',
            '.gitignore': 'settings-gear',
            '.gitconfig': 'settings-gear',
            
            // Database
            '.sql': 'database',
            '.db': 'database',
            '.sqlite': 'database',
            
            // Others
            '.log': 'output',
            '.sh': 'terminal',
            '.bat': 'terminal',
            '.cmd': 'terminal',
            '.ps1': 'terminal'
        };
        
        // Return specific icon if extension is mapped, otherwise use generic file icon
        const iconName = iconMap[ext] || 'file';
        return new vscode.ThemeIcon(iconName);
    }
}

export class RemoteFileProvider implements vscode.TreeDataProvider<RemoteFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RemoteFileItem | undefined | null | void> = new vscode.EventEmitter<RemoteFileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RemoteFileItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private currentDirectory: string | undefined;
    private directoryFilters: Map<string, string> = new Map(); // Her klasör için ayrı filtre
    private directoryContents: Map<string, any[]> = new Map(); // Orijinal dosya listelerini sakla

    constructor(private connectionManager: ConnectionManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setDirectoryFilter(directoryPath: string, filter: string): void {
        if (filter.trim() === '') {
            this.directoryFilters.delete(directoryPath);
        } else {
            this.directoryFilters.set(directoryPath, filter.toLowerCase());
        }
        this.refresh();
    }

    getDirectoryFilter(directoryPath: string): string {
        return this.directoryFilters.get(directoryPath) || '';
    }

    clearDirectoryFilter(directoryPath: string): void {
        this.directoryFilters.delete(directoryPath);
        this.refresh();
    }

    clearAllCaches(): void {
        this.directoryContents.clear();
        this.directoryFilters.clear();
        this.refresh();
    }

    clearDirectoryCache(directoryPath: string): void {
        this.directoryContents.delete(directoryPath);
        this.refresh();
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
            
            // Önbelleğe bakıp veri var mı kontrol et
            let files = this.directoryContents.get(path);
            
            if (!files) {
                // İlk kez bu klasör açılıyor, FTP'den çek
                const isRootListing = !element && path === this.getCurrentDirectory();
                files = await this.connectionManager.listFiles(path);
                
                // Önbelleğe kaydet
                this.directoryContents.set(path, files);
                
                // Clear loading status after successful root directory listing
                if (isRootListing) {
                    const connectionInfo = this.connectionManager.getCurrentConnectionInfo();
                    if (connectionInfo.isConnected && connectionInfo.host) {
                        const statusManager = this.connectionManager.getStatusManager();
                        if (statusManager && connectionInfo.config?.protocol === 'ftp') {
                            statusManager.showSuccess(connectionInfo.host);
                        }
                    }
                }
            }
            
            // Bu klasör için filtre var mı kontrol et
            const filter = this.directoryFilters.get(path);
            let filteredFiles = files;
            
            if (filter) {
                filteredFiles = files.filter(file => 
                    file.name.toLowerCase().includes(filter)
                );
            }
            
            // Sort files: directories first (alphabetically), then files (alphabetically)
            const sortedFiles = filteredFiles.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            
            return sortedFiles.map(file => {
                const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                const collapsibleState = file.isDirectory 
                    ? vscode.TreeItemCollapsibleState.Collapsed 
                    : vscode.TreeItemCollapsibleState.None;
                
                const item = new RemoteFileItem(
                    file.name,
                    fullPath,
                    file.isDirectory,
                    collapsibleState
                );
                
                // Her klasör için arama ikonu ekle
                if (file.isDirectory) {
                    item.contextValue = 'directory';
                }
                
                return item;
            });
        } catch (error) {
            // Clear loading status on error and show error
            const connectionInfo = this.connectionManager.getCurrentConnectionInfo();
            if (connectionInfo.host) {
                const statusManager = this.connectionManager.getStatusManager();
                if (statusManager) {
                    statusManager.showError(connectionInfo.host, `Failed to list files: ${error}`);
                }
            }
            
            vscode.window.showErrorMessage(`Failed to list files: ${error}`);
            return [];
        }
    }
}
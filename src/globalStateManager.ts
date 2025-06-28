import * as vscode from 'vscode';

interface FileWatcherInfo {
    disposable: vscode.Disposable;
    connectionId: string;
    remotePath: string;
}


/**
 * Manages global state for the Remote File Browser extension
 * Encapsulates file watchers to prevent memory leaks
 */
export class GlobalStateManager {
    private static instance: GlobalStateManager | undefined;
    private fileWatchers: Map<string, FileWatcherInfo> = new Map();
    
    private constructor() {}
    
    public static getInstance(): GlobalStateManager {
        if (!GlobalStateManager.instance) {
            GlobalStateManager.instance = new GlobalStateManager();
        }
        return GlobalStateManager.instance;
    }
    
    // File Watcher Management
    public addFileWatcher(uri: string, disposable: vscode.Disposable, connectionId: string, remotePath: string): void {
        // Dispose existing watcher if it exists
        this.removeFileWatcher(uri);
        
        this.fileWatchers.set(uri, {
            disposable,
            connectionId,
            remotePath
        });
    }
    
    public removeFileWatcher(uri: string): void {
        const existing = this.fileWatchers.get(uri);
        if (existing) {
            existing.disposable.dispose();
            this.fileWatchers.delete(uri);
        }
    }
    
    public cleanupFileWatchersForConnection(connectionId: string): void {
        const toRemove: string[] = [];
        
        for (const [uri, info] of this.fileWatchers.entries()) {
            if (info.connectionId === connectionId) {
                info.disposable.dispose();
                toRemove.push(uri);
            }
        }
        
        toRemove.forEach(uri => this.fileWatchers.delete(uri));
    }
    
    public getFileWatcherCount(): number {
        return this.fileWatchers.size;
    }
    
    public getFileWatcherInfo(uri: string): FileWatcherInfo | undefined {
        return this.fileWatchers.get(uri);
    }
    
    public getAllFileWatchers(): Map<string, FileWatcherInfo> {
        return new Map(this.fileWatchers);
    }
    
    public updateFileWatcherPath(oldUri: string, newUri: string, newRemotePath: string): void {
        const watcher = this.fileWatchers.get(oldUri);
        if (watcher) {
            this.fileWatchers.delete(oldUri);
            this.fileWatchers.set(newUri, {
                ...watcher,
                remotePath: newRemotePath
            });
        }
    }
    
    // Upload tracking now handled by pure-js-sftp's built-in concurrency management
    
    // Cleanup all state
    public dispose(): void {
        // Dispose all file watchers
        for (const [uri, info] of this.fileWatchers.entries()) {
            info.disposable.dispose();
        }
        this.fileWatchers.clear();
        
        GlobalStateManager.instance = undefined;
    }
    
    // Debug info
    public getDebugInfo(): any {
        return {
            fileWatcherCount: this.fileWatchers.size,
            fileWatchers: Array.from(this.fileWatchers.keys())
        };
    }
}
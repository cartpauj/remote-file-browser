# Remote File Browser Extension - Project Scope

## Overview
A VSCode/Cursor extension that provides secure remote file browsing via SFTP/FTP without downloading entire directory structures locally. Files are accessed on-demand and changes are automatically synced back to the remote server.

## Core Features

### 1. Remote Connection Management
- **Protocols Supported**: SFTP and FTP
- **Authentication Methods**: 
  - Password authentication
  - SSH key authentication (with optional passphrase)
- **Secure Credential Storage**: Uses VSCode's SecretStorage API (system keychain)
- **Connection Persistence**: Saved connections with optional secure password storage

### 2. User Interface
- **Activity Bar Integration**: Globe icon (🌐) in main activity bar for prominent access
- **Welcome Screen**: Dynamic tree view showing recent connections when disconnected
- **Recent Connections**: Collapsible section showing up to 10 most recent connections
- **Click Protection**: Prevents multiple connection attempts with visual feedback
- **Remote File Tree**: Hierarchical view of remote files and folders
- **File Sorting**: Folders first (alphabetically), then files (alphabetically)

### 3. Connection Manager GUI
- **Visual Connection Manager**: Web-based interface for managing server connections
- **Form-based Configuration**: Add/edit connections without JSON editing
- **SSH Key File Browser**: Browse and select SSH key files using native file dialog
- **Connection Actions**: Connect, Edit, Delete buttons for each saved connection
- **Temp File Management**: View and clean up temporary files via shell interface

### 4. File Operations
- **On-demand File Access**: Files only downloaded when opened
- **Persistent Temporary Files**: Organized directory structure preserving remote paths
- **Connection-specific Storage**: `/tmp/remote-file-browser/connection-name/remote/path/file.txt`
- **Override Prompts**: Ask user when opening existing temp files whether to use cached or download fresh
- **Auto-sync on Save**: Changes automatically uploaded to remote server when file is saved
- **File Watcher**: Monitors local temp files for changes and syncs back
- **Manual Cleanup**: User-controlled cleanup via dedicated commands and GUI buttons

### 5. Security Features
- **Secure Credential Storage**: Passwords/passphrases stored in OS keychain
- **Graceful Keyring Fallback**: Handles missing keyring software gracefully
- **No Plaintext Storage**: Credentials never stored in settings or configuration files
- **User Consent**: Always asks permission before storing credentials

## Technical Architecture

### File Structure
```
src/
├── extension.ts              # Main extension entry point
├── connectionManager.ts      # SFTP/FTP connection handling
├── remoteFileProvider.ts     # Tree view provider for remote files
├── connectionManagerView.ts  # Web-based connection management GUI
├── credentialManager.ts      # Secure credential storage
└── welcomeViewProvider.ts    # Dynamic welcome screen with recent connections
```

### Key Dependencies
- `ssh2-sftp-client`: SFTP client library
- `basic-ftp`: FTP client library
- `@types/ssh2-sftp-client`: TypeScript definitions for SFTP client

### Extension Configuration
- **View Container**: Custom activity bar container with globe icon
- **Commands**: Connect, disconnect, refresh, manage connections, cleanup temp files
- **Views**: Welcome view (disconnected) and file tree view (connected)
- **Menu Contributions**: Refresh, disconnect, and cleanup buttons in view title
- **Cross-platform Compatibility**: Intelligent OS detection for temp file management

## User Workflows

### First-time Setup
1. Click globe icon in activity bar
2. Click "Manage Connections" on welcome screen
3. Add connection with server details and authentication method
4. Optionally browse for SSH key file
5. Save connection
6. Click "Connect" button on saved connection
7. Enter password/passphrase (with option to save securely)

### Daily Usage
1. Click globe icon
2. If disconnected, see recent connections in welcome screen
3. Click any recent connection (uses stored credentials if available)
4. Browse files in tree view
5. Double-click files to open and edit
6. Save files to auto-sync changes
7. Use disconnect button (X) to switch servers

### Connection Management
- **Add**: Form-based creation with file browser for SSH keys
- **Edit**: Modify existing connections
- **Delete**: Remove connections with confirmation
- **Connect**: Direct connection from manager with credential prompting

## Development History

### Phase 1: Basic Functionality
- Created SFTP/FTP connection management
- Implemented file tree provider
- Added basic file open/save operations
- Set up TypeScript configuration and build process

### Phase 2: User Experience Improvements
- Moved from Explorer sidebar to dedicated activity bar icon
- Added connection manager GUI with forms
- Implemented file sorting (folders first, alphabetical)
- Added welcome screen for disconnected state

### Phase 3: Authentication & Security
- Added SSH key authentication support
- Implemented secure credential storage
- Added file browser for SSH key selection
- Created graceful fallback for keyring issues

### Phase 4: Workflow Optimization
- Added connect buttons directly in connection manager
- Implemented auto-open connection manager on disconnect
- Added credential save prompts with user consent
- Improved error handling and user feedback

### Phase 5: Temp File Management & UI Improvements
- Implemented persistent temp files with organized directory structure
- Added connection-specific temp directories preserving remote paths
- Created override prompts for existing temp files (fresh vs cached)
- Implemented manual cleanup with shell interface for temp file management
- Added cross-platform temp file access (terminal fallback for Crostini/ChromeOS)

### Phase 6: Enhanced Welcome Experience
- Created dynamic welcome screen with recent connections tree view
- Added collapsible "Recent Connections" section showing up to 10 connections
- Implemented click protection with visual feedback during connection attempts
- Added spinning loading icons and "Connecting..." labels
- Removed auto-open connection manager on disconnect for cleaner UX
- Consolidated duplicate connection authentication code for maintainability

## Configuration Schema
```json
{
  "remoteFileBrowser.connections": [
    {
      "name": "Server Name",
      "protocol": "sftp|ftp",
      "host": "hostname",
      "port": 22,
      "username": "username",
      "remotePath": "/",
      "authType": "password|key",
      "keyPath": "/path/to/ssh/key"
    }
  ]
}
```

## Security Considerations
- Credentials stored using VSCode SecretStorage API
- SSH keys read from disk only during connection
- No credential caching in memory beyond connection duration
- Temporary files organized in connection-specific directories with sanitized names
- Manual cleanup of temporary files and watchers prevents sensitive data accumulation
- Cross-platform filesystem safety with character sanitization for folder names

## Known Limitations
- Requires system keyring software for secure credential storage
- Large files may impact performance during transfer
- No support for SFTP/FTP advanced features (tunneling, etc.)
- Limited to basic authentication methods (no certificates, etc.)
- Recent connections based on order in configuration (not actual usage tracking)
- Temp file management relies on terminal interface for cross-platform compatibility

## Future Enhancement Opportunities
- Connection testing functionality
- Transfer progress indicators for large files
- Multiple file operations (copy, move, delete)
- Advanced SFTP features (symbolic links, permissions)
- Connection import/export
- Dark theme customization for connection manager
- Keyboard shortcuts for common operations
- Usage-based recent connections tracking
- Native file manager integration for temp file access
- Batch file operations and multi-selection support
- Connection grouping and organization features

## Installation & Development

### Local Development Setup
1. Extension located in: `/home/cartpauj/.cursor/extensions/remote-file-browser/`
2. Build: `npm run compile`
3. Dependencies: `npm install`
4. Testing: F5 in VSCode/Cursor for Extension Development Host
5. Reload: "Developer: Reload Window" after changes

### Git Repository Management

#### Files to Exclude from Git
The `.gitignore` file excludes these automatically:
- `out/` - Compiled JavaScript files and source maps
- `node_modules/` - NPM dependencies
- `*.vsix` - Extension package files
- IDE and OS temporary files

#### Files to Include in Git
Essential files for the repository:
- `src/` - TypeScript source code
- `package.json` - Extension manifest and dependencies
- `package-lock.json` - Locked dependency versions
- `tsconfig.json` - TypeScript configuration
- `README.md` - User documentation
- `PROJECT-SCOPE.md` - Technical documentation
- `.gitignore` - Git exclusion rules

#### Setting Up from GitHub

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd remote-file-browser
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   # Development build (webpack bundling)
   npm run compile
   
   # Production build (minified)
   npm run package
   ```

4. **Development workflow**:
   ```bash
   # Watch for changes (auto-compile with webpack)
   npm run watch
   
   # Manual development build
   npm run compile
   
   # Production build
   npm run package
   
   # Test in Extension Development Host
   # Press F5 in VSCode/Cursor or use "Run Extension" in Run and Debug panel
   ```

5. **Installing the extension**:
   - Copy the entire project folder to your extensions directory:
     - **Windows**: `%USERPROFILE%\.vscode\extensions\` or `%USERPROFILE%\.cursor\extensions\`
     - **macOS**: `~/.vscode/extensions/` or `~/.cursor/extensions/`
     - **Linux**: `~/.vscode/extensions/` or `~/.cursor/extensions/`
   - Restart VSCode/Cursor
   - The extension will appear in your extensions list

### Extension Bundling & Optimization

The extension uses **webpack bundling** for optimal performance and minimal package size:

- **Bundle Size**: Reduced from 6.2MB (573 files) to 211KB (16 files) - 97% size reduction
- **Build Process**: TypeScript → Webpack → Minified Bundle
- **Dependencies**: Native binary modules handled via node-loader
- **Exclusions**: Source files, tests, and dev dependencies excluded via `.vscodeignore`

#### Bundling Configuration
- **webpack.config.js**: Bundles TypeScript into single optimized file
- **node-loader**: Handles SSH2 native binary dependencies (.node files)
- **Production mode**: Minification and tree-shaking enabled
- **Source maps**: Hidden source maps for debugging without source exposure

### Building for Distribution

1. **Install packaging dependencies**:
   ```bash
   npm install -g vsce
   npm install
   ```

2. **Package the extension** (automatically runs bundling):
   ```bash
   vsce package
   ```
   This runs `npm run vscode:prepublish` → `npm run package` → webpack bundling

3. **Manual bundling** (development):
   ```bash
   # Development bundle
   npm run compile
   
   # Production bundle (minified)
   npm run package
   ```

4. **Install from .vsix**:
   - In VSCode/Cursor: `Extensions` → `...` → `Install from VSIX...`
   - Select the generated `.vsix` file

This project provides a complete, secure, and user-friendly solution for remote file browsing without the overhead of traditional sync-based approaches. The extension offers seamless connectivity with intelligent temp file management, cross-platform compatibility, and an intuitive interface optimized for daily development workflows.
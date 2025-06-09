# Remote File Browser Extension - Project Scope

## Overview
A VSCode/Cursor extension that provides secure remote file browsing via SFTP/FTP without downloading entire directory structures locally. Files are accessed on-demand and changes are automatically synced back to the remote server.

## Core Features

### Cross-Platform Compatibility
This extension is designed to work seamlessly across all major operating systems:
- **Windows**: Full support for Windows 10/11 with proper path handling and credential storage
- **macOS**: Native integration with macOS keychain and file system conventions
- **Linux**: Compatible with various Linux distributions and desktop environments

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
- Added cross-platform temp file access via terminal interface

### Phase 6: Enhanced Welcome Experience
- Created dynamic welcome screen with recent connections tree view
- Added collapsible "Recent Connections" section showing up to 10 connections
- Implemented click protection with visual feedback during connection attempts
- Added spinning loading icons and "Connecting..." labels
- Removed auto-open connection manager on disconnect for cleaner UX
- Consolidated duplicate connection authentication code for maintainability

### Phase 7: Security & Connection Safety
- Implemented connection-aware file watchers to prevent cross-server file uploads
- Added validation to ensure files are only saved to their originating connections
- Enhanced file watcher storage to track connection metadata (username@host:port)
- Introduced clear error messages when attempting to save files to wrong servers
- Maintained cross-platform compatibility while adding security validation
- Prevented data loss scenarios in multi-server development workflows

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
- Temp file management uses terminal interface for all platforms

### Multi-Window Compatibility Issues
- **Shared Temporary Directory Conflicts**: Multiple VSCode/Cursor windows connecting to the same server use identical temp file paths (`/tmp/remote-file-browser/user-at-server-22/`), causing file overwrite conflicts when opening the same remote files
- **Global File Watcher State**: File watchers are stored in Node.js global scope, causing cross-window interference when one window cleans up temp files (disposes watchers for all windows)
- **Race Conditions**: Multiple windows editing the same remote file can overwrite each other's changes, with whichever saves last winning
- **Cleanup Side Effects**: Running "Clean Up Temp Files" in one window affects file synchronization in all other windows
- **No Connection Isolation**: Extension lacks prevention mechanisms for multiple windows connecting to the same server simultaneously

## Security Improvements

### Connection-Aware File Watchers (Implemented)
- **Cross-Connection Upload Prevention**: File watchers now track which connection each file belongs to, preventing dangerous scenarios where files could be uploaded to the wrong server
- **Connection Validation on Save**: Before uploading any file, the system validates that the user is still connected to the same server that originally provided the file
- **Clear Error Messages**: When attempting to save a file from a different connection, users receive clear feedback like "Cannot save index.php - file belongs to user@serverA:22 but you're connected to admin@serverB:21"
- **Cross-Platform Compatibility**: Uses existing sanitization and path handling systems to work consistently across Windows, macOS, and Linux
- **No Breaking Changes**: Implementation preserves all existing functionality while adding safety validation

### Impact
This fix prevents data loss scenarios where:
- User opens file from Server A, disconnects, connects to Server B, and saves changes (would previously upload to Server B)
- Multi-server workflows could accidentally overwrite files on production servers with development content
- Files could be uploaded to wrong environments without user awareness

## Future Enhancement Opportunities
- Connection testing functionality
- Transfer progress indicators for large files
- Multiple file operations (copy, move, delete)
- Advanced SFTP features (symbolic links, permissions)
- Connection import/export
- Dark theme customization for connection manager
- Keyboard shortcuts for common operations
- Usage-based recent connections tracking
- Enhanced terminal interface features for temp file access
- Batch file operations and multi-selection support
- Connection grouping and organization features

### Multi-Window Safety Improvements
- **Window-Specific Temp Directories**: Use window/instance identifiers in temp paths to prevent conflicts (`/tmp/remote-file-browser/window-${id}/user-at-server-22/`)
- **Instance-Level File Watchers**: Replace global file watcher state with per-window instance storage
- **Connection Locking**: Implement filesystem-based or process-level locking to prevent multiple windows from connecting to the same server
- **File Access Coordination**: Add file locking mechanisms to prevent concurrent edits of the same remote file across windows
- **Isolated Cleanup Operations**: Ensure temp file cleanup only affects the current window's resources
- **Connection State Visibility**: Add indicators showing which window is connected to which server

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

## VSCode Marketplace Publishing Plan

### Prerequisites (High Priority)
1. ✅ **Install vsce CLI tool globally** - Already installed
2. ✅ **Create Microsoft account and Azure DevOps Personal Access Token** - Personal Access Token with "Marketplace (Manage)" scope created
3. ✅ **Create publisher profile on VSCode Marketplace** - Publisher profile created and verified

### Extension Preparation (Medium Priority)
4. ✅ **Create extension icon (PNG/JPG, not SVG)** - 128x128 PNG icon created and added to package.json
5. ✅ **Review and update package.json** - Package.json updated with complete metadata, license, author, homepage, bugs URL, and improved category
6. ✅ **Ensure README.md meets marketplace standards** - README.md updated and verified to meet marketplace presentation standards
7. ✅ **Review .vscodeignore file** - .vscodeignore file reviewed and verified to exclude unnecessary files from package
8. ✅ **Add keywords to package.json** - Added 20 relevant keywords for better discoverability

### Testing & Publishing (Medium/Low Priority)
9. ✅ **Test extension packaging** - Extension packaging tested successfully with `vsce package`
10. ✅ **Test extension locally** - Extension tested locally by installing .vsix file before publishing
11. ✅ **Publish extension** - Extension published to marketplace at https://marketplace.visualstudio.com/items?itemName=cartpauj.remote-file-browser

### Future Enhancements (Low Priority)
12. ✅ **Optional: Verify publisher domain** - Publisher domain verified (completed ahead of typical 6+ month requirement)

### Key Marketplace Requirements
- **Icon**: Must be PNG/JPG format (not SVG)
- **Keywords**: Maximum 30 keywords for discoverability
- **Version Compatibility**: `^1.74.0` VS Code engine already properly configured
- **Files**: README.md, LICENSE (✅), and CHANGELOG.md recommended
- **Publisher**: "cartpauj" already configured in package.json
- **Packaging**: Uses webpack bundling for optimized distribution

## Version Management & Release Process

### Version Bump Strategy (Auto-Increment)
The extension uses semantic versioning (`major.minor.patch`) with auto-increment via vsce:

```bash
vsce publish patch    # Bug fixes: 1.0.0 → 1.0.1
vsce publish minor    # New features: 1.0.0 → 1.1.0  
vsce publish major    # Breaking changes: 1.0.0 → 2.0.0
```

### Extension Build Process

The extension uses TypeScript source files that must be compiled to JavaScript before packaging:

**Source Files (`src/`):**
- `extension.ts` - Main extension entry point with all core functionality
- `connectionManager.ts` - SFTP/FTP connection handling
- `remoteFileProvider.ts` - Tree view provider for remote files  
- `connectionManagerView.ts` - Web-based connection management GUI
- `credentialManager.ts` - Secure credential storage
- `welcomeViewProvider.ts` - Dynamic welcome screen with recent connections

**Build Output (`out/`):**
- `extension.js` - Compiled main extension file (created from `extension.ts`)
- Additional `.js` files for each TypeScript module
- Source maps for debugging (`.js.map` files)

**When to Build:**
- **Development**: `npm run compile` or `npm run watch` (auto-rebuild on changes)
- **Pre-Release Testing**: `npm run package` (production build with webpack bundling)
- **Publishing**: Automatically triggered by `vsce publish` or `vsce package`

### Complete Release Workflow

**⚠️ IMPORTANT: Ensure all changes are committed to git before starting the release process!**

#### Pre-Release Checklist
```bash
# 1. Check git status - must be clean before release
git status

# 2. If changes exist, commit them first:
git add .
git commit -m "Description of changes"

# 3. Update CHANGELOG.md if needed (add new version entry)
# Edit CHANGELOG.md manually to document changes
```

#### Release Process

1. **Test Changes Locally**
   ```bash
   # Development build (creates out/extension.js from src/extension.ts)
   npm run compile
   
   # Production build with webpack bundling
   npm run package
   ```

2. **Package Extension for Testing**
   ```bash
   # Create .vsix package for local testing (auto-builds extension.js)
   vsce package
   
   # Install locally to test:
   # In VSCode: Extensions → ... → Install from VSIX
   # Select the generated .vsix file
   ```

3. **Update Changelog (if needed)**
   ```bash
   # Edit CHANGELOG.md to add new version entry before publishing
   # Include summary of changes for the new version
   
   # Commit changelog updates
   git add CHANGELOG.md
   git commit -m "Update changelog for version X.X.X"
   ```

4. **Publish to Marketplace**
   ```bash
   # CRITICAL: Ensure git working directory is clean first!
   git status  # Should show "nothing to commit, working tree clean"
   
   # Option A: Use npm version for proper versioning (RECOMMENDED)
   npm version patch    # For bug fixes: 2.1.0 → 2.1.1
   npm version minor    # For new features: 2.1.0 → 2.2.0
   npm version major    # For breaking changes: 2.1.0 → 3.0.0
   
   # Then publish to marketplace
   vsce publish
   
   # Option B: Direct vsce publish with version bump
   vsce publish patch    # Auto-increments version and publishes
   vsce publish minor    # Auto-increments version and publishes  
   vsce publish major    # Auto-increments version and publishes
   ```

5. **Create Standalone Package (Optional)**
   ```bash
   # Generate .vsix file for manual distribution
   vsce package
   
   # This creates a file like: remote-file-browser-2.1.1.vsix
   # Users can install this manually via:
   # Extensions → ... → Install from VSIX
   ```

6. **Post-Release Git Management**
   ```bash
   # Push version tags and commits to remote
   git push origin main --tags
   
   # Verify the release
   git log --oneline -5  # Check recent commits
   git tag --sort=-version:refname | head -5  # Check recent tags
   ```

### Files Updated Automatically
- `package.json` - Version field updated by vsce
- `package-lock.json` - Updated automatically when package.json changes

### Version Numbering Guidelines
- **Pre-1.0**: Use `0.x.x` for initial development
- **First Stable Release**: `1.0.0` when feature-complete
- **Bug Fixes**: Patch version (1.0.1)
- **New Features**: Minor version (1.1.0)
- **Breaking Changes**: Major version (2.0.0)

### Current Status
- **Current Version**: `0.0.1` (initial development)
- **Recommended First Release**: `1.0.0` (extension is feature-complete)
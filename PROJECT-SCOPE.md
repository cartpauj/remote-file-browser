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
    - OpenSSH private key format (traditional and modern)
    - PuTTY .ppk file format v2 and v3 (with automatic conversion to OpenSSH format)
- **Secure Credential Storage**: Uses VSCode's SecretStorage API (system keychain)
- **Connection Persistence**: Saved connections with optional secure password storage
- **Advanced Connection Timeout & Error Handling**:
  - **Configurable Connection Timeouts**: User-customizable timeouts for both SFTP and FTP (default: 30s for both protocols)
  - **Operation-Specific Timeouts**: Separate configurable timeout for file operations (default: 60s) vs. connection establishment
  - **Enhanced Retry Strategy**: Exponential backoff with configurable retry attempts (default: 3) and base delay (default: 1s)
  - **Smart Keep-Alive Mechanisms**: Automatic connection health monitoring with configurable ping intervals (default: 30s)
  - **Comprehensive Error Detection**: Handles 16+ error patterns including network errors (ECONNRESET, ETIMEDOUT), FTP timeouts, and SSH failures
  - **Connection Health Monitoring**: Tracks uptime, success/failure rates, last operation times, and keep-alive status
  - **Operation-Level Recovery**: Failed operations automatically retry with exponential backoff after successful reconnection
  - **Graceful Disconnection**: Clean connection cleanup and comprehensive state management
  - **FTP Session Persistence**: Enhanced FTP connection management with persistent sessions and automatic reconnection on operation failures

### 2. User Interface
- **Activity Bar Integration**: Globe icon (🌐) in main activity bar for prominent access
- **Welcome Screen**: Dynamic tree view showing recent connections when disconnected
- **Recent Connections**: Collapsible section showing up to 10 most recent connections
- **Click Protection**: Prevents multiple connection attempts with visual feedback
- **Remote File Tree**: Hierarchical view of remote files and folders with parent directory navigation
- **File Sorting**: Folders first (alphabetically), then files (alphabetically)
- **Navigation Controls**: Parent directory button with arrow-up icon for moving up directory levels

### 3. Connection Manager GUI
- **Visual Connection Manager**: Web-based interface for managing server connections
- **Form-based Configuration**: Add/edit connections without JSON editing
- **SSH Key File Browser**: Browse and select SSH key files using native file dialog
  - Supports OpenSSH private keys (.key, .pem, .openssh)
  - Supports PuTTY private keys v2 and v3 (.ppk) with automatic format conversion
- **Advanced Connection Settings**: Optional timeout and retry configuration with:
  - Connection timeout (5-120 seconds)
  - File operation timeout (10-300 seconds)
  - Max retry attempts (1-10)
  - Retry base delay (0.5-10 seconds)
  - Keep-alive toggle and interval (10-300 seconds)
- **Connection Actions**: Connect, Edit, Delete buttons for each saved connection
- **Temp File Management**: View and clean up temporary files via shell interface

### 4. File Operations
- **On-demand File Access**: Files only downloaded when opened
- **Persistent Temporary Files**: Organized directory structure preserving remote paths
- **Connection-specific Storage**: `/tmp/remote-file-browser/{sanitized-username-host-port}/remote/path/file.txt`
  - Directory names use sanitized connection identifiers (e.g., `user@example.com:22` becomes `user-at-example.com-22`)
- **Override Prompts**: Ask user when opening existing temp files whether to use cached or download fresh
- **Auto-sync on Save**: Changes automatically uploaded to remote server when file is saved
- **File Watcher**: Monitors local temp files for changes and syncs back
- **Manual Cleanup**: User-controlled cleanup via dedicated commands and GUI buttons with connection-specific targeting
- **Push to Remote**: Right-click local file tabs to upload files to selected remote directories
- **Parent Directory Navigation**: Navigate up directory levels with dedicated toolbar button
- **Right-click File Operations**: Context menu on remote files and directories with:
  - **Download**: Download and open files in editor (equivalent to double-clicking)
  - **Rename**: Rename files and directories on the remote server with validation
  - **Copy**: Copy files and directories to new paths with pre-populated input, overwrite protection, and automatic editor opening for copied files
  - **Move**: Move files and directories to new paths with pre-populated input, validation, overwrite protection, and comprehensive error handling
  - **Delete**: Delete files and directories from the remote server with confirmation prompts and recursive directory support

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

#### Runtime Dependencies
- `ssh2-sftp-client` (^12.0.0): SFTP client library with enhanced EventEmitter handling and Node.js v20+ compatibility
- `basic-ftp` (^5.0.5): FTP client library for FTP connections
- `ppk-to-openssh` (^1.2.2): Pure JavaScript library for converting PuTTY PPK v2 and v3 files to OpenSSH format

#### Development Dependencies
- `@types/ssh2-sftp-client` (^9.0.4): TypeScript definitions for SFTP client (compatible with v12.0.0)
- `@types/vscode` (^1.74.0): VSCode extension API TypeScript definitions
- `@types/node` (16.x): Node.js TypeScript definitions
- `typescript` (^5.8.3): TypeScript compiler with improved compatibility
- `webpack` (^5.99.9): Module bundler for optimized distribution
- `webpack-cli` (^6.0.1): Webpack command line interface
- `ts-loader` (^9.5.2): TypeScript loader for webpack
- `node-loader` (^2.1.0): Native module loader for webpack (handles SSH2 binaries)

### Extension Configuration
- **View Container**: Custom activity bar container with globe icon
- **Commands**: Connect, disconnect, refresh, manage connections, cleanup temp files, push to remote, navigate to parent
- **Views**: Welcome view (disconnected) and file tree view (connected)
- **Menu Contributions**: Parent navigation, refresh, disconnect, and cleanup buttons in view title
- **Context Menus**: "Push to Remote" option in editor tab right-click menu for local files
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
4. Browse files in tree view with parent directory navigation
5. Double-click files to open and edit
6. Save files to auto-sync changes
7. Right-click local file tabs to "Push to Remote" when needed
8. Use parent directory button (arrow-up) to navigate up directory levels
9. Use disconnect button (X) to switch servers

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

### Phase 8: Enhanced SSH Key Support
- Added PuTTY .ppk file format support with direct ssh2 library integration
- Removed `sshpk` library dependency in favor of native ssh2 PPK support
- Enhanced file browser filters to include .ppk files alongside OpenSSH formats
- Implemented direct PPK file handling without format conversion overhead
- Simplified codebase by leveraging ssh2-sftp-client's built-in PPK capabilities
- Maintained backward compatibility with existing OpenSSH private key workflows

### Phase 9: Code Optimization and Cleanup
- Removed unnecessary sshpk dependency and @types/sshpk dev dependency
- Eliminated complex PPK parsing code in favor of direct ssh2 integration
- Removed debug console.log statements and vestigial TODO comments
- Reduced bundle size from 279KB to 237KB (42KB reduction)
- Simplified connection manager code from 19KB to 6.65KB source
- Improved performance by removing 30+ packages from dependency tree

### Phase 10: Enhanced File Operations and Navigation
- **Push to Remote Feature**: Added right-click context menu on local file tabs to upload files to selected remote directories
- **Directory Selection Tracking**: Implemented tree view selection tracking to determine upload destination
- **Parent Directory Navigation**: Added toolbar button with arrow-up icon for navigating up directory levels
- **Navigation State Management**: Fixed currentDirectory initialization and first-click navigation issues
- **Improved User Experience**: Enhanced file transfer workflows with progress indicators and error handling
- **Context-Aware Operations**: File operations now consider selected directories and current navigation state

### Phase 11: Advanced Connection Management and Reliability
- **Configurable Timeouts**: Added user-customizable connection and operation timeouts for both SFTP and FTP protocols
- **Enhanced Retry Strategy**: Implemented exponential backoff with configurable retry attempts and base delays
- **Smart Keep-Alive System**: Automatic connection health monitoring with configurable ping intervals to prevent idle disconnections
- **Operation-Specific Timeouts**: Separate timeout controls for connection establishment vs. file operations
- **Connection Health Monitoring**: Comprehensive tracking of uptime, success/failure rates, and connection status
- **Advanced Connection Manager UI**: Extended form with optional timeout and retry configuration settings
- **Robust Error Recovery**: Improved operation-level recovery with intelligent reconnection and health status tracking

### Phase 12: Connection-Specific Cleanup and Code Refinement
- **Connection-Specific Cleanup**: Modified file tree trash icon to delete temp files for current connection only (instead of all connections)
- **Multi-Layered Connection ID System**: Implemented separation of concerns with different ID formats for filesystem paths, file watcher tracking, and credential storage
- **Cross-Platform Safety**: Enhanced filesystem sanitization to handle @ and : symbols safely across Windows, macOS, and Linux
- **Code Cleanup**: Removed vestigial `sanitizeForFilename()` function and clarified connection identification architecture
- **Directory Structure Consistency**: Fixed temp file targeting to use consistent `getConnectionTempDir()` approach for reliable cleanup operations
- **User Experience Enhancement**: File tree cleanup now contextual to current connection while connection manager provides global cleanup option

### Phase 13: Welcome Screen Double-Click Prevention
- **Root Cause Discovery**: Identified VSCode tree item command argument parsing bug that misinterpreted connection indexes as file paths (e.g., `/2`)
- **Dynamic Command Registration**: Implemented pre-registration of individual commands for each connection index (`remoteFileBrowser.connectFromWelcome.0`, `.1`, etc.)
- **Argument-Free Commands**: Eliminated command arguments entirely to prevent VSCode argument parsing issues
- **Global Connection Lock**: Added simple boolean flag (`isAnyConnectionInProgress`) to prevent concurrent connection attempts
- **Bulletproof Double-Click Prevention**: Commands are pre-registered at extension startup with embedded connection indexes, eliminating race conditions
- **Scalable Architecture**: Supports up to 20 connections with easily adjustable command registration loop

### Phase 14: File Move Operations with Enhanced UX
- **Context Menu Move Feature**: Added "Move" option to right-click context menu for both files and directories
- **Smart Input Dialog**: Pre-populated with current file path to save user typing, with real-time validation
- **Comprehensive Error Handling**: Specific error messages and recovery suggestions for common failure scenarios:
  - Directory doesn't exist errors with creation guidance
  - Permission denied errors with chmod instructions
  - File exists conflicts with resolution suggestions
  - Network timeout errors with automatic retry option
- **Editor Tab Synchronization**: Automatically updates open file tabs when files are moved, preserving cursor position and selection
- **Temporary File Management**: Seamlessly moves local temp files to match new remote paths
- **File Watcher Updates**: Maintains file synchronization for moved files that remain open in the editor
- **Progress Feedback**: Real-time progress notifications during move operations with completion status

### Phase 15: File Copy and Download Operations with Overwrite Protection
- **Copy Feature Implementation**: Added comprehensive file and directory copying functionality with:
  - **Context Menu Integration**: "Copy" option added to right-click context menu for both files and directories
  - **Pre-populated Input Dialog**: Target path pre-filled with source path for user convenience and validation
  - **Recursive Directory Copying**: Full support for copying entire directory structures with all nested contents
  - **New Tab Behavior**: Copied files automatically open in new editor tabs alongside originals (not replacing existing tabs)
  - **Smart Progress Feedback**: Real-time notifications showing copy progress with completion status
- **Download Feature**: Added "Download" context menu option that reuses existing file opening functionality
- **Universal Overwrite Protection**: Both copy and move operations now include comprehensive file existence checking:
  - **File Existence Detection**: Checks target paths for existing files/directories before operations
  - **User Confirmation Dialog**: Modal prompt asking "Overwrite" or "Cancel" when conflicts detected
  - **Cross-Protocol Support**: Overwrite detection works for both SFTP (stat-based) and FTP (directory listing-based)
  - **Safe Operation Flow**: Operations only proceed with explicit user consent to overwrite existing files
- **Enhanced User Experience**: All file operations now provide consistent behavior and protection against accidental data loss

### Phase 16: Dependency Updates and EventEmitter Fixes
- **Critical ssh2-sftp-client Update**: Upgraded from v9.1.0 to v12.0.0 to resolve EventEmitter-related errors
  - **Fixed ".once is not a function" Error**: Eliminated TypeError that prevented file opening operations
  - **Enhanced EventEmitter Handling**: Improved listener management with proper cleanup mechanisms
  - **Node.js v20+ Compatibility**: Updated for better compatibility with modern Node.js versions
  - **Simplified Architecture**: Removed automatic connection retry logic that caused EventEmitter complexity
- **TypeScript Compiler Update**: Upgraded TypeScript from v4.9.4 to v5.8.3 for improved compatibility
- **FTP Library Update**: Updated basic-ftp to v5.0.5 for enhanced stability
- **Improved Error Handling**: Better connection reliability and reduced EventEmitter-related edge cases

### Phase 17: PPK Version 3 Compatibility and Universal PPK Support
- **PPK-to-OpenSSH Library Integration**: Integrated dedicated PPK conversion library for universal PPK support
  - **Library Assessment**: Evaluated and integrated `ppk-to-openssh` library for comprehensive PPK format support
  - **Universal Compatibility**: Now supports both PPK v2 (PuTTY 0.52-0.74) and PPK v3 (PuTTY 0.75+) formats
  - **Format Analysis**: Documented technical differences and conversion process for all PPK versions
- **Enhanced PPK Processing**: Implemented robust PPK file detection and conversion in connection logic
  - **Automatic Detection**: Smart detection of PPK files based on header content (`PuTTY-User-Key-File-`)
  - **Version-Agnostic Processing**: Single conversion pipeline handles both PPK v2 and v3 transparently
  - **Memory-Safe Conversion**: PPK files converted to OpenSSH format in memory without temporary files
- **Improved Error Handling**: Enhanced error messaging with specific PPK-related guidance
  - **Conversion Error Handling**: Specific error messages for passphrase issues, format problems, and corruption
  - **User-Friendly Messages**: Clear feedback when PPK conversion fails with actionable suggestions
  - **Comprehensive Logging**: Console logging for debugging PPK conversion issues
- **Documentation Updates**: Complete user-facing and technical documentation of universal PPK support
  - **README Enhancement**: Updated PPK compatibility section to reflect v2 and v3 support
  - **Technical Scope**: Documented PPK conversion architecture and security considerations

### Phase 18: FTP Connection Persistence and Timeout Optimization
- **FTP Session Management Overhaul**: Resolved critical FTP re-authentication issues affecting file operations
  - **Root Cause Analysis**: Identified FTP timeout configuration causing session drops between operations
  - **Timeout Standardization**: Unified connection timeouts to 30 seconds for both SFTP and FTP protocols
  - **Connection State Monitoring**: Added `ensureFtpConnection()` method to check and restore closed FTP connections
  - **Operation-Level Checks**: Enhanced all FTP operations (list, read, write, delete, rename, copy) with automatic reconnection
- **Enhanced Connection Reliability**: Improved connection persistence across all file operations
  - **Comprehensive Coverage**: Added connection state checks to all FTP methods including file existence and directory operations
  - **Automatic Recovery**: FTP operations now automatically detect closed connections and reconnect seamlessly
  - **User Experience**: Eliminated repetitive authentication prompts during file downloads and operations
  - **Protocol Optimization**: Leveraged `basic-ftp` library's persistent connection capabilities effectively
- **Connection Configuration Improvements**: Balanced performance and reliability in timeout settings
  - **SFTP Safety**: Maintained minimum 5-second timeout for SFTP to prevent connection handshake issues
  - **FTP Flexibility**: Implemented user-configurable timeouts while maintaining session persistence
  - **Keep-Alive Integration**: Enhanced dual keep-alive system (application-level and protocol-level) for both protocols

### Phase 19: Anonymous FTP Support and Advanced Authentication UI
- **Anonymous FTP Implementation**: Comprehensive support for anonymous FTP connections
  - **Anonymous Connection Checkbox**: Added dedicated checkbox in connection form for FTP-only anonymous access
  - **Flexible Credential Handling**: Supports both empty credentials and custom anonymous username/password combinations
  - **Protocol-Aware UI**: Anonymous option only visible for FTP protocol, automatically hidden for SFTP
  - **Automatic Credential Defaults**: Uses standard anonymous credentials (`anonymous`/`anonymous@example.com`) when fields are empty
  - **No Credential Storage**: Anonymous connections bypass password storage prompts for cleaner UX
- **Protocol-Aware Authentication System**: Dynamic authentication options based on selected protocol
  - **Dynamic Authentication Dropdown**: SFTP shows both "Password" and "SSH Key" options, FTP shows only "Password"
  - **Real-time Form Updates**: Authentication options update automatically when protocol changes
  - **SSH Key Field Management**: SSH key and passphrase fields automatically hidden when switching to FTP
  - **Seamless Protocol Switching**: Form maintains appropriate authentication state during protocol changes
- **Enhanced Password Field Implementation**: Optional password entry with intelligent management
  - **Optional Password Storage**: Password field allows empty input with prompt-on-connect fallback
  - **Smart Field Visibility**: Password field hidden when SFTP uses SSH Key authentication
  - **Proper Field Ordering**: Password field positioned below authentication type for logical form flow
  - **Secure Deletion Logic**: Password deletion only occurs when explicitly cleared after previous storage
  - **Contextual Placeholders**: Dynamic placeholder text guides users on password field behavior
- **Advanced Authentication Error Recovery**: Intelligent error handling with retry mechanisms
  - **Authentication Failure Detection**: Smart recognition of authentication errors vs. network issues
  - **Password Retry Dialog**: Modal dialog offering "Retry with different password" or "Cancel" options
  - **Credential Update Workflow**: Seamless password correction with optional secure storage
  - **Graceful Error Handling**: Fallback to original error message if retry is cancelled
  - **No UI Disruption**: Error recovery maintains connection manager state and form data
- **UI/UX Consistency Improvements**: Enhanced form behavior and user experience
  - **Advanced Settings Collapse**: Advanced connection settings always start collapsed for cleaner initial form
  - **Form Reset Consistency**: Complete form state reset including advanced settings and authentication fields
  - **Webview Modal Integration**: Replaced browser-incompatible `confirm()` with VS Code's native modal dialogs
  - **Global Function Scope**: Fixed JavaScript function accessibility for onclick handlers in webview context

### Phase 20: Critical Bug Fixes and Stream Reliability
- **SFTP Authentication Error Message Fix**: Corrected misleading error messages for password authentication
  - **Root Cause**: Error handling logic incorrectly assumed all authentication failures were SSH key errors
  - **Authentication Type Awareness**: Modified error handling to check `authType` before showing SSH key-specific messages
  - **Accurate Error Reporting**: Password authentication failures now show generic SFTP connection errors with actual failure reasons
  - **User Experience**: Eliminated confusion where users saw "SSH key authentication failed" when using password auth
- **FTP File Reading Stream Compatibility**: Resolved EventEmitter issues preventing file opening on FTP servers
  - **Stream Implementation Overhaul**: Replaced custom Writable stream with PassThrough stream for better compatibility
  - **EventEmitter Fix**: Eliminated ".once is not a function" errors that blocked FTP file operations
  - **Promise-based Error Handling**: Improved error handling with proper stream event listeners (`data`, `end`, `error`)
  - **Enhanced Reliability**: FTP file reading now works consistently across different FTP server implementations
  - **Timeout Protection**: Maintained operation timeout protection while fixing stream compatibility
- **Production Build Optimization**: Created optimized VSIX package with all fixes
  - **Bundle Size**: Maintained 339KB package size with webpack production bundling
  - **Hidden Source Maps**: Enabled debugging capabilities without exposing source code
  - **Native Module Handling**: Proper packaging of SSH2 binary dependencies for cross-platform compatibility

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
      "keyPath": "/path/to/ssh/key",
      "anonymous": false,
      "connectionTimeout": 20000,
      "operationTimeout": 60000,
      "maxRetries": 3,
      "retryDelay": 1000,
      "enableKeepAlive": true,
      "keepAliveInterval": 30000
    }
  ]
}
```

### Configuration Options
**All advanced parameters are optional with sensible defaults when left blank:**

#### Core Connection Settings
- **anonymous**: Enable anonymous FTP connection (FTP protocol only)
  - *Default*: false (disabled)
  - *Options*: true/false
  - *Effect*: When true, allows empty username/password or uses default anonymous credentials

#### Advanced Connection Settings  
- **connectionTimeout**: Connection timeout in milliseconds
  - *Default*: 30,000ms (30s) for both SFTP and FTP
  - *Range*: 5,000-120,000ms (5-120 seconds)
- **operationTimeout**: File operation timeout in milliseconds  
  - *Default*: 60,000ms (60s)
  - *Range*: 10,000-300,000ms (10-300 seconds)
- **maxRetries**: Maximum retry attempts on connection failure
  - *Default*: 3 attempts
  - *Range*: 1-10 attempts  
- **retryDelay**: Base delay between retries in milliseconds (uses exponential backoff)
  - *Default*: 1,000ms (1s)
  - *Range*: 500-10,000ms (0.5-10 seconds)
- **enableKeepAlive**: Enable automatic connection health monitoring
  - *Default*: true (enabled)
  - *Options*: true/false
- **keepAliveInterval**: Keep-alive ping interval in milliseconds
  - *Default*: 30,000ms (30s)  
  - *Range*: 10,000-300,000ms (10-300 seconds)

## Security Considerations
- Credentials stored using VSCode SecretStorage API
- SSH keys read from disk only during connection
- No credential caching in memory beyond connection duration
- PuTTY .ppk files (v2 and v3) converted to OpenSSH format in memory using ppk-to-openssh library
- SSH key processing happens securely in memory without temporary file creation
- Universal PPK support for both legacy (v2) and modern (v3) PuTTY key formats
- Temporary files organized in connection-specific directories with sanitized names
- Manual cleanup of temporary files and watchers prevents sensitive data accumulation
- Cross-platform filesystem safety with character sanitization for folder names

## Connection Identification System

The extension uses a multi-layered approach to connection identification, with different ID formats optimized for specific purposes:

### 1. File System Paths (Safe Directory Names)
- **Format**: `username-host-port` (e.g., `admin-example.com-22`)
- **Function**: `getConnectionTempDir()` → `sanitizeFileName()`
- **Purpose**: Creating temporary directories that are safe across all operating systems
- **Sanitization**: Converts unsafe characters (`@`, `:`, `\`, `/`, etc.) to safe alternatives
- **Usage**: Temp file storage at `/tmp/remote-file-browser/{sanitized-name}/`

### 2. File Watcher Tracking (Logical Identification)
- **Format**: `username@host:port` (e.g., `admin@example.com:22`)
- **Function**: `generateConnectionId()`
- **Purpose**: Logical identification for file watchers and connection validation
- **Human-readable**: Used in error messages and user feedback
- **Usage**: Tracking which connection each opened file belongs to for security validation

### 3. Credential Storage (Unique Keys)
- **Format**: `protocol-username-host-port` (e.g., `sftp-admin-example.com-22`)
- **Function**: `CredentialManager.generateConnectionId()`
- **Purpose**: Unique credential storage keys that differentiate between protocols
- **Protocol-aware**: Prevents SFTP and FTP credentials from conflicting on same server
- **Usage**: VSCode SecretStorage API keys for passwords and passphrases

### Connection Cleanup Implementation
- **File Tree Trash Icon**: Deletes temp files for current connection only (uses filesystem-safe directory targeting)
- **Connection Manager Cleanup**: Deletes temp files for ALL connections (global cleanup)
- **File Watcher Cleanup**: Uses logical connection IDs to dispose watchers for specific connections
- **Security Validation**: Prevents files from being saved to wrong servers using logical connection matching

### Welcome Screen Command Architecture
- **Dynamic Command Registration**: Pre-registers individual commands for each connection index at extension startup
- **Argument-Free Design**: Commands like `remoteFileBrowser.connectFromWelcome.2` eliminate VSCode argument parsing issues
- **Double-Click Prevention**: Global connection lock (`isAnyConnectionInProgress`) prevents concurrent connection attempts
- **Scalable Registration**: Loop-based registration supports configurable number of connections (default: 20)

## Known Limitations
- Requires system keyring software for secure credential storage
- Large files may impact performance during transfer
- No support for SFTP/FTP advanced features (tunneling, etc.)
- Limited to password and private key authentication (no certificates, multi-factor, etc.)
- Recent connections based on order in configuration (not actual usage tracking)
- Temp file management uses terminal interface for all platforms

### SSH Key Format Support
- **Universal PPK Support**: Both PuTTY PPK version 2 (PuTTY 0.52-0.74) and PPK version 3 (PuTTY 0.75+) are fully supported
- **Automatic Conversion**: PPK files are automatically converted to OpenSSH format in memory using the ppk-to-openssh library
- **Supported Formats**: OpenSSH private keys (.pem, .key) and PuTTY PPK keys (.ppk) in all versions
- **No Manual Conversion Required**: Users can use PPK files directly without any preprocessing

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

### Connection & Performance Improvements
- **Connection Pool Management**: Multiple simultaneous operations with connection lifecycle management
- **Connection Health Dashboard**: Visual dashboard showing connection metrics, uptime, and failure rates
- **Advanced Connection Profiles**: Server-specific connection settings and environment configurations
- **Connection Load Balancing**: Multiple server endpoints with automatic failover

### User Interface & Workflow
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
- Directory creation and deletion from tree view
- Bulk file upload (drag and drop multiple files)
- File permissions management in remote directories
- Breadcrumb navigation for current directory path

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

- **Bundle Size**: Reduced from 6.2MB (573 files) to 237KB (18 files) - 96% size reduction
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

## Current Release Status

### Version 2.5.2 (Latest)
**Release Date**: December 2024  
**Package Size**: 339KB (optimized)  
**Key Features**: Anonymous FTP support, protocol-aware authentication, critical bug fixes

**Major Improvements in 2.5.x Series**:
- ✅ **Anonymous FTP Support**: Full implementation with flexible credential handling
- ✅ **Protocol-Aware Authentication**: Dynamic UI showing appropriate auth options per protocol  
- ✅ **Enhanced Password Management**: Optional password storage with intelligent field management
- ✅ **Authentication Error Recovery**: Smart retry mechanisms with user-friendly dialogs
- ✅ **Critical Bug Fixes**: SFTP authentication error messages and FTP file reading reliability
- ✅ **Stream Compatibility**: Resolved EventEmitter issues with modern Node.js versions
- ✅ **Advanced Connection Settings**: Configurable timeouts, retries, and keep-alive mechanisms

**Stability**: Production-ready with comprehensive error handling and connection reliability improvements.

*For release and publishing information, see RELEASE.md*
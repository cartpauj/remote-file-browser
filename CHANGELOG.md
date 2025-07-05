# Change Log

All notable changes to the "Remote File Browser" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.4.0] - 2025-07-06

### 🎯 Enhanced Connection Management Interface
- **New Compact View Mode**: Dramatically improved connection list efficiency for users with many connections
  - Compact list view showing essential connection details in minimal space
  - Each connection now displays as a single line with protocol, username, host, and port
  - Toggle between compact and detailed card views with convenient view buttons
  - Hover effects and modern visual enhancements for better user experience

- **Advanced Search & Filtering**: Powerful real-time search functionality across all connection properties
  - 🔍 Search by connection name, hostname, username, or protocol type
  - Instant filtering as you type with live result updates
  - Search result counter showing "X of Y connections" when filtering
  - Case-insensitive search across all connection metadata

- **Improved UI/UX Design**: Modern, responsive interface optimized for all screen sizes
  - Click anywhere on compact connection cards to connect instantly
  - Enhanced status indicators for connected/connecting states with visual icons
  - Responsive grid layout that adapts to different window sizes
  - Mobile-friendly design with touch-optimized controls
  - Smooth animations and transitions for better visual feedback

- **Better Connection Management**: Enhanced workflow for managing large connection lists
  - Connection count display for better overview of saved connections
  - Optimized button layouts with consistent spacing and sizing
  - Improved accessibility with better contrast and readable text sizes
  - Quick action buttons (Edit, Clone, Delete) easily accessible in both view modes

### 🚀 Performance & Usability Improvements
- **Faster Connection Discovery**: Quickly find specific connections among hundreds of saved entries
- **Reduced Screen Space Usage**: Compact view allows viewing more connections without scrolling
- **Enhanced Visual Hierarchy**: Clear distinction between connection states and information levels
- **Streamlined Connection Workflow**: One-click connection from compact view reduces interaction steps

## [4.3.2] - 2025-07-05

### 🔧 Connection Configuration Persistence Fix
- **Resolved "No connection configuration available for reconnection" Error**: Fixed critical issue where connection config was being cleared during auto-reconnection attempts
  - Connection configuration now preserved during automatic reconnection cycles
  - `disconnect()` method updated with optional `clearConfig` parameter to distinguish between manual and automatic disconnections
  - Manual disconnects (user-initiated) clear configuration completely as expected
  - Auto-reconnects preserve configuration to enable seamless session restoration

- **Enhanced Error Handling for Lost Configurations**: Better user guidance when connection state is unrecoverable
  - Clear error message: "Connection lost: Please use the disconnect button in the Remote File Browser panel, then reconnect to restore the connection."
  - Prevents confusing "No connection configuration available" technical errors
  - Guides users to the correct recovery path through the extension UI

- **Improved Connection State Management**: More robust handling of connection lifecycle
  - Connection configuration persistence across reconnection attempts
  - Proper cleanup only during intentional disconnections
  - Automatic session restoration maintains user context and server settings
  - Reduced likelihood of orphaned connection states

### 🛡️ Reliability Improvements
- **Automatic Recovery Resilience**: Auto-reconnection system now more reliable after extended idle periods
- **Configuration State Protection**: Connection settings preserved throughout auto-recovery cycles
- **User Experience**: Eliminates need for manual disconnect/reconnect when auto-recovery encounters config issues

## [4.3.1] - 2025-07-05

### 🔄 Enhanced Auto-Reconnection & File Access
- **Session Timeout Handling**: Intelligent detection of idle session expiration (30-minute timeout)
  - Automatic reconnection when opening files after extended inactivity
  - Proactive connection validation before file operations
  - Session activity tracking to detect when server-side timeout occurs
  - Eliminates "Connection to server was lost while trying to open file" errors

- **Improved File Operations Reliability**: Enhanced error recovery for all file access scenarios
  - Automatic reconnection during file opening operations
  - Smart retry mechanism for file downloads and uploads
  - Seamless recovery from connection drops during file saves
  - Directory browsing resilience with automatic connection restoration

- **Advanced Connection Monitoring**: More robust connection health detection
  - Time-based session validation (30-minute idle timeout detection)
  - Enhanced connection alive checks for both SFTP and FTP protocols
  - Automatic connection restoration without requiring manual disconnect/reconnect
  - Real-time connection status updates during recovery operations

### 🛡️ User Experience Improvements
- **Transparent Recovery**: Background connection restoration with minimal user interruption
  - "Connection lost. Attempting to reconnect..." informational messages
  - "Reconnected successfully" confirmation after automatic recovery
  - Seamless file access after long periods of inactivity
  - No more forced manual disconnect/reconnect cycles

- **Proactive Connection Management**: Prevention of connection-related errors
  - Pre-validation of connection state before file operations
  - Automatic session refresh for long-running VS Code sessions
  - Smart detection of server-side connection drops
  - Graceful handling of network interruptions

## [4.3.0] - 2025-07-05

### 🔄 Auto-Reconnection System
- **Intelligent Connection Management**: Automatic detection and recovery from connection drops
  - Real-time connection health monitoring for both SFTP and FTP protocols
  - Automatic reconnection attempts when connection is lost during file operations
  - Smart error detection for connection-related issues (timeouts, socket errors, disconnects)
  - Graceful fallback with user-friendly error messages when auto-reconnection fails

- **Enhanced File Operations**: Robust file access with connection resilience
  - `ensureConnection()` pre-check for all file operations
  - Automatic retry mechanism for failed operations due to connection issues
  - Connection restoration without requiring manual disconnect/reconnect
  - Seamless user experience with minimal interruption during connection drops

- **Connection Health Monitoring**: Proactive connection status tracking
  - Last activity timestamp tracking for idle timeout detection
  - Protocol-specific connection validation (SFTP client state, FTP socket status)
  - Maximum reconnection attempt limits to prevent infinite retry loops
  - Real-time status updates during reconnection attempts

### 🛡️ Improved Error Handling
- **Connection Error Detection**: Comprehensive error pattern recognition
  - Socket errors, timeouts, broken pipes, connection resets
  - Protocol-specific error handling for both SFTP and FTP
  - Clear error categorization between connection issues and file system errors
  - Automatic retry logic for transient connection problems

- **User Experience Enhancements**: Better feedback during connection issues
  - "Reconnecting to server..." status messages during auto-recovery
  - "Reconnected successfully" confirmation after restoration
  - Clear error messages when manual reconnection is required
  - No more silent connection failures or confusing error states

### 🚀 Performance & Reliability
- **Reduced Manual Interventions**: Eliminates need for manual disconnect/reconnect cycles
- **Session Persistence**: Maintains user context and current directory during reconnections
- **Operation Continuity**: File operations resume seamlessly after connection restoration
- **Idle Timeout Handling**: Proactive detection and recovery from server-side idle disconnects

## [4.2.0] - 2025-07-05

### 📁 File & Folder Creation System
- **New File Creation**: Create new files directly on remote servers
  - "New File" button (📄) in Remote Files toolbar for current directory
  - Right-click context menu "New File" option for specific directories
  - Input validation prevents invalid file names and path separators
  - Automatic file creation with empty content, ready for editing
  - Smart path resolution for both toolbar and context menu usage

- **New Folder Creation**: Create new directories on remote servers
  - "New Folder" button (📁) in Remote Files toolbar for current directory  
  - Right-click context menu "New Folder" option for specific directories
  - Input validation prevents invalid folder names and reserved characters
  - Automatic directory creation with proper permissions
  - Intelligent parent directory detection and path construction

### 🚀 Enhanced User Experience
- **Dual Access Methods**: Both toolbar buttons and context menu options available
- **Smart Context Detection**: Commands work on current directory (toolbar) or selected directory (context menu)
- **Instant Feedback**: Success/error messages with file/folder names
- **Cache Management**: Automatic cache clearing and view refresh after creation
- **Professional UI**: Consistent iconography with VS Code's native file explorer

### 🛠️ Technical Improvements
- **Protocol Support**: Full SFTP and FTP compatibility for file/folder creation
- **Operation Locking**: Prevents concurrent creation operations on same paths
- **Error Handling**: Comprehensive error catching with user-friendly messages
- **Path Validation**: Smart input validation prevents common naming issues
- **Cache Optimization**: Efficient directory cache clearing for instant view updates

### 🔧 Connection Manager Enhancements
- **createFile()**: New method for creating empty files on remote servers
- **createDirectory()**: New method for creating directories with proper error handling
- **Enhanced Locking**: Operation locks prevent duplicate creation attempts
- **Protocol Abstraction**: Unified interface for both SFTP and FTP directory creation

## [4.1.0] - 2025-07-05

### 🔍 Smart File Search & Filtering
- **Real-time File Search**: Added intelligent search functionality to quickly filter files and directories
  - Search icon (🔍) in Remote Files toolbar for easy access
  - Clear icon (🗙) appears when search is active for quick filter removal
  - Case-insensitive partial matching finds files containing search terms
  - Maintains directory structure and sorting during search
  - Works on current directory content with instant results
  - Status messages confirm search activation and clearing

### 🎨 Enhanced File Icon System
- **VS Code Theme-Compatible Icons**: Revolutionized file icon display with intelligent type detection
  - Smart file extension mapping to appropriate VS Code theme icons
  - Code files: JavaScript, TypeScript, Python, Java, C/C++, PHP, Ruby, Go, Rust, Swift, Kotlin
  - Web files: HTML, CSS, SCSS, SASS, XML, JSON, YAML with specialized icons
  - Media files: Images (PNG, JPG, SVG, etc.) with media-specific icons
  - Documents: PDF, DOC, TXT, Markdown with document-themed icons
  - Archives: ZIP, RAR, 7Z, TAR with compression-themed icons
  - Config files: Settings, environment, Git files with gear icons
  - Database files: SQL, DB, SQLite with database icons
  - Terminal scripts: Shell, Batch, PowerShell with terminal icons
  - Folders: Dynamic folder/folder-opened icons based on expansion state
  - Generic fallback: Unknown file types use standard file icon

### 🚀 User Experience Improvements
- **Enhanced Visual Organization**: File types are immediately recognizable through consistent iconography
- **Improved Navigation**: Search functionality makes large directories manageable
- **Professional Interface**: Icons match VS Code's native file explorer for seamless integration
- **Accessibility**: Better visual cues help users identify file types at a glance

### 🛠️ Technical Enhancements
- **Resource URI Support**: Files now have proper resource URIs for enhanced VS Code integration
- **Context-Aware Commands**: Search and clear commands appear contextually in toolbar
- **State Management**: Search state properly tracked with VS Code context system
- **Performance Optimized**: File filtering operates efficiently on large directory listings

## [4.0.0] - 2025-06-28

### 🛡️ Operation Protection System
- **Revolutionary Concurrent Operation Prevention**: Advanced protection against duplicate and conflicting operations
  - Connection protection prevents multiple simultaneous connection attempts
  - File operation locks prevent concurrent operations on same files (`read:path`, `write:path`, `delete:path`, `rename:path`)
  - VSCode preview mode compatibility protects against rapid click-induced duplicate operations
  - Automatic cleanup of operation locks on disconnection and operation completion
  - Clear error messages: "File operation already in progress" when attempting duplicate operations

### 🚀 Enhanced Connection Management  
- **SFTP Connection Timing Fixes**: Proper connection readiness detection eliminates "SFTP connection is not ready" errors
  - Waits for `connectionReady` event before allowing file operations
  - 10-second timeout with graceful fallback for connection establishment
  - Separate connection status for SFTP vs FTP protocols
  - Enhanced connection state management prevents premature operations

### 📊 Status Bar Improvements
- **Eliminated Duplicate Status Messages**: Fixed "downloading, downloaded, downloading..." cycles
  - Proper timer cancellation prevents overlapping status message timers
  - All temporary messages return to clean connected state instead of restoring previous messages
  - Clean status transitions with no stuck or hanging messages
- **Disconnect Status Messages**: Added "Disconnecting from [host]" confirmation feedback
- **Enhanced Progress Tracking**: Improved status message reliability and consistency

### 🔧 Library Updates
- **Pure-js-sftp 5.0.1**: Updated from local development version to latest stable npmjs.com release
  - Improved stability and compatibility with official published version
  - Better npm ecosystem integration and dependency management
  - Enhanced security with verified published packages

### 💡 User Experience Improvements
- **Single-Click File Opening**: Documented proper VSCode file opening behavior (single-click, not double-click)
- **Preview Mode Protection**: Enhanced compatibility with `workbench.editor.enablePreview` setting
- **Operation Feedback**: Clear error messages and status updates for all operations
- **Connection State Awareness**: Better visual feedback for connection states and transitions

### 🐛 Bug Fixes
- Fixed connection timing issues causing premature file operation attempts
- Resolved duplicate status message cycles in progress tracking
- Eliminated race conditions in rapid file operation scenarios
- Improved error handling for concurrent operation attempts

### 📚 Documentation Updates
- Comprehensive documentation of operation protection features
- Enhanced troubleshooting section with VSCode-specific tips
- Updated README with all new reliability improvements
- Added notes about single-click vs double-click behavior

## [3.4.0] - 2025-06-27

### Major Architectural Improvements
- **🏗️ GlobalStateManager**: Introduced centralized state management system for file watchers and upload tracking
  - Singleton pattern prevents memory leaks and resource conflicts
  - Proper cleanup on extension deactivation with comprehensive disposal methods
  - Upload tracking with stale upload detection and automatic cleanup
  - File watcher management with connection-specific cleanup capabilities
- **📁 Template Externalization**: Moved 935-line HTML template to separate file for better maintainability
  - Connection manager template now in `templates/connection-manager.html`
  - Webpack copy plugin automatically includes templates in build output
  - Fallback template system with error handling for missing template files
  - Improved code organization with separation of concerns

### Code Quality & Performance
- **🧹 Function Decomposition**: Broke down complex 140-line function into focused, maintainable components
  - `handleSSHKeyAuthentication()` - Dedicated SSH key and passphrase management
  - `handlePasswordAuthentication()` - Streamlined password authentication workflow  
  - `isAuthenticationError()` - Enhanced error pattern detection for smart retry logic
  - `handleAuthenticationRetry()` - Intelligent retry mechanism with user confirmation
  - Improved readability and testability with single-responsibility functions
- **🔧 Magic Number Elimination**: Replaced hardcoded values with named constants throughout codebase
  - `SUCCESS_MESSAGE_DURATION = 3000` - Status bar success message timing
  - `ERROR_MESSAGE_DURATION = 5000` - Error message display duration
  - `TEMP_MESSAGE_DURATION = 3000` - Temporary notification timing
  - `CLICK_DEBOUNCE_MS = 500` - Welcome view click debouncing
  - `MAX_SAVED_CONNECTIONS = 20` - Connection storage limit

### Bug Fixes
- **🐛 Duplicate Upload Status Fix**: Resolved critical issue where status bar showed false "Uploading..." messages
  - Fixed status restoration logic in `showTempMessage()` to detect upload progress states
  - Prevents misleading duplicate upload indicators after file operations complete
  - Improved user experience with accurate upload progress feedback
- **🔗 Method Signature Cleanup**: Removed unused `timeoutMs` parameters from status manager methods
  - Simplified API surface with consistent parameter patterns across all status methods
  - Eliminated potential confusion from unused optional parameters
  - Enhanced type safety and code maintainability

### Build System Enhancements
- **📦 Webpack Template Copying**: Added copy-webpack-plugin to build process
  - Automatic template file inclusion in extension output
  - Development and production build compatibility
  - Proper resource management for external HTML templates

### Removed/Simplified Features
- **🗑️ Advanced Connection Settings Removal**: Streamlined connection configuration by removing complex settings
  - Removed `maxRetries` configuration option - now uses sensible built-in defaults
  - Removed `enableKeepAlive` setting - keep-alive handled automatically by underlying libraries
  - Removed `retryDelay` configuration - simplified to use exponential backoff without user configuration
  - Simplified connection interface focuses on essential settings only (host, port, auth, timeouts)
- **🔧 Automatic Retry Logic**: Replaced user-configurable retry settings with intelligent built-in behavior
  - Smart retry detection based on error type rather than blanket retry counts
  - Connection libraries handle keep-alive and reconnection automatically
  - Reduced configuration complexity while maintaining reliability

### Technical Debt Reduction
- **♻️ Resource Management**: Enhanced cleanup procedures and memory management
  - Comprehensive disposal patterns for all extension resources
  - Connection-specific cleanup for temporary files and watchers
  - Proper lifecycle management preventing resource leaks
- **🎯 Type Safety**: Improved TypeScript usage with better interface definitions
  - Enhanced type checking for state management operations
  - Cleaner generic usage and better error handling patterns

### Developer Experience
- **📚 Code Organization**: Improved project structure and separation of concerns
  - Template files properly organized in dedicated directory
  - State management isolated in dedicated manager class
  - Clear architectural boundaries between components
- **🔍 Debugging Support**: Enhanced debug capabilities with centralized state inspection
  - `getDebugInfo()` method for runtime state analysis
  - Better error tracking and resource monitoring
  - Improved development workflow with cleaner abstractions

## [3.3.2] - 2025-06-21

### Fixed
- **User Manual Cross-Platform Compatibility**: Fixed "readme.md not found" error in Cursor IDE
  - Made README.md file lookup case-insensitive to work across different editors
  - Now tries multiple filename variations (README.md, readme.md, Readme.md)
  - Ensures User Manual button works consistently in both VSCode and Cursor

## [3.3.1] - 2025-06-21

### Added
- **User Manual Access**: Added "User Manual" option to welcome view
  - Accessible directly from the welcome screen below "Manage Connections"
  - Opens README.md in read-only markdown preview mode
  - Provides easy access to extension documentation and usage instructions

## [3.3.0] - 2025-06-21

### Added
- **FTPS (FTP over TLS) Support**: Secure FTP connections with TLS encryption
  - Enable FTPS checkbox in FTP connection settings
  - Support for both Explicit FTPS (port 21, upgrade to TLS) and Implicit FTPS (port 990, TLS from start)
  - Automatic port switching based on FTPS mode selection
  - Full integration with basic-ftp library TLS capabilities
- **URL Protocol Stripping**: Automatically strip http:// and https:// from host fields
  - Prevents connection errors when users paste web URLs into host fields
  - Applied to both SFTP and FTP connection types
  - Maintains clean host configuration in saved connections

### Improved
- **Enhanced Connection Form**: Better organization of protocol-specific settings
- **Smart Port Management**: Automatic port updates based on protocol and security settings

## [3.2.2] - 2025-06-21

### Fixed
- **Double Connection Prevention**: Added protection against multiple simultaneous connection attempts from connection manager
  - Prevents users from clicking connect buttons rapidly on multiple connection items
  - Eliminates race conditions that could cause connection conflicts or unexpected behavior
  - Connection manager now properly handles rapid successive clicks with proper state management

## [3.2.1] - 2025-06-21

### Added
- **Smart Connection State Management**: Enhanced connection manager with intelligent connection handling
  - Visual connection state indicators with green border and "● Connected" status for active connections
  - Context-aware Connect/Disconnect buttons that change based on current connection state
  - Connection switching confirmation dialog prevents accidental disconnections
  - Same connection protection with "Already connected" feedback for redundant connection attempts
- **Improved Welcome View Organization**: 
  - Renamed "Recent Connections" to "Existing Connections" for clearer terminology
  - Alphabetical sorting of all saved connections for better organization
  - Removed arbitrary 10-connection limit to show all saved connections

### Enhanced
- **Connection Manager User Experience**: 
  - Connection manager window now stays open after connecting for easy server switching
  - Real-time UI updates reflect current connection state immediately
  - Red disconnect button styling for clear distinction from connect actions
  - Automatic disconnect before connecting to new server with user confirmation
- **Connection Workflow**: Streamlined server switching with proper cleanup and confirmation dialogs

### Fixed
- **Modal Dialog Issue**: Removed duplicate "Cancel" button in connection switching confirmation dialog
- **Connection State Sync**: Connection manager now properly reflects current connection state when opened

## [3.2.0] - 2025-06-21

### Added
- **Enhanced Connection Progress Indicators**: Comprehensive visual feedback system for connection attempts
  - Status bar shows detailed connection stages: "Establishing connection...", "Authenticating...", "Loading files..."
  - Welcome view spinners synchronized across both connection manager and welcome view connections
  - Persistent connected state in status bar: "🔌 [host] ✖️" with clickable disconnect functionality
  - Connection retry attempts display progress counters: "Retrying connection (2/3)..."
- **Non-Intrusive Notification System**: Smart notification management for better user experience
  - Success confirmations moved to brief status bar messages instead of popup dialogs
  - Auto-dismissing notifications (3-5 seconds) for file operations, credential storage, and connection management
  - Status bar messages for: "Password saved securely", "Uploaded filename.txt", "Connection deleted", "Temp files cleaned up"
  - Critical alerts (errors, confirmations, safety warnings) remain as popups when user attention is required

### Enhanced
- **Connection Status Management**: Improved connection state tracking and visual feedback
  - Status bar connection indicator remains visible throughout connection session
  - Click-to-disconnect functionality directly from status bar
  - Tooltip guidance: "Connected to [host] - Click to disconnect"
  - Consistent spinner behavior regardless of connection initiation method (welcome view vs connection manager)
- **User Experience**: Eliminated 26+ annoying popup messages while preserving critical safety notifications
  - File operation confirmations now appear as brief status bar notifications
  - Connection management operations provide subtle feedback without interrupting workflow
  - Error messages and data loss prevention confirmations remain as attention-demanding popups
- **Documentation**: Updated README.md with comprehensive coverage of new connection experience features

### Technical
- **Connection Status Manager**: New ConnectionStatusManager class handles all status bar notifications
  - Centralized status management with automatic cleanup and state transitions
  - Temporary message system with configurable duration and restoration of previous state
  - Integration with existing connection lifecycle for seamless status updates

## [3.1.0] - 2025-06-20

### Added
- **Connection Cloning**: Added "Clone" button to Connections Manager with confirmation dialog
  - One-click duplication of connection configurations
  - Automatically prefixes cloned connections with "copy of "
  - Streamlines setup for similar server environments
- **Enhanced Temp File Push**: Smart destination choice for temporary files in "Push to Remote"
  - When pushing temp files from `/tmp/`, users get choice between "Original Location" and "Current Location"
  - Original Location: uploads back to where file was downloaded from
  - Current Location: uploads to currently selected directory in remote tree
  - Regular local files continue to upload directly to current selection
- **Improved Current Directory Tracking**: Fixed remote directory selection logic
  - Clicking on files now correctly updates current directory to file's parent directory
  - Accurate path display in push destination dialogs
  - Fixed double slash issue in root directory paths

### Enhanced
- **Connection Manager UI**: Streamlined FTP connection interface
  - Authentication dropdown automatically hidden for FTP connections (only password supported)
  - Cleaner form with protocol-appropriate options
  - Improved user experience with context-aware controls
- **Password Management**: Enhanced credential handling in connection editing
  - Stored passwords now pre-fill when editing existing connections
  - Secure retrieval from VSCode's credential storage
  - Better user feedback for password loading status
- **Path Handling**: Improved remote path construction and validation
  - Fixed root directory double slash display issues
  - Better path normalization for both SFTP and FTP protocols
  - Consistent behavior across all upload scenarios

### Fixed
- **FTP Authentication UI**: Authentication dropdown no longer appears for FTP connections
- **Password Pre-filling**: Editing connections now correctly displays stored passwords
- **Directory Selection**: Current remote directory properly updates when selecting files
- **Path Display**: Eliminated `//filename` formatting in root directory scenarios

## [3.0.0] - 2025-01-20

### Major Code Cleanup & Modernization
- **BREAKING**: Removed legacy ssh2StreamsSigningFix workaround - now uses pure-js-sftp 4.0.1's native ssh2-streams integration
- **Performance**: Eliminated all debug logging throughout the codebase for cleaner production experience
- **Dependencies**: Updated to pure-js-sftp 4.0.1 with modern SSH key handling
- **Code Quality**: Removed unused imports and dead code throughout the project
- **Architecture**: Simplified codebase by removing obsolete workarounds and patches

### Documentation
- **README**: Complete 100% accuracy review and update of all documentation
- **Timeouts**: Fixed connection timeout documentation (20s SFTP, 30s FTP)
- **Commands**: Clarified difference between "Clean Up Connection Temp Files" vs "Clean Up All Temp Files"
- **Security**: Updated SSH key format support documentation (OpenSSH & PuTTY PPK v2/v3)
- **Examples**: Corrected all configuration examples to match actual implementation

### Removed
- **ssh2StreamsSigningFix.ts**: Obsolete workaround file completely removed
- **Unused imports**: Removed `Writable` from stream imports and other unused dependencies
- **Unused commands**: Removed `connectFromWelcomeDebounced` command definition
- **Debug logging**: All console.log/debug/warn/error statements removed from production code

### Technical Improvements
- **Pure SSH Implementation**: Now relies entirely on pure-js-sftp 4.0.1's native ssh2-streams SSH capabilities
- **Cleaner Dependencies**: Eliminated unnecessary polyfills and workarounds
- **Better Performance**: Reduced bundle size and memory footprint
- **Maintainability**: Simplified architecture with modern dependency management

## [2.5.6] - 2025-01-06

### Fixed
- **Authentication Reliability**: Improved case-insensitive handling of authType comparisons to prevent authentication method detection issues

## [2.5.4] - 2024-12-12

### Added
- **Enhanced Connection Manager UX**: Connection form now hidden by default with green "Add New Connection" button for cleaner interface
- **Welcome Screen Context Menus**: Right-click "Manage Connections" for "Add New Connection" option
- **Connection Context Menus**: Right-click any saved connection for "Edit Connection" and "Delete Connection" options
- **Smart Form Visibility**: Form automatically appears when adding/editing and hides after successful operations
- **Pinned Activity Bar Icon**: Remote Files globe icon now visible by default upon installation

### Enhanced
- **Form Behavior**: Auto-hide functionality with context-aware button management during form interactions
- **Cross-Interface Integration**: Seamless communication between welcome screen and connection manager
- **User Experience**: Streamlined workflows with multiple access methods for connection management
- **Documentation**: Updated README and PROJECT-SCOPE with comprehensive coverage of new features

## [2.5.3] - 2024-12-12

### Fixed
- **SFTP Authentication Error Messages**: Fixed misleading "SSH key authentication failed" errors when using password authentication
- **FTP File Reading**: Resolved EventEmitter compatibility issues that prevented opening files on FTP servers  
- **Authentication Dialog UI**: Fixed duplicate "Cancel" buttons in authentication retry dialogs
- **Handshake Timeout Detection**: Improved recognition of authentication timeouts as authentication failures

### Added
- **Anonymous FTP Support**: Full support for anonymous FTP connections with flexible credential handling
- **Protocol-Aware Authentication UI**: Dynamic form showing appropriate authentication options (SFTP: Password/SSH Key, FTP: Password only)
- **Optional Password Storage**: Password field with intelligent management - enter to store securely or leave empty for connection-time prompts
- **Authentication Error Recovery**: Smart retry mechanisms with "Retry with different password" option for failed authentications

### Enhanced
- **Advanced Settings UI**: Advanced connection settings now always start collapsed for cleaner form appearance
- **Form Field Ordering**: Improved logical flow with password field positioned below authentication type
- **Webview Compatibility**: Replaced browser-incompatible confirm() dialogs with VS Code native modal dialogs
- **Stream Reliability**: Enhanced FTP file operations using PassThrough streams for better compatibility across server implementations

## [2.5.2] - 2025-12-06

### Fixed
- **Connection Manager Delete Button**: Fixed delete button in connections manager not working due to webview sandboxing restrictions
- **Modal Dialog Support**: Replaced unsupported confirm() dialog with VS Code's native showWarningMessage() for proper user confirmation
- **JavaScript Function Scope**: Corrected function placement to ensure onclick handlers are properly accessible in webview
- **Credential Cleanup**: Enhanced connection deletion to properly clean up stored passwords and SSH key passphrases

## [2.5.1] - 2025-01-11

### Fixed
- **FTP Connection Persistence**: Resolved critical FTP re-authentication issues that occurred between file operations
- **Connection Timeout Optimization**: Standardized connection timeouts to 30 seconds for both SFTP and FTP protocols
- **FTP Session Management**: Enhanced FTP operations with automatic connection state checking and seamless reconnection
- **Operation Coverage**: Added connection persistence checks to all FTP operations (list, read, write, delete, rename, copy, file existence)

### Enhanced
- **Connection Reliability**: Improved FTP connection stability by leveraging basic-ftp library's persistent connection capabilities
- **User Experience**: Eliminated repetitive authentication prompts during file downloads and operations
- **Documentation**: Updated README.md and PROJECT-SCOPE.md to reflect current timeout defaults and connection improvements

## [2.4.1] - 2025-01-06

### Enhanced
- Universal PPK support for both version 2 and version 3 files
- Updated ppk-to-openssh library to latest version (1.2.2) with improved reliability
- Enhanced PPK conversion error handling and user feedback

### Fixed
- PPK v3 file parsing issues that prevented connections
- Improved compatibility with modern PuTTY key formats

## [2.4.0] - 2025-01-06

### Added
- Full PPK v2 and v3 support using ppk-to-openssh package
- Automatic PPK file detection and conversion to OpenSSH format
- Enhanced passphrase handling for encrypted PPK files
- Improved error messages for PPK conversion issues

### Changed
- Replaced limited ssh2 PPK support with robust ppk-to-openssh conversion
- Updated ppk-to-openssh dependency to version 1.1.1

## [2.3.8] - 2025-01-06

### Enhanced
- Enhanced PPK version detection with automatic version parsing from file headers
- Improved error handling for PPK v3 keys with clear conversion guidance
- Added proactive warnings when PPK v3 files are detected
- Updated documentation with comprehensive PPK v2/v3 compatibility information
- Created dedicated RELEASE.md file for streamlined publishing process

### Fixed
- Better error messages for unsupported PPK key formats
- Enhanced connection error handling with specific guidance for key format issues

## [2.3.7] - 2024-12-10

### Fixed
- Fixed connections manager window where connections list would disappear after connecting to a server and downloading files
- Improved webview loading sequence to ensure connections are properly displayed when returning to the manager tab

## [2.3.6] - 2025-06-09

### Enhanced
- Improved README with better feature highlights and clearer benefits
- Enhanced documentation for better user experience

## [2.3.5] - 2025-06-09

### Fixed
- Update ssh2-sftp-client to v12.0.0 to resolve file opening errors
- Update basic-ftp to v5.0.5 for improved stability
- Update TypeScript to v5.8.3 for better compatibility

## [2.3.4] - 2025-06-09

### Added
- **File Copy Operation**: New "Copy" context menu option for files and directories with comprehensive functionality
  - Pre-populated input dialog with current file path to save user typing
  - Real-time validation prevents invalid copies (empty paths, circular directory copies, etc.)
  - Recursive directory copying handles entire folder structures with all contents
  - Copied files automatically open in new editor tabs alongside originals (not replacing existing tabs)
  - Progress notifications show copy status and completion
- **File Download Operation**: New "Download" context menu option that opens files in editor (equivalent to double-clicking)
- **Universal Overwrite Protection**: Both copy and move operations now include comprehensive file existence checking
  - File existence detection checks target paths for existing files/directories before operations
  - User confirmation dialog with "Overwrite" or "Cancel" options when conflicts detected
  - Cross-protocol support works for both SFTP (stat-based) and FTP (directory listing-based)
  - Safe operation flow only proceeds with explicit user consent to overwrite existing files

### Enhanced
- **Editor Tab Behavior**: All file operations now use `preview: false` to ensure files open in permanent tabs instead of preview tabs
- **User Experience Documentation**: Added comprehensive tips for customizing VSCode file opening behavior
  - Instructions for disabling preview tabs (`workbench.editor.enablePreview: false`)
  - Instructions for requiring double-click to open files (`workbench.list.openMode: "doubleClick"`)
  - Clear explanations of how these settings affect all VSCode operations

### Fixed
- **Copy Tab Issue**: Copying files now opens copied files in new tabs instead of updating existing tabs
- **File Operation Safety**: Prevents accidental overwrites with mandatory user confirmation for existing files

## [2.3.3] - 2025-06-09

### Added
- **File Move Operation**: New "Move" context menu option for files and directories with comprehensive functionality
  - Pre-populated input dialog with current file path to save user typing
  - Real-time validation prevents invalid moves (empty paths, circular directory moves, etc.)
  - Smart error handling with specific messages and recovery suggestions for common failure scenarios
  - Automatic editor tab updates when moving open files (preserves cursor position and selection)
  - Seamless temporary file synchronization to match new remote paths
  - Progress notifications during move operations with completion status
- **Tree Indentation Documentation**: Added user tip for improving VSCode tree view visibility

### Enhanced
- **Comprehensive Move Error Handling**: Detailed error messages and recovery options for:
  - Directory doesn't exist errors with creation guidance
  - Permission denied errors with chmod instructions  
  - File exists conflicts with resolution suggestions
  - Network timeout errors with automatic retry option
- **Editor Integration**: Moving files automatically updates open editor tabs while preserving all editor state
- **Command Palette Integration**: Added "Remote File Browser: Move File" command for keyboard access

## [2.3.2] - 2025-06-09

### Fixed
- **Welcome Screen Double-Click Prevention**: Fixed "Actual command not found" error when double-clicking connections in welcome screen
- **VSCode Command Argument Bug**: Resolved issue where VSCode misinterpreted connection indexes as file paths (e.g., `/2`)
- **Connection-Specific Cleanup**: Fixed trash icon to delete temp files for current connection only instead of all connections
- **Directory Structure Targeting**: Corrected temp file cleanup to use proper connection-specific directory paths

### Enhanced
- **Dynamic Command Registration**: Pre-registers individual commands for each connection to eliminate argument parsing issues
- **Global Connection Lock**: Added bulletproof double-click prevention with simple boolean flag
- **Argument-Free Commands**: Eliminated command arguments entirely for more reliable VSCode tree item command execution
- **Multi-Layered Connection ID System**: Clarified separation of concerns for filesystem paths, file watcher tracking, and credential storage

## [2.3.1] - 2025-06-09

### Fixed
- **File Opening Error**: Fixed "TypeError: e.once is not a function" error that could occur when opening remote files
- **File Watcher Stability**: Added defensive programming to prevent crashes when file watcher disposables are invalid
- **Error Handling**: Improved error messages for connection-related file opening issues

## [2.3.0] - 2025-06-09

### Added
- **Advanced Connection Management**: Comprehensive timeout and retry configuration for both SFTP and FTP protocols
- **Configurable Connection Timeouts**: User-customizable timeouts (20s SFTP, 30s FTP defaults) with 5-120 second range
- **Operation-Specific Timeouts**: Separate timeout controls for file operations (10-300 seconds, 60s default)
- **Enhanced Retry Strategy**: Exponential backoff with configurable attempts (1-10, default 3) and base delay (0.5-10s, default 1s)
- **Smart Keep-Alive System**: Automatic connection health monitoring with configurable ping intervals (10-300s, default 30s)
- **Connection Health Monitoring**: Real-time tracking of uptime, success/failure rates, consecutive failures, and connection status
- **Right-Click File Management**: Context menu options for renaming and deleting files/directories on remote servers
- **Push to Remote**: Right-click on local file tabs to upload files to selected remote directories
- **Collapsible Advanced Settings**: Clean UI with expandable advanced configuration section in connection manager
- **Professional Form Styling**: Improved checkbox styling and form layout with VS Code theme integration

### Enhanced
- **Connection Manager UI**: Extended form with optional advanced timeout and retry configuration settings
- **Protocol-Aware Defaults**: Different default timeouts for SFTP vs FTP based on typical usage patterns
- **Smart Form Behavior**: Auto-populates defaults, protocol-aware timeout switching, and intelligent expansion of advanced settings
- **Comprehensive Error Recovery**: Improved operation-level recovery with intelligent reconnection and health status tracking
- **Cross-Platform Reliability**: Enhanced connection stability across Windows, macOS, and Linux platforms

### Improved
- **Connection Reliability**: Robust error handling with 16+ error pattern detection including network and protocol-specific failures
- **User Experience**: Form shows sensible defaults, smooth transitions, and prevents layout jumping on hover
- **Documentation**: Updated PROJECT-SCOPE.md and README.md with comprehensive configuration guidance

### Technical
- **Performance Optimization**: Operation timeout wrapper for all file operations with automatic success/failure tracking
- **Health Status API**: New `getConnectionHealth()` method providing detailed connection metrics
- **Backward Compatibility**: Existing connections seamlessly upgraded with new reliability features

## [2.2.3] - 2025-06-09

### Changed
- **Simplified PPK File Handling**: Replaced complex sshpk library with native ssh2 PPK support for better reliability
- Removed unnecessary dependencies: `sshpk` and `@types/sshpk` packages eliminated
- Streamlined SSH key processing by leveraging ssh2-sftp-client's built-in PPK capabilities

### Fixed
- **Improved PPK File Compatibility**: Fixed encrypted PPK file passphrase handling that was failing with sshpk library
- Resolved PPK file decryption issues by using ssh2's native PPK parsing
- Enhanced error handling for invalid passphrases with clearer user feedback

### Performance
- **Reduced Bundle Size**: Extension size decreased from 279KB to 237KB (42KB reduction)
- **Simplified Codebase**: Connection manager code reduced from 19KB to 6.65KB
- **Faster Loading**: Removed 30+ unnecessary packages from dependency tree
- **Cleaner Output**: Eliminated debug console logging for production builds

## [2.2.2] - 2025-06-09

### Fixed
- **Enhanced PPK File Parsing**: Improved PuTTY .ppk file parsing with better error handling and validation
- Added proper filename context to sshpk parsing for more accurate error diagnostics
- Enhanced SSH key validation with fallback strategy for better compatibility
- Improved error messages for encrypted PPK files requiring passphrases
- Added comprehensive logging for SSH key format detection and parsing failures

## [2.2.1] - 2025-06-09

### Fixed
- Fixed broken "cartpauj" link in extension Resources menu that was pointing to `file:///cartpauj`
- Updated author field in package.json to include proper GitHub profile URL

## [2.2.0] - 2025-06-09

### Added
- **PuTTY .ppk File Support**: Added automatic conversion of PuTTY private key files to OpenSSH format
- Enhanced SSH key authentication to support both OpenSSH (.key, .pem, .openssh) and PuTTY (.ppk) formats
- Updated file browser filters to include .ppk files for easier key selection
- Added `sshpk` library for robust SSH key parsing and format detection

### Changed
- Improved SSH Key Authentication section in connection manager with format-specific guidance
- Enhanced file browser with dedicated PuTTY key filter
- Updated documentation to reflect new .ppk file support

### Security
- PuTTY .ppk files converted in memory without creating temporary files
- Maintained existing security principles for credential and key handling
- No changes to existing OpenSSH key processing (backward compatible)

## [2.1.2] - 2025-06-09

### Security
- **Connection-Aware File Watchers**: Implemented validation to prevent files from being uploaded to wrong servers
- Added connection tracking for each opened file to ensure files are only saved to their originating connections
- Enhanced file watcher storage to track connection metadata (username@host:port)
- Introduced clear error messages when attempting to save files to different servers

### Fixed
- Prevented data loss scenarios where files could be accidentally uploaded to wrong servers in multi-server workflows
- Fixed potential security issue where development files could overwrite production files when switching connections
- Maintained cross-platform compatibility while adding security validation

## [2.1.1] - 2025-06-09

### Fixed
- Updated missing changelog entry for version 2.1.0

## [2.1.0] - 2025-06-09

### Changed
- Improved Windows compatibility and support
- Updated project documentation and scope

### Fixed
- Windows-specific path handling and file operations
- Documentation updates for better clarity

## [2.0.0] - 2025-01-09

### Added
- VSCode Marketplace publishing with complete metadata
- Extension icon (128x128 PNG format)
- Comprehensive keywords for better discoverability
- GPL v3 license
- Repository URLs and bug tracking links
- Marketplace-ready package configuration

### Changed
- Updated package.json with complete marketplace metadata
- Improved README.md for marketplace standards
- Enhanced documentation with installation and build instructions
- Responsive connection manager interface
- Updated project documentation and scope

### Fixed
- Package bundling and distribution optimization
- Extension metadata completeness for marketplace

## [1.0.0] - 2025-01-09

### Added
- Initial stable release
- Complete remote file browsing functionality
- SFTP and FTP protocol support
- Secure credential storage using VSCode SecretStorage API
- Activity bar integration with globe icon
- Dynamic welcome screen with recent connections
- Connection manager GUI with form-based configuration
- SSH key authentication support with file browser
- On-demand file access with persistent temporary files
- Auto-sync on save functionality
- File watcher for change detection
- Manual cleanup of temporary files
- Cross-platform compatibility
- Webpack bundling for optimized distribution

### Security
- Passwords and SSH key passphrases stored in OS keychain
- No plaintext credential storage
- User consent for credential storage
- Graceful fallback for missing keyring software

## [0.0.1] - 2025-01-08

### Added
- Initial development release
- Basic remote file browsing capability
- Core SFTP/FTP connection management
- File tree provider for remote directories
- TypeScript foundation and build configuration

---

## Release Notes

### Version 2.0.0
This version marks the official VSCode Marketplace release with complete metadata, licensing, and marketplace compliance. The extension is now publicly available for installation through the VSCode Extensions Marketplace.

### Version 1.0.0
The first stable release provides complete remote file browsing functionality with secure credential management, intuitive user interface, and robust file operations. All core features are implemented and tested.

### Multi-Window Compatibility Notice
Current versions have known limitations with multiple VSCode/Cursor windows connecting to the same server simultaneously. This may cause file conflicts and synchronization issues. Future versions will address these limitations with enhanced isolation and coordination mechanisms.

## Future Roadmap
- Multi-window safety improvements
- Enhanced file operations (copy, move, delete)
- Connection testing functionality
- Transfer progress indicators
- Advanced SFTP features support
- Usage-based recent connections tracking
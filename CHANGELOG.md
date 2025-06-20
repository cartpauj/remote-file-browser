# Change Log

All notable changes to the "Remote File Browser" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
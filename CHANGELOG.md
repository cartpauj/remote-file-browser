# Change Log

All notable changes to the "Remote File Browser" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
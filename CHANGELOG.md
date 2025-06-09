# Change Log

All notable changes to the "Remote File Browser" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
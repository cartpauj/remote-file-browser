# Remote File Browser Extension

Edit remote files seamlessly in VSCode/Cursor with instant access and automatic sync. No more downloading entire directories or juggling multiple tools.

## ✨ Key Features

🚀 **Instant File Access** - Open remote files directly in your editor without downloading entire directory structures

🔄 **Auto-Sync on Save** - Changes automatically upload to your server when you hit `Ctrl+S` / `Cmd+S`

🔐 **Secure Authentication** - Full support for SSH keys (OpenSSH & PuTTY PPK v2/v3) with revolutionary RSA-SHA2 compatibility for modern SSH servers, password auth, and secure credential storage

📁 **Complete File Management** - Rename, move, copy, and delete files/directories directly on the remote server

⬆️ **One-Click File Upload** - Push local files to remote servers with a simple right-click menu

🌐 **Multiple Protocol Support** - Works with SFTP, FTP, and secure FTPS (FTP over TLS) connections, including anonymous FTP

⚡ **Quick Connect** - Save multiple server configurations and connect with a single click

🗂️ **Smart File Organization** - Organized temporary file storage prevents conflicts between different servers

🖥️ **Intuitive GUI Interface** - Beautiful, user-friendly connection manager with visual forms instead of complex configuration files

🎯**Context Menu Integration** - All operations available via right-click menus and command palette

⚠️ **Overwrite Protection** - Built-in safeguards prevent accidental file replacement

📊 **Enhanced Connection Progress** - Real-time progress tracking with percentage indicators and advanced file transfer monitoring

🚀 **Revolutionary Performance** - Powered by pure-js-sftp 5.0.0 with 4x faster transfers (20+ MB/s), automatic server adaptation, and intelligent reconnection

🔇 **Non-Intrusive Notifications** - Smart notification system that uses status bar messages instead of disruptive popups

🛡️ **Operation Protection** - Advanced concurrent operation prevention system protects against duplicate file operations and connection conflicts

## Getting Started

### Initial Setup

1. **Open the Remote File Browser**
   - Click the globe icon (🌐) in the activity bar on the left side of your editor

2. **Add Your First Connection**
   - Click **"Manage Connections"** in the welcome screen
   - Click the green **"➕ Add New Connection"** button to show the connection form
   - Fill out the connection form:
     - **Connection Name**: A friendly name for your server
     - **Protocol**: SFTP (recommended), FTP, or secure FTPS
     - **Host**: Your server's IP address or domain name
     - **Port**: Usually 22 for SFTP, 21 for FTP, or 990 for implicit FTPS
     - **Username**: Your server username (optional for anonymous FTP)
     - **Authentication**: Choose Password or SSH Key (SFTP only - supports OpenSSH and PuTTY .ppk v2/v3 formats)
     - **Password**: Optional - enter to store securely, or leave empty to prompt during connection
     - **Anonymous FTP**: Check this box for anonymous FTP access (FTP only)
     - **FTPS Security**: For FTP connections, enable FTPS for encrypted TLS connections (Explicit/Implicit modes)
     - **Remote Path**: Starting directory (usually `/`)

3. **Save and Connect**
   - Click **"Add Connection"** to save (the form will automatically hide after saving)
   - Click the **"Connect"** button next to your new connection
   - If no password was stored, you'll be prompted to enter it
   - Choose **"Yes"** to save credentials securely for future connections

### Enhanced Connection Experience

#### Visual Connection Progress
When connecting to servers, you'll see clear visual feedback:

- **Status Bar Progress**: Detailed connection stages appear in the status bar:
  - "⟳ Establishing connection to [host]..."
  - "⟳ Authenticating to [host]..."
  - "⟳ Loading file structure from [host]..."
  - "✓ Connected to [host]" (briefly, then shows persistent connected state)

- **Welcome View Spinners**: Connection items show spinning indicators during connection attempts

- **Persistent Connected State**: Once connected, the status bar shows "⚡ [host] ✖" with:
  - Click anywhere to disconnect immediately
  - Tooltip: "Connected to [host] - Click to disconnect"
  - Remains visible until disconnected

#### Non-Intrusive Notifications
The extension uses smart notification management:

- **Status Bar Messages**: Success operations (file uploads, connections, etc.) appear briefly in the status bar instead of popup dialogs
- **Critical Alerts Only**: Error messages, confirmations, and safety warnings still use popups when user attention is required
- **Auto-Dismiss**: Status bar messages automatically disappear after 3-5 seconds
- **Examples of Status Bar Messages**:
  - "Password saved securely"
  - "filename.txt (45%)" (real-time upload progress)
  - "Uploaded filename.txt" (completion notification)
  - "Pushed filename.txt"
  - "Connection deleted"
  - "Cleaned up 5 temp files"
  - "Renamed to newname.txt"
  - "Moved to foldername"
  - "Copied to filename.txt"

#### Retry and Error Handling
- **Connection Retries**: Failed connections automatically retry with exponential backoff
- **Status Updates**: Retry attempts show "⟳ Retrying connection to [host] (2/3)..."
- **Smart Error Recovery**: Authentication failures offer retry options with new credentials

### Connection Management

#### Smart Connection State Management
The connection manager now provides intelligent connection handling:

- **Visual Connection State**: Currently connected servers are highlighted with a green border and "● Connected" indicator
- **Smart Connect/Disconnect Buttons**: 
  - When **not connected**: Shows "Connect" button
  - When **connected**: Shows red "Disconnect" button
- **Connection Switching**: When trying to connect to a different server while already connected:
  - Shows confirmation dialog: "Disconnect from [current] and connect to [new]?"
  - Automatically disconnects first, then connects to new server
  - Prevents accidental connection switching
- **Same Connection Protection**: Clicking "Connect" on the already-connected server shows "Already connected" message
- **Connection Manager Stays Open**: Window remains open after connecting for easy server switching

#### Cloning Connections
- Click **"Clone"** button next to any saved connection to duplicate it
- Cloned connections are automatically prefixed with "copy of " 
- Perfect for setting up similar server environments (dev, staging, production)
- Edit the cloned connection to customize host, port, or other settings

## Daily Usage

### Quick Connect
- Click the globe icon (🌐) to see your saved connections
- Expand **"Existing Connections"** to see all saved servers (sorted alphabetically)
- **Single-click** any connection name to connect instantly (double-clicking is not necessary)
- **Right-click options**:
  - **Manage Connections** item: Right-click to access **"Add New Connection"** option
  - **Individual connections**: Right-click for **"Edit Connection"**, **"Clone"**, and **"Delete Connection"** options

### Browsing Files
- Once connected, browse files in the **"Remote Files"** tree view
- Folders show first, then files (both alphabetically sorted)
- Double-click any file to open and edit it
- Use the **arrow-up button** (⬆️) in the toolbar to navigate to parent directories
- Select directories in the tree to use as upload destinations for local files

**💡 Tip: Better Tree Indentation**
If nested folders are hard to see, increase VSCode's tree indentation:
1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "tree indent"
3. Change **"Workbench › Tree: Indent"** from 8 to 16 or 20 pixels
4. This improves visibility for all tree views in VSCode!

**💡 Tip: Customizing File Opening Behavior**
Some users prefer different file opening behaviors. You can customize these in VSCode settings:
1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. **Disable Preview Tabs**: Search for "workbench.editor.enablePreview" and set it to `false`
   - This prevents files from opening in preview mode (italic tab names)
   - Every file click will open in a permanent tab instead
3. **Require Double-Click**: Search for "workbench.list.openMode" and change it to `"doubleClick"`
   - This requires double-clicking to open files instead of single-clicking
   - Applies to all tree views in VSCode, not just Remote File Browser
4. These settings affect all VSCode file operations, providing a consistent experience across the editor

### Editing Files
- Files open instantly in your editor
- Make changes and save normally (`Ctrl+S` / `Cmd+S`)
- Changes are automatically uploaded to the remote server with 4x faster speeds
- Real-time progress tracking: "filename.txt (45%)" during uploads  
- Status bar confirmation: "Uploaded filename.txt" upon completion
- Clean status transitions: No more stuck or duplicate status messages

### Uploading Local Files to Remote Server
- Open any local file in VSCode/Cursor
- **Right-click on the file tab** at the top of the editor
- Select **"Push to Remote"** from the context menu

#### Smart Upload Destinations
- **Regular local files**: Upload directly to currently selected directory in remote tree
- **Temporary files** (from `/tmp/`): Get choice between two destinations:
  - **"Original Location"**: Upload back to where the file was originally downloaded from
  - **"Current Location"**: Upload to currently selected directory in remote tree
- **Note**: For regular files, you must first select a directory in the remote file tree as the upload destination

### File Operations via Right-Click Context Menu

All file operations are available by **right-clicking** on files or directories in the remote file tree. The context menu provides:

- **"Open"** - Open the file in the editor (same as double-clicking)
- **"Rename"** - Rename the file or directory
- **"Move"** - Move the file or directory to a new path
- **"Copy"** - Copy the file or directory to a new location
- **"Delete"** - Delete the file or directory from the server

### Renaming and Deleting Remote Files
You can rename or delete files and directories directly on the remote server:

#### Renaming Files or Directories
1. **Right-click** on any file or directory in the remote file tree
2. Select **"Rename"** from the context menu
3. Enter the new name in the input box that appears
4. Press **Enter** to confirm or **Escape** to cancel
5. The file or directory will be renamed on the remote server

#### Deleting Files or Directories
1. **Right-click** on any file or directory in the remote file tree
2. Select **"Delete"** from the context menu
3. **Confirm the deletion** in the warning dialog that appears
4. For directories: You'll be warned that all contents will be deleted recursively
5. The file or directory will be permanently deleted from the remote server

**⚠️ Warning**: Deleted files and directories cannot be recovered. Use caution when deleting.

#### Moving Files and Directories
1. **Right-click** on any file or directory in the remote file tree
2. Select **"Move"** from the context menu
3. **Edit the path** in the input dialog (pre-populated with current path)
4. Press **Enter** to confirm the move operation
5. **Overwrite Protection**: If a file already exists at the target location, you'll be prompted to "Overwrite" or "Cancel"
6. The file or directory will be moved to the new location on the remote server
7. If the file is currently open in your editor, the tab will automatically update to reflect the new path

**📝 Move Features**: 
- **Pre-populated paths** save you from typing the full path again
- **Real-time validation** prevents invalid moves (empty paths, circular directory moves, etc.)
- **Overwrite protection** prevents accidental file replacement with confirmation dialog
- **Smart error handling** with helpful suggestions when moves fail
- **Editor tab updates** automatically when moving open files
- **Progress notifications** show move status and completion

**Common Move Examples**:
- Move `/var/www/app.php` to `/var/www/backup/app.php` (same filename, different directory)
- Move `/home/user/temp.txt` to `/home/user/documents/notes.txt` (rename and move)
- Move `/project/old-folder/` to `/project/archive/old-folder/` (move entire directory)

#### Copying Files and Directories
1. **Right-click** on any file or directory in the remote file tree
2. Select **"Copy"** from the context menu
3. **Edit the target path** in the input dialog (pre-populated with current path)
4. Press **Enter** to confirm the copy operation
5. **Overwrite Protection**: If a file already exists at the target location, you'll be prompted to "Overwrite" or "Cancel"
6. The file or directory will be copied to the new location on the remote server
7. **For files**: The copied file will automatically open in a new editor tab alongside the original

**📝 Copy Features**: 
- **Pre-populated paths** save you from typing the full path again
- **Real-time validation** prevents invalid copies (empty paths, circular directory copies, etc.)
- **Overwrite protection** prevents accidental file replacement with confirmation dialog
- **Smart error handling** with helpful suggestions when copies fail
- **New tab behavior** opens copied files in separate tabs from originals
- **Progress notifications** show copy status and completion
- **Recursive directory copying** handles entire folder structures with all contents

**Common Copy Examples**:
- Copy `/var/www/app.php` to `/var/www/backup/app.php` (backup existing file)
- Copy `/home/user/config.txt` to `/home/user/config-backup.txt` (create backup copy)
- Copy `/project/template/` to `/project/new-site/` (duplicate entire directory structure)

### Switching Servers
You can disconnect and switch servers in multiple ways:

- **Status Bar**: Click the persistent connection indicator "⚡ [host] ✖" in the status bar
- **Remote Files View**: Click the **X** (disconnect) button in the remote files toolbar  
- **Command Palette**: Use "Remote File Browser: Disconnect from Remote Server"
- **Welcome View**: Simply click a different connection to automatically disconnect and reconnect

**Disconnect Feedback**: When disconnecting, you'll see a brief "Disconnecting from [host]" status message before the status bar clears, providing clear confirmation that the disconnection was successful.

## Anonymous FTP Support

Remote File Browser fully supports anonymous FTP connections for public file servers.

### Setting Up Anonymous FTP
1. In the connection form, select **FTP** as the protocol
2. Check the **"Anonymous FTP Connection"** checkbox
3. **Username/Password**: Optional - you can:
   - Leave both fields empty (extension uses default anonymous credentials)
   - Enter custom username/password if the server requires specific anonymous credentials
4. **Host and Port**: Enter the FTP server details as normal
5. Save and connect

### Anonymous FTP Features
- **Flexible Authentication**: Works with servers that require empty credentials or specific anonymous usernames
- **No Credential Storage**: Anonymous connections don't prompt to save passwords
- **Standard Operations**: Full support for browsing, downloading, uploading, and file management
- **Auto-Detection**: Extension automatically handles common anonymous FTP patterns

### Authentication Error Recovery

If you encounter authentication failures, the extension provides smart recovery options:

#### For Password Authentication
- **Retry Prompt**: When authentication fails, you'll get an option to "Retry with different password"
- **Secure Storage**: Option to save the corrected password securely for future connections
- **Graceful Fallback**: If you cancel the retry, the original error is shown without losing context

#### For SSH Key Authentication  
- **Passphrase Recovery**: If key decryption fails, you'll be prompted for the correct passphrase
- **Secure Passphrase Storage**: Option to save passphrases securely in your OS keychain
- **PPK Support**: Full error handling for PuTTY PPK v2/v3 key format issues

## Connection Manager Features

### Adding SSH Key Authentication
1. In the connection form, select **"SSH Key"** for authentication
2. Click **"Browse..."** to select your private key file
3. Supports **OpenSSH** (`.key`, `.pem`) and **PuTTY PPK v2/v3** (`.ppk`) key formats
4. Usually located in `~/.ssh/id_rsa` or `C:\Users\Username\.ssh\`
5. Enter the key passphrase if your key is encrypted
6. Save the connection and connect

#### PPK Key Format Compatibility

**✅ Fully Supported**: Both PuTTY PPK version 2 and version 3 keys
- **PPK v2**: Generated by PuTTY 0.52-0.74
- **PPK v3**: Generated by PuTTY 0.75+

All PPK files are automatically converted to OpenSSH format in memory - no manual conversion required! Simply select your .ppk file and it will work regardless of version.

#### Enhanced SSH Compatibility

**Revolutionary RSA-SHA2 Support**: Powered by pure-js-sftp 5.0.0 with breakthrough compatibility fixes:
- ✅ **100% RSA Key Compatibility** with modern SSH servers (OpenSSH 8.2+)
- ✅ **Automatic Algorithm Upgrade** from legacy RSA-SHA1 to modern RSA-SHA2-256
- ✅ **Zero Configuration Required** - compatibility fixes applied automatically
- ✅ **Backward Compatible** with legacy SSH servers
- ✅ **Enhanced Security** using modern cryptographic signatures

### Managing Connections

#### Adding New Connections
- **From Connection Manager**: Click the green **"➕ Add New Connection"** button
- **From Welcome Screen**: Right-click **"Manage Connections"** → select **"Add New Connection"**
- Both methods open the connection manager with the form ready for input
- The form automatically hides after successfully saving a connection

#### Editing and Deleting Connections
- **Edit**: 
  - Click **"Edit"** next to any connection in the connection manager
  - Or right-click any connection in the welcome screen → **"Edit Connection"**
  - Both methods open the connection manager with the selected connection pre-loaded
- **Delete**: 
  - Click **"Delete"** next to any connection in the connection manager
  - Or right-click any connection in the welcome screen → **"Delete Connection"**
  - Both methods show a confirmation dialog before deletion
- **Connect**: Click **"Connect"** to establish connection immediately

#### Form Behavior
- **Hidden by Default**: The connection form is hidden when you first open the connection manager
- **Smart Visibility**: The form appears when adding or editing connections
- **Auto-Hide**: The form automatically hides after successful operations or when canceled
- **Button Management**: The "Add New Connection" button is hidden when the form is active to reduce clutter

### Temporary File Management
- **View Temp Files**: Click **"💻 View tmp files in shell"** to see downloaded files
- **Clean Up**: Click **"🗑️ Clean Up Temp Files"** to delete all temporary files

## Navigation and File Upload Features

### Parent Directory Navigation
- **Button Access**: Click the **arrow-up button** (⬆️) in the remote files toolbar to go up one directory level
- **Command Palette**: Use `Ctrl+Shift+P` / `Cmd+Shift+P` → "Remote File Browser: Go to Parent Directory"
- **Quick Navigation**: Navigate from `/var/www/html/` to `/var/www/` to `/var/` to `/` (root)
- **Context Aware**: Button only appears when navigation up is possible (not at root directory)

### Push Local Files to Remote Server
Follow these steps to upload local files to your remote server:

1. **Select Destination Directory**:
   - In the remote file tree, **click on a folder** to select it as your upload destination
   - The selected folder will be highlighted

2. **Upload a Local File**:
   - Open any local file in VSCode/Cursor 
   - **Right-click on the file tab** (the tab at the top showing the file name)
   - Select **"Push to Remote"** from the context menu
   - The file will be uploaded to your selected remote directory

3. **View Progress**:
   - Real-time progress with percentage: "filename.txt (67%)"
   - Enhanced transfer speeds up to 20+ MB/s for large files
   - Automatic server adaptation and intelligent reconnection for reliability
   - Status bar confirmation: "Pushed filename.txt" upon completion
   - Clean status transitions with proper connection timing
   - The remote file tree will refresh to show your uploaded file

**Requirements**:
- Must be connected to a remote server
- Must have a directory selected in the remote file tree
- Local file must exist and be readable

## Operation Protection Features

### Concurrent Operation Prevention
The extension includes advanced protection against duplicate and conflicting operations:

#### Connection Protection
- **Prevents multiple connection attempts**: If a connection is already in progress, additional attempts are silently ignored
- **Connection state management**: Proper handling of connection timing to prevent "SFTP connection is not ready" errors
- **SFTP connection timing**: Waits for `connectionReady` event before allowing file operations
- **Clean disconnection**: All operation locks are cleared when disconnecting

#### File Operation Protection  
- **Prevents concurrent file operations**: Each file operation (read, write, delete, rename) is protected by operation-specific locks
- **Operation types protected**:
  - `read:filename.txt` - Prevents multiple downloads of the same file
  - `write:filename.txt` - Prevents multiple uploads to the same file  
  - `delete:filename.txt` - Prevents multiple deletion attempts
  - `rename:oldname.txt` - Prevents multiple rename operations
- **Clear error messages**: "File operation already in progress" when attempting duplicate operations
- **Automatic cleanup**: Operation locks are automatically released when operations complete or fail

#### VSCode Preview Mode Compatibility
- **Handles rapid clicks**: Protects against VSCode's `workbench.editor.enablePreview` causing multiple file operations
- **Single-click protection**: Prevents issues when single-clicking files rapidly in preview mode
- **Double-click protection**: Guards against accidental double-clicking triggering duplicate operations

#### Benefits
- **No duplicate status messages**: Eliminates "downloading, downloaded, downloading..." cycles
- **Prevents data corruption**: Stops multiple writes to the same file from conflicting
- **Improves reliability**: Reduces connection errors and timing issues
- **Better user experience**: Clean, predictable operation behavior

**💡 Tip**: If you encounter "File operation already in progress" errors, simply wait a moment for the current operation to complete before trying again.

## Advanced Features

### Command Palette Commands
Access these via `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

- **Remote File Browser: Connect to Remote Server** - Manual connection setup
- **Remote File Browser: Connect from Saved Configuration** - Quick picker for all connections
- **Remote File Browser: Manage Connections** - Open connection manager
- **Remote File Browser: Clean Up Connection Temp Files** - Delete temp files for current connection only
- **Remote File Browser: Clean Up All Temp Files** - Delete temp files for all connections
- **Remote File Browser: Disconnect from Remote Server** - Close current connection
- **Remote File Browser: Refresh** - Reload remote file tree
- **Remote File Browser: Push to Remote** - Upload current local file to selected remote directory
- **Remote File Browser: Go to Parent Directory** - Navigate up one directory level
- **Remote File Browser: Rename File** - Rename selected file or directory on remote server
- **Remote File Browser: Move File** - Move selected file or directory to a new path on remote server
- **Remote File Browser: Copy File** - Copy selected file or directory to a new path on remote server
- **Remote File Browser: Download File** - Download and open selected remote file in editor (same as double-clicking)
- **Remote File Browser: Delete File** - Delete selected file or directory from remote server

### Settings Configuration
Advanced users can directly edit settings in VSCode/Cursor settings:

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "Remote File Browser"
3. Edit the `remoteFileBrowser.connections` array directly

Example configuration:
```json
{
  "remoteFileBrowser.connections": [
    {
      "name": "Production Server",
      "protocol": "sftp",
      "host": "prod.example.com",
      "port": 22,
      "username": "deploy",
      "remotePath": "/var/www",
      "authType": "key",
      "keyPath": "/home/user/.ssh/id_rsa",
      "connectionTimeout": 20000,
      "operationTimeout": 90000
    }
  ]
}
```

**Note**: Timeout parameters are optional. If not specified, sensible defaults are used:
- Connection timeouts: 20s (SFTP), 30s (FTP)
- Operation timeout: 60s
- Retry logic and keep-alive are handled automatically by the underlying connection libraries

## How Temporary Files Work

### File Storage Structure
When you open remote files, they're downloaded to your local system in an organized structure:

```
/tmp/remote-file-browser/
├── user-at-server1-22/
│   ├── home/user/config.txt
│   ├── etc/nginx/nginx.conf
│   └── var/log/app.log
└── admin-at-server2-21/
    └── web/index.html
```

### Connection-Specific Directories
- Each connection gets its own folder named `username-at-hostname-port`
- The remote directory structure is preserved locally
- This prevents filename conflicts between different servers

### File Caching Behavior
- **First Open**: File is downloaded from the remote server
- **Subsequent Opens**: You're asked to choose:
  - **"Override with fresh copy from server"** - Downloads latest version
  - **"Open existing local copy"** - Uses cached version
  - **"Cancel"** - Closes the dialog

### Auto-Sync on Save
- When you save a file (`Ctrl+S` / `Cmd+S`), changes are automatically uploaded
- You'll see a status bar confirmation: "Uploaded filename.txt"
- If upload fails, you'll see an error popup with details

## Managing Temporary Files

### Viewing Temp Files
1. Open the connection manager (click globe icon → "Manage Connections")
2. Click **"💻 View tmp files in shell"**
3. A terminal opens in the temp directory showing all downloaded files
4. Use standard shell commands to explore: `ls -la`, `cd`, `cat`, etc.

### Cleaning Up Temp Files

#### Clean Up Current Connection Files
**Warning**: This will delete temporary files for the current connection and break sync for any open files from this server.

1. **Via Navigation Bar** (when connected):
   - Click the trash icon (🗑️) next to refresh and disconnect
   - This runs "Clean Up Connection Temp Files"

2. **Via Command Palette**:
   - Press `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Clean Up Connection Temp Files" and select it

#### Clean Up All Connection Files
**Warning**: This will delete ALL temporary files from ALL connections and break sync for any open files.

1. **Via Connection Manager**:
   - Click **"🗑️ Clean Up Temp Files"** in the connection manager
   - This runs "Clean Up All Temp Files"

2. **Via Command Palette**:
   - Press `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Clean Up All Temp Files" and select it

### What Cleanup Does
- Deletes the entire `/tmp/remote-file-browser/` directory
- Removes all downloaded files from all connections
- Clears file watchers to prevent memory leaks
- Shows status bar message with count of deleted files

### After Cleanup
- Any files you have open will no longer sync when saved
- Next time you open a remote file, it will be downloaded fresh
- Your saved connections and credentials remain intact

## Troubleshooting

### Connection Issues
- **"All configured authentication methods failed"**: Check username/password or SSH key path
- **"Connection refused"**: Verify host, port, and that SSH/FTP service is running
- **"Host key verification failed"**: Accept the host key when prompted
- **"Failed to convert PPK file"**: Check that your PPK file is valid and enter the correct passphrase if the key is encrypted

### Keyring Issues (Linux)
If you see "keyring couldn't be identified":
- Install a keyring manager: `sudo apt install gnome-keyring` (Ubuntu) or similar
- Or choose "Continue Without Saving" to skip credential storage

### Temp File Access Issues
- **Crostini/ChromeOS**: Temp files are in the Linux container, use the shell interface
- **File not syncing**: Check if you cleaned up temp files, re-open the file to re-establish sync
- **Permission errors**: Ensure you have write access to the remote directory

## Security Notes

- **Credentials**: Stored securely in your OS keychain (not in settings files)
- **SSH Keys**: Read from disk only during connection, not cached in memory
- **PPK Files**: PuTTY .ppk files (v2 and v3) are converted to OpenSSH format in memory for security
- **Temp Files**: Use sanitized names to prevent path traversal attacks
- **Network**: All connections use standard SFTP/FTP protocols with your authentication

## ⚠️ Multi-Window Limitations

**Important**: Be careful when using multiple VSCode/Cursor windows with this extension to avoid data loss.

### Known Issues
- **Same Server Conflicts**: Multiple windows connecting to the same server share temp file storage, which can cause file conflicts
- **Data Loss Risk**: If two windows edit the same remote file, whichever saves last will overwrite the other's changes
- **Sync Disruption**: Running "Clean Up All Temp Files" in one window stops file synchronization in ALL windows; "Clean Up Connection Temp Files" only affects the current connection

### How to Avoid Problems
✅ **Safe Usage Patterns**:
- Use only **one window per remote server**
- Connect different windows to **different servers**
- Use **different user accounts** on the same server from different windows

❌ **Avoid These Scenarios**:
- Two windows connected to `user@production-server.com`
- Opening the same file (`/app/config.php`) from multiple windows
- Running temp file cleanup while other windows have active connections

### If You Must Use Multiple Windows
1. **Coordinate file access** - Don't edit the same files simultaneously
2. **Avoid cleanup operations** - Don't run "Clean Up All Temp Files" while other windows are active
3. **Save frequently** - Minimize time between edits to reduce conflict windows
4. **Check for conflicts** - If sync stops working, disconnect and reconnect

Future versions will include better multi-window isolation to prevent these issues.


## Installation

### Manual Installation (Cursor Users)

**For Cursor users**, you can install this extension manually using the pre-built VSIX package:

1. **Download the VSIX package**:
   - Download `remote-file-browser-latest.vsix` from the [GitHub repository](https://github.com/cartpauj/remote-file-browser)

2. **Install in Cursor**:
   - Open Cursor
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "install from vsix" and select "Extensions: Install from VSIX..."
   - Browse to the downloaded `remote-file-browser-latest.vsix` file
   - Select the file to install

3. **Restart Cursor** to activate the extension

**For VSCode users**, this extension is available in the marketplace, so you don't need manual installation unless you specifically want the latest development version.

### Building and Installation

#### Installing from Source

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cartpauj/remote-file-browser.git
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

4. **Install the extension**:
   
   **Option A: Copy to Extensions Directory**
   - Copy the entire project folder to your extensions directory:
     - **Windows**: `%USERPROFILE%\.vscode\extensions\` or `%USERPROFILE%\.cursor\extensions\`
     - **macOS**: `~/.vscode/extensions/` or `~/.cursor/extensions/`
     - **Linux**: `~/.vscode/extensions/` or `~/.cursor/extensions/`
   - Restart VSCode/Cursor
   
   **Option B: Package and Install**
   - Install the packaging tool: `npm install -g vsce`
   - Package the extension: `vsce package`
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "install from vsix"
   - Select "Extensions: Install from VSIX..."
   - Browse to your `.vsix` file

### Development Workflow

1. **Watch for changes** (auto-compile with webpack):
   ```bash
   npm run watch
   ```

2. **Test in Extension Development Host**:
   - Press `F5` in VSCode/Cursor
   - Or use "Run Extension" in the Run and Debug panel

3. **Manual builds**:
   ```bash
   # Development build
   npm run compile
   
   # Production build (minified)
   npm run package
   ```

4. **After making changes**:
   - Use "Developer: Reload Window" to reload the extension
   - Or restart VSCode/Cursor completely

---

*For technical details and development information, see PROJECT-SCOPE.md*
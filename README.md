# Remote File Browser Extension

A VSCode/Cursor extension that lets you browse and edit remote files via SFTP/FTP without downloading entire directory structures. Files are accessed on-demand and automatically synced back when saved.

## Getting Started

### Initial Setup

1. **Open the Remote File Browser**
   - Click the globe icon (🌐) in the activity bar on the left side of your editor

2. **Add Your First Connection**
   - Click **"Manage Connections"** in the welcome screen
   - Fill out the connection form:
     - **Connection Name**: A friendly name for your server
     - **Protocol**: SFTP (recommended) or FTP
     - **Host**: Your server's IP address or domain name
     - **Port**: Usually 22 for SFTP, 21 for FTP
     - **Username**: Your server username
     - **Authentication**: Choose Password or SSH Key (supports OpenSSH and PuTTY .ppk formats)
     - **Remote Path**: Starting directory (usually `/`)

3. **Save and Connect**
   - Click **"Add Connection"** to save
   - Click the **"Connect"** button next to your new connection
   - Enter your password or SSH key passphrase when prompted
   - Choose **"Yes"** to save credentials securely (optional)

## Daily Usage

### Quick Connect
- Click the globe icon (🌐) to see your recent connections
- Expand **"Recent Connections"** to see up to 10 saved servers
- Click any connection name to connect instantly

### Browsing Files
- Once connected, browse files in the **"Remote Files"** tree view
- Folders show first, then files (both alphabetically sorted)
- Double-click any file to open and edit it
- Use the **arrow-up button** (⬆️) in the toolbar to navigate to parent directories
- Select directories in the tree to use as upload destinations for local files

### Editing Files
- Files open instantly in your editor
- Make changes and save normally (`Ctrl+S` / `Cmd+S`)
- Changes are automatically uploaded to the remote server
- You'll see a confirmation message when upload completes

### Uploading Local Files to Remote Server
- Open any local file in VSCode/Cursor
- **Right-click on the file tab** at the top of the editor
- Select **"Push to Remote"** from the context menu
- The file will be uploaded to the currently selected directory in the remote tree
- **Note**: You must first select a directory in the remote file tree as the upload destination

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

### Switching Servers
- Click the **X** (disconnect) button in the remote files view
- Select a different connection from the recent connections list

## Connection Manager Features

### Adding SSH Key Authentication
1. In the connection form, select **"SSH Key"** for authentication
2. Click **"Browse..."** to select your private key file
3. Supports both **OpenSSH** (`.key`, `.pem`) and **PuTTY** (`.ppk`) key formats
4. Usually located in `~/.ssh/id_rsa` or `C:\Users\Username\.ssh\`
5. Enter the key passphrase if your key is encrypted
6. Save the connection and connect

**Note**: PuTTY `.ppk` files are automatically converted to OpenSSH format during connection - no manual conversion needed!

### Managing Connections
- **Edit**: Click "Edit" next to any connection to modify settings
- **Delete**: Click "Delete" to remove a connection permanently
- **Connect**: Click "Connect" to establish connection immediately

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
   - You'll see a progress indicator during upload
   - Success message: "Successfully pushed filename.txt to /remote/path/"
   - The remote file tree will refresh to show your uploaded file

**Requirements**:
- Must be connected to a remote server
- Must have a directory selected in the remote file tree
- Local file must exist and be readable

## Advanced Features

### Command Palette Commands
Access these via `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

- **Remote File Browser: Connect to Remote Server** - Manual connection setup
- **Remote File Browser: Connect from Saved Configuration** - Quick picker for all connections
- **Remote File Browser: Manage Connections** - Open connection manager
- **Remote File Browser: Clean Up Temporary Files** - Delete temp files
- **Remote File Browser: Disconnect from Remote Server** - Close current connection
- **Remote File Browser: Refresh** - Reload remote file tree
- **Remote File Browser: Push to Remote** - Upload current local file to selected remote directory
- **Remote File Browser: Go to Parent Directory** - Navigate up one directory level
- **Remote File Browser: Rename File** - Rename selected file or directory on remote server
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
      "connectionTimeout": 25000,
      "operationTimeout": 90000,
      "maxRetries": 5,
      "enableKeepAlive": true
    }
  ]
}
```

**Note**: All advanced timeout and retry parameters are optional. If not specified, sensible defaults are used:
- Connection timeouts: 20s (SFTP) / 30s (FTP)
- Operation timeout: 60s
- Max retries: 3 attempts with exponential backoff
- Keep-alive: Enabled with 30s intervals

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
- You'll see a confirmation message: "Uploaded filename.txt to remote server"
- If upload fails, you'll see an error message with details

## Managing Temporary Files

### Viewing Temp Files
1. Open the connection manager (click globe icon → "Manage Connections")
2. Click **"💻 View tmp files in shell"**
3. A terminal opens in the temp directory showing all downloaded files
4. Use standard shell commands to explore: `ls -la`, `cd`, `cat`, etc.

### Cleaning Up Temp Files
**Warning**: This will delete all temporary files and break sync for any open files.

1. **Via Connection Manager**:
   - Click **"🗑️ Clean Up Temp Files"** in the connection manager

2. **Via Command Palette**:
   - Press `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Clean Up Temporary Files" and select it

3. **Via Navigation Bar** (when connected):
   - Click the trash icon (🗑️) next to refresh and disconnect

### What Cleanup Does
- Deletes the entire `/tmp/remote-file-browser/` directory
- Removes all downloaded files from all connections
- Clears file watchers to prevent memory leaks
- Shows count of deleted files when complete

### After Cleanup
- Any files you have open will no longer sync when saved
- Next time you open a remote file, it will be downloaded fresh
- Your saved connections and credentials remain intact

## Troubleshooting

### Connection Issues
- **"All configured authentication methods failed"**: Check username/password or SSH key path
- **"Connection refused"**: Verify host, port, and that SSH/FTP service is running
- **"Host key verification failed"**: Accept the host key when prompted

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
- **SSH Keys**: Read from disk only during connection, not cached in memory (PuTTY .ppk files converted in memory)
- **Temp Files**: Use sanitized names to prevent path traversal attacks
- **Network**: All connections use standard SFTP/FTP protocols with your authentication

## ⚠️ Multi-Window Limitations

**Important**: Be careful when using multiple VSCode/Cursor windows with this extension to avoid data loss.

### Known Issues
- **Same Server Conflicts**: Multiple windows connecting to the same server share temp file storage, which can cause file conflicts
- **Data Loss Risk**: If two windows edit the same remote file, whichever saves last will overwrite the other's changes
- **Sync Disruption**: Running "Clean Up Temp Files" in one window stops file synchronization in ALL windows

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
2. **Avoid cleanup operations** - Don't run "Clean Up Temp Files" while other windows are active
3. **Save frequently** - Minimize time between edits to reduce conflict windows
4. **Check for conflicts** - If sync stops working, disconnect and reconnect

Future versions will include better multi-window isolation to prevent these issues.


## Building and Installation

### Installing from Source

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
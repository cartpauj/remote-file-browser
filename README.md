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
     - **Authentication**: Choose Password or SSH Key
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

### Editing Files
- Files open instantly in your editor
- Make changes and save normally (`Ctrl+S` / `Cmd+S`)
- Changes are automatically uploaded to the remote server
- You'll see a confirmation message when upload completes

### Switching Servers
- Click the **X** (disconnect) button in the remote files view
- Select a different connection from the recent connections list

## Connection Manager Features

### Adding SSH Key Authentication
1. In the connection form, select **"SSH Key"** for authentication
2. Click **"Browse..."** to select your private key file
3. Usually located in `~/.ssh/id_rsa` or similar
4. Enter the key passphrase if your key is encrypted
5. Save the connection and connect

### Managing Connections
- **Edit**: Click "Edit" next to any connection to modify settings
- **Delete**: Click "Delete" to remove a connection permanently
- **Connect**: Click "Connect" to establish connection immediately

### Temporary File Management
- **View Temp Files**: Click **"💻 View tmp files in shell"** to see downloaded files
- **Clean Up**: Click **"🗑️ Clean Up Temp Files"** to delete all temporary files

## Advanced Features

### Command Palette Commands
Access these via `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

- **Remote File Browser: Connect to Remote Server** - Manual connection setup
- **Remote File Browser: Connect from Saved Configuration** - Quick picker for all connections
- **Remote File Browser: Manage Connections** - Open connection manager
- **Remote File Browser: Clean Up Temporary Files** - Delete temp files
- **Remote File Browser: Disconnect from Remote Server** - Close current connection
- **Remote File Browser: Refresh** - Reload remote file tree

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
      "keyPath": "/home/user/.ssh/id_rsa"
    }
  ]
}
```

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
- **SSH Keys**: Read from disk only during connection, not cached in memory
- **Temp Files**: Use sanitized names to prevent path traversal attacks
- **Network**: All connections use standard SFTP/FTP protocols with your authentication

## Platform Support

- **Windows**: Full support with Windows file managers
- **macOS**: Full support with Finder integration
- **Linux Desktop**: Full support with common file managers (Nautilus, Dolphin, etc.)
- **ChromeOS/Crostini**: Supported via terminal interface for temp file access

---

*For technical details and development information, see [PROJECT-SCOPE.md](PROJECT-SCOPE.md)*
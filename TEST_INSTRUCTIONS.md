# VSCode Extension Testing Instructions

## Current Debug Setup

The extension now has **comprehensive debugging** added to help identify any credential mismatches or issues. When you test the connection in VSCode, you'll see detailed logs in the Developer Console.

## Testing Steps

### 1. Open VSCode Developer Console
- Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open Developer Tools
- Go to the **Console** tab
- Clear any existing logs

### 2. Install/Reload Extension
If you haven't installed the extension yet:
```bash
# In the extension directory
code --install-extension .
```

Or if already installed, reload VSCode:
- Press `Ctrl+Shift+P` and run "Developer: Reload Window"

### 3. Trigger Connection
- Open the Remote File Browser panel (sidebar)
- Click on the saved connection "DOS" 
- Watch the console for detailed debug output

## What the Debug Output Shows

### 🚀 Extension Level Debugging
- **Raw VSCode settings** - Shows exactly what's being read from settings.json
- **Connection comparison** - Compares your settings with known working credentials
- **Final config** - Shows the exact parameters being sent to ConnectionManager

### 🔍 ConnectionManager Debugging  
- **Credential validation** - Validates all required fields
- **Key file analysis** - Checks if key file exists, is readable, format detection
- **Environment info** - Node version, platform, VSCode/webpack detection
- **Known working comparison** - Compares with test credentials that work

### 🔐 Crypto Fix Debugging
- **ssh2-streams patching** - Shows if crypto fix is applied
- **Key parsing** - Shows key parsing success/failure  
- **Signing attempts** - Shows if signing uses original crypto or jsrsasign fallback

## Expected Output

If credentials match the working test setup, you should see:
```
✅ ALL CREDENTIALS MATCH WORKING TEST - Connection should succeed!
```

If there are differences, you'll see:
```
⚠️ CREDENTIAL DIFFERENCES DETECTED:
  1. Host: got "some-host", expected "142.93.27.188"
  2. Port: got 22, expected 2390
  etc...
```

## Current Working Credentials

The extension compares against these known working credentials:
- **Host**: `142.93.27.188`  
- **Port**: `2390`
- **Username**: `cartpauj`
- **Key Path**: `/home/cartpauj/cartpauj-github/remote-file-browser/test-credentials.pem`
- **Passphrase**: `Head7Tail7Butt0`

## Troubleshooting

### If Connection Fails
1. **Check the console output** - Look for validation errors or credential mismatches
2. **Verify settings.json** - Make sure VSCode settings match working credentials
3. **Test standalone** - Run `node test-crypto-fix-minimal.js` to verify crypto fix works
4. **Key file access** - Ensure the key file path is correct and readable

### Common Issues
- **Wrong port**: VSCode settings might have port 22 instead of 2390
- **Wrong host**: Make sure host matches exactly (no IP vs hostname mismatch)  
- **Key path**: Ensure path points to the correct test-credentials.pem file
- **Passphrase**: Must be exactly "Head7Tail7Butt0"

## Next Steps

After testing:
1. **Copy the full console output** and share it
2. **Note any specific error messages** that appear
3. **Confirm which credentials are being used** (from the debug output)

The debug output will show exactly what's happening and where any mismatches occur!
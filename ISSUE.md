# VSCode Extension Host Crash Issue - ONGOING

## Problem
The Remote File Browser extension was causing VSCode's extension host to crash immediately after activation, resulting in the error "There is no data provider registered that can provide view data". **UPDATE**: Extension now loads but can't connect to SFTP.

## Root Cause Analysis
The issue was **NOT** with the tree data provider logic or view registration as initially suspected. The real problem is **native Node.js modules (.node files) causing segmentation faults (code 139) in VSCode's extension host**.

## Investigation Process
1. **Initial Theory**: Tree data provider registration issues or view ID mismatches
2. **Failed Attempts**: 
   - Tried unified providers
   - Attempted lazy loading of dependencies
   - Modified activation events
   - Created minimal test extensions
   - Externalization approach (worked in theory but broke actual connections)
3. **Key Discovery**: Native .node files (ssh2 crypto modules) crash VSCode extension host with SIGSEGV
4. **Critical Finding**: Natizyskunk SFTP extension works because their .node files are Windows PE32+ format, not Linux ELF, so they fall back to JavaScript implementations

## Current Status: PARTIAL SUCCESS
- ✅ Extension loads without crashing (using dynamic imports)
- ✅ UI appears correctly
- ❌ Cannot connect to SFTP (times out during handshake or just reloads view)
- ❌ Native crypto modules still cause issues when actually invoked

## Attempted Solutions

### 1. Externalization (FAILED)
```javascript
externals: {
  'ssh2-sftp-client': 'commonjs ssh2-sftp-client',
  'ppk-to-openssh': 'commonjs ppk-to-openssh'
}
```
**Result**: Extension loads but cannot connect - missing dependencies

### 2. Force JavaScript Fallbacks (PARTIAL)
```bash
FORCE_JS_BUILD=1 npm install --no-optional
```
**Result**: No .node files, extension loads, but SSH handshake fails

### 3. Dynamic Imports (CURRENT)
```typescript
// Dynamically import to delay native module loading
if (!SftpClient) {
    SftpClient = await import('ssh2-sftp-client');
}
```
**Result**: Extension loads, but connection attempts either timeout or cause view reload

## Root Problem
**SSH/SFTP requires native crypto modules for secure connections**. Pure JavaScript implementations exist but lack the cryptographic strength needed for real SSH handshakes. The fundamental conflict:
- VSCode extension host crashes when loading native crypto modules
- SSH2/SFTP connections require those same native crypto modules to function

## Platform Differences Discovered
- **Natizyskunk SFTP**: Ships with Windows .node files that don't load on Linux, forcing JS fallbacks
- **Our Extension**: Ships with Linux .node files that crash the extension host when loaded
- **Cursor**: Handles native modules differently, allowing them to load successfully

## Critical Discovery: Pure JS Limitations
**IMPORTANT UPDATE**: The fallback to pure JavaScript approach is fundamentally incomplete. Recent testing revealed:

- **ssh2 and ssh2-sftp-client**: NOT fully pure JS capable - SFTP connections fail even when .node files are excluded
- **ppk-to-openssh**: Appears to be fully pure JS capable
- **simple-ftp**: Fully pure JS capable for basic FTP (but not SFTP)

This means our current approach of forcing JS fallbacks will never work for SFTP connections because the underlying ssh2 library requires native crypto implementations for the SSH protocol itself.

## Next Steps to Explore
1. **Bundle Platform-Specific Builds**: Ship Windows .node files even on Linux to force fallbacks (UNLIKELY TO WORK - see above)
2. **External Process Approach**: Use child_process to run SSH operations outside extension host
3. **WebSocket Proxy**: Create a bridge service that handles SFTP outside VSCode
4. **Pure JS SSH Implementation**: Find/create a truly pure JavaScript SSH implementation (DIFFICULT - limited options exist)
5. **VSCode Settings**: Investigate if there are VSCode settings to allow native modules
6. **Alternative Protocols**: Consider FTP with simple-ftp or other pure JS file transfer protocols

## Key Technical Details
- **Crash Code**: 139 (SIGSEGV - Segmentation Fault)  
- **Failing Modules**: `sshcrypto.node`, `cpufeatures.node`
- **Error Pattern**: "getConnection: Timed out while waiting for handshake"
- **Working in**: Cursor IDE
- **Failing in**: VSCode

## References
- Natizyskunk SFTP: Uses Windows .node files universally
- ssh2 module: Requires native crypto for key exchange
- VSCode Extension Host: Sandboxed environment with native module restrictions
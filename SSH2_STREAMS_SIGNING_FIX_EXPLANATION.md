# SSH2-Streams Signing Fix for VSCode Extensions - Technical Deep Dive

## The Fundamental Problem

### VSCode's Broken Crypto Environment
VSCode extensions run in an Electron environment with **fundamentally broken OpenSSL crypto functionality**:

- **OpenSSL Version**: VSCode reports version "0.0.0" instead of a real version
- **crypto.sign() Failures**: Node.js `crypto.sign()` fails with OpenSSH format keys
- **Key Parsing Issues**: Even traditional PEM keys sometimes fail to parse correctly
- **Bundling Issues**: Webpack bundling in VSCode extensions compounds crypto problems

### The SSH Key Authentication Chain
```
User Key File → ssh2-streams.parseKey() → pure-js-sftp → SSH Authentication
```

**Where it breaks in VSCode:**
1. `ssh2-streams.parseKey()` can parse keys but signing fails
2. `crypto.sign()` in VSCode returns errors instead of signatures
3. SSH authentication fails because signatures are invalid

## Technical Investigation Process

### Initial Error Patterns
```javascript
// Common VSCode crypto errors:
ERR_OSSL_EVP_DECODE_ERROR
ERR_OSSL_PEM_NO_START_LINE
Buffer.allocUnsafe(NaN) errors
"Invalid signature type" errors
```

### Key Discovery: ssh2-streams Internal Conversion
**Breakthrough finding**: ssh2-streams internally converts OpenSSH keys to traditional PEM format and stores the converted data in **Symbol properties**:

```javascript
// ssh2-streams stores converted keys here:
const privateKeyPemSymbol = Object.getOwnPropertySymbols(keyObject).find(s => 
    s.toString().includes('Private key PEM')
);

// Access converted traditional PEM:
const traditionalKeyPem = keyObject[privateKeyPemSymbol];
```

### The Working Solution Architecture

#### 1. **parseKey Interception**
Patch `ssh2Streams.utils.parseKey` to intercept key processing and inject custom signing logic.

#### 2. **Symbol Property Extraction**
Use ssh2-streams' own converted traditional PEM keys from Symbol properties instead of trying to convert keys ourselves.

#### 3. **System Crypto Workaround**
Use external Node.js process via `execSync` to perform signing operations outside VSCode's broken crypto environment:

```javascript
const result = execSync('node', {
    input: `crypto signing script`,
    encoding: 'utf8',
    stdio: 'pipe'
});
```

#### 4. **SHA-1 Algorithm Compatibility**
ssh2-streams expects SHA-1 signatures for RSA keys (legacy but required):

```javascript
const hashAlgo = keyType === 'ed25519' ? null : 'sha1';
```

#### 5. **Array Format Compatibility**
pure-js-sftp expects `parseKey` to return arrays, while ssh2-streams returns single objects:

```javascript
return Array.isArray(originalResult) ? processedKeys : processedKeys[0];
```

## Critical Implementation Details

### Object Assignment Pattern
**Working approach**: Use `Object.assign({}, key, { sign: customSignFunction })`
**Broken approach**: Complex `Object.create()` with property copying

### Error Handling Strategy
**Working approach**: Simple fallback to original signing function
**Broken approach**: Complex try-catch with error re-throwing

### Conditional Application
Only apply fixes during SSH key authentication, not password authentication:

```javascript
let shouldApplyFixes = false;
export function enableSigningFix() { shouldApplyFixes = true; }
export function disableSigningFix() { shouldApplyFixes = false; }
```

## Integration Points

### ConnectionManager Integration
```javascript
if (this.config.authType?.toLowerCase() === 'key' && this.config.keyPath) {
    const { enableSigningFix } = require('./ssh2StreamsSigningFix');
    enableSigningFix();
} else {
    const { disableSigningFix } = require('./ssh2StreamsSigningFix');
    disableSigningFix();
}
```

### Key Reading
Ensure raw key content is passed, not file paths:
```javascript
const privateKeyContent = fs.readFileSync(this.config.keyPath, 'utf8');
```

## Known Working Patterns

### Successful Implementation Structure
```javascript
ssh2Streams.utils.parseKey = function(keyData, passphrase) {
    if (!shouldApplyFixes || !keyData) {
        return originalParseKey.call(this, keyData, passphrase);
    }
    
    const originalResult = originalParseKey.call(this, keyData, passphrase);
    if (!originalResult) return originalResult;
    
    const processedKeys = keysToProcess.map(key => {
        return Object.assign({}, key, {
            sign: function(data) {
                try {
                    return originalSign.call(key, data);
                } catch (error) {
                    // Use Symbol properties + system crypto
                    const traditionalPem = key[privateKeyPemSymbol];
                    return signWithSystemCryptoSync(traditionalPem, passphrase, data);
                }
            }
        });
    });
    
    return Array.isArray(originalResult) ? processedKeys : processedKeys[0];
};
```

## Debugging Requirements

When the fix doesn't work, debugging must be added directly to:

1. **ssh2-streams library** - to see what parseKey actually returns
2. **pure-js-sftp library** - to see how it calls parseKey and uses results
3. **Extension signing fix** - to see what objects are being processed

### Common Debugging Points
- What does `ssh2Streams.utils.parseKey` actually return?
- Does the returned object have `sign` and `getPublicSSH` methods?
- Are Symbol properties present on key objects?
- Is the system crypto subprocess working correctly?
- Is the signing fix being enabled at the right time?

## Environment Considerations

### Cross-Platform Compatibility
- **Linux/macOS**: Usually works with system Node.js via execSync
- **Windows**: May need `node.exe` instead of `node` command
- **Path Issues**: Ensure Node.js is in PATH for execSync

### Version Dependencies
- **ssh2-streams**: 0.4.10 (as used by pure-js-sftp)
- **pure-js-sftp**: 2.1.3+ (for password auth support)
- **Node.js**: External system Node.js for crypto operations

## Failure Modes

### Common Failure Patterns
1. **parseKey returns Error objects** instead of key objects
2. **Missing getPublicSSH method** on returned keys
3. **Array vs single object mismatch** between ssh2-streams and pure-js-sftp
4. **Passphrase not passed correctly** to ssh2-streams
5. **Symbol properties missing** from key objects
6. **System crypto subprocess fails** due to path or permission issues

### Diagnostic Indicators
- "Cannot read properties of undefined (reading 'getPublicSSH')"
- "parsedKey.getPublicSSH is not a function"  
- "Encrypted private OpenSSH key detected, but no passphrase given"
- "ERR_OSSL_EVP_DECODE_ERROR" in signing operations

## Success Criteria

The fix is working when:
1. PEM/OpenSSH keys authenticate successfully in VSCode
2. Password authentication still works without the signing fix
3. No crypto-related errors in the console
4. Both VSCode and Cursor (or other Electron-based editors) work
5. Cross-platform compatibility maintained

## Future Development Notes

- This fix is a **workaround** for VSCode's broken crypto, not a permanent solution
- If VSCode fixes their OpenSSL integration, this fix might become unnecessary
- Any changes to ssh2-streams or pure-js-sftp APIs may require updates
- The Symbol property approach depends on ssh2-streams internal implementation
- External Node.js dependency means fix won't work if Node.js not available

## Recovery Strategy

If the fix breaks:
1. Start with minimal implementation
2. Add debugging directly to ssh2-streams and pure-js-sftp libraries
3. Verify what parseKey actually returns in VSCode environment
4. Ensure proper object structure with getPublicSSH and sign methods
5. Test Symbol property extraction and system crypto separately
6. Build up complexity gradually until working solution is found

## Debugging Session Results - December 2024

### Investigation Process That Led to Success

#### Phase 1: Added Comprehensive Debugging
Added extensive debugging to both ssh2-streams and pure-js-sftp libraries:

**ssh2-streams debugging locations:**
- `parseKey()` function in `/node_modules/ssh2-streams/lib/keyParser.js` line 1421
- `OpenSSH_Private.parse()` function line 509

**pure-js-sftp debugging locations:**
- SSH key authentication in `/node_modules/pure-js-sftp/dist/ssh/ssh2-streams-transport.js` line 167

#### Phase 2: Root Cause Discovery
Debug output revealed the actual problem:

**Initial Error Symptoms:**
```
console.ts:137 [Extension Host] Key is unencrypted, not using passphrase
console.ts:137 [Extension Host] [SSH2-STREAMS-DEBUG] OpenSSH_Private.parse: CRITICAL - encrypted key but no passphrase provided!
console.ts:137 [Extension Host] [PURE-JS-SFTP-DEBUG] parseKey returned Error: Encrypted private OpenSSH key detected, but no passphrase given
```

**Root Cause Identified:**
1. SSH key was encrypted with `aes256-ctr` cipher + `bcrypt` KDF
2. connectionManager.ts had **wrong encryption detection logic**
3. Was only checking for `'ENCRYPTED'` or `'Proc-Type: 4,ENCRYPTED'` strings
4. Modern OpenSSH encrypted keys don't have these obvious markers
5. No passphrase was being passed to ssh2-streams

#### Phase 3: Fix Implementation
**Fixed connectionManager.ts logic:**
```javascript
// OLD (BROKEN) - tried to detect encryption
const keyIsEncrypted = privateKeyContent.includes('ENCRYPTED') || privateKeyContent.includes('Proc-Type: 4,ENCRYPTED');

// NEW (WORKING) - always pass passphrase if provided
if (this.config.passphrase) {
    console.log('Passphrase provided, passing to ssh2-streams for key parsing');
    connectOptions.passphrase = this.config.passphrase;
}
```

#### Phase 4: Verification of Fix Success
After fix, debug output showed:
```
✅ Passphrase provided, passing to ssh2-streams for key parsing
✅ hasPassphrase: true
✅ encrypted key and passphrase provided, continuing...
✅ OpenSSH_Private.parse succeeded (not an error!)
✅ hasSign: true and hasGetPublicSSH: true
✅ getPublicSSH() returned: Object (success!)
✅ parsedKey.sign returned: Object (signing worked!)
```

#### Phase 5: New Issue - VSCode Crypto Signature Processing
**Success:** Key parsing and basic signing now work
**New Issue:** Buffer allocation error in ssh2-streams after signing:
```
The value of "size" is out of range. It must be >= 0 && <= 34359738367. Received NaN
at Buffer.allocUnsafe (node:buffer:408:3)
```

**Analysis:** VSCode's crypto produces signatures that ssh2-streams can't process properly. The signature format or length calculation fails when ssh2-streams tries to handle the result.

**Next Step:** Implement signing fix to use external Node.js crypto and return properly formatted signatures.

### Key Lessons Learned

1. **Modern OpenSSH encryption is invisible** - encrypted keys look like unencrypted keys in PEM text
2. **Always pass passphrase to ssh2-streams** - let it decide if key is encrypted
3. **VSCode crypto breaks at signature processing** - not just at crypto operations
4. **Comprehensive debugging is essential** - library-level debugging reveals root causes
5. **The signing fix is still needed** - but now we know exactly where and why

This document should serve as a reference for future debugging sessions when SSH key authentication breaks in VSCode extensions.
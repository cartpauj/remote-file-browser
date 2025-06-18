import { execSync } from 'child_process';

// Use require to avoid TypeScript import issues with ssh2-streams
const ssh2Streams = require('ssh2-streams');

// Flag to control when the signing fix is applied
let shouldApplyFixes = false;

// Store original parseKey function
const originalParseKey = ssh2Streams.utils.parseKey;

/**
 * Enable the SSH2 signing fix for VSCode crypto issues
 */
export function enableSigningFix(): void {
    shouldApplyFixes = true;
    console.log('[SSH2-SIGNING-FIX] Enabled for key authentication');
}

/**
 * Disable the SSH2 signing fix
 */
export function disableSigningFix(): void {
    shouldApplyFixes = false;
    console.log('[SSH2-SIGNING-FIX] Disabled for password authentication');
}

/**
 * Sign data using external Node.js process to bypass VSCode's broken crypto
 */
function signWithSystemCryptoSync(traditionalPem: string, passphrase: string | undefined, data: Buffer): Buffer {
    try {
        console.log('[SSH2-SIGNING-FIX] Using external Node.js crypto for signing');
        
        // Create a simpler temp file approach to avoid script injection issues
        const tempFilename = '/tmp/ssh_sign_' + Math.random().toString(36).substring(7) + '.js';
        const signingScript = `
const crypto = require('crypto');
const fs = require('fs');

try {
    const input = JSON.parse(process.argv[2]);
    const { privateKey, passphrase, data } = input;
    
    // Create signing object
    const sign = crypto.createSign('SHA1'); // ssh2-streams expects SHA-1 for RSA keys
    sign.update(Buffer.from(data, 'base64'));
    
    // Sign with private key
    const signature = sign.sign({
        key: privateKey,
        passphrase: passphrase || undefined
    });
    
    // Output base64 encoded signature
    process.stdout.write(signature.toString('base64'));
} catch (error) {
    process.stderr.write('SIGNING_ERROR: ' + error.message);
    process.exit(1);
}
        `;
        
        // Write script to temp file
        const fs = require('fs');
        fs.writeFileSync(tempFilename, signingScript);
        
        const input = JSON.stringify({
            privateKey: traditionalPem,
            passphrase: passphrase || undefined,
            data: data.toString('base64')
        });
        
        try {
            const result = execSync(`node ${tempFilename} ${JSON.stringify(input)}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            // Clean up temp file
            fs.unlinkSync(tempFilename);
            
            return Buffer.from(result.trim(), 'base64');
        } catch (error) {
            // Clean up temp file on error too
            try { fs.unlinkSync(tempFilename); } catch {}
            throw error;
        }
        
    } catch (error: any) {
        console.error('[SSH2-SIGNING-FIX] External crypto signing failed:', error.message);
        throw new Error(`System crypto signing failed: ${error.message}`);
    }
}

/**
 * Patch ssh2-streams parseKey function to inject custom signing logic
 */
ssh2Streams.utils.parseKey = function(keyData: string | Buffer, passphrase?: string) {
    console.log('[SSH2-SIGNING-FIX] parseKey intercepted, shouldApplyFixes:', shouldApplyFixes);
    
    if (!shouldApplyFixes || !keyData) {
        console.log('[SSH2-SIGNING-FIX] Fixes disabled or no key data, using original parseKey');
        return originalParseKey.call(this, keyData, passphrase);
    }
    
    console.log('[SSH2-SIGNING-FIX] Calling original parseKey to get base key object...');
    const originalResult = originalParseKey.call(this, keyData, passphrase);
    
    if (!originalResult) {
        console.log('[SSH2-SIGNING-FIX] Original parseKey returned null/undefined');
        return originalResult;
    }
    
    if (originalResult instanceof Error) {
        console.log('[SSH2-SIGNING-FIX] Original parseKey returned error:', originalResult.message);
        return originalResult;
    }
    
    console.log('[SSH2-SIGNING-FIX] Original parseKey succeeded, processing result...');
    
    // Handle both single key and array of keys
    const keysToProcess = Array.isArray(originalResult) ? originalResult : [originalResult];
    console.log('[SSH2-SIGNING-FIX] Processing', keysToProcess.length, 'key(s)');
    
    const processedKeys = keysToProcess.map((key, index) => {
        console.log(`[SSH2-SIGNING-FIX] Processing key ${index + 1}/${keysToProcess.length}`);
        
        if (!key || typeof key.sign !== 'function') {
            console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} invalid or missing sign method`);
            return key;
        }
        
        // Store original sign function
        const originalSign = key.sign.bind(key);
        
        // Look for Symbol properties containing traditional PEM
        const symbols = Object.getOwnPropertySymbols(key);
        console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} has ${symbols.length} symbol properties:`, 
            symbols.map(s => s.toString()));
        
        const privateKeyPemSymbol = symbols.find(s => 
            s.toString().includes('Private key PEM')
        );
        
        if (!privateKeyPemSymbol) {
            console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} missing Private key PEM symbol, using original signing`);
            return key;
        }
        
        const traditionalKeyPem = key[privateKeyPemSymbol];
        if (!traditionalKeyPem || typeof traditionalKeyPem !== 'string') {
            console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} has invalid traditional PEM data`);
            return key;
        }
        
        console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} found traditional PEM, length:`, traditionalKeyPem.length);
        
        // DEBUG: Inspect original key object thoroughly
        console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} DETAILED INSPECTION:`);
        console.log(`[SSH2-SIGNING-FIX] - type: ${typeof key}`);
        console.log(`[SSH2-SIGNING-FIX] - constructor: ${key.constructor?.name}`);
        console.log(`[SSH2-SIGNING-FIX] - hasSign: ${typeof key.sign === 'function'}`);
        console.log(`[SSH2-SIGNING-FIX] - hasGetPublicSSH: ${typeof key.getPublicSSH === 'function'}`);
        console.log(`[SSH2-SIGNING-FIX] - all enumerable keys:`, Object.keys(key));
        console.log(`[SSH2-SIGNING-FIX] - all own property names:`, Object.getOwnPropertyNames(key));
        console.log(`[SSH2-SIGNING-FIX] - prototype properties:`, Object.getOwnPropertyNames(Object.getPrototypeOf(key)));
        
        // Store original methods before any modification
        const originalGetPublicSSH = key.getPublicSSH?.bind(key);
        console.log(`[SSH2-SIGNING-FIX] - originalGetPublicSSH bound: ${typeof originalGetPublicSSH === 'function'}`);
        
        // Test if getPublicSSH works
        if (typeof originalGetPublicSSH === 'function') {
            try {
                const testPublicKey = originalGetPublicSSH();
                console.log(`[SSH2-SIGNING-FIX] - getPublicSSH test successful, returned:`, {
                    type: typeof testPublicKey,
                    length: testPublicKey?.length,
                    isBuffer: Buffer.isBuffer(testPublicKey)
                });
            } catch (error: any) {
                console.log(`[SSH2-SIGNING-FIX] - getPublicSSH test failed:`, error.message);
            }
        }
        
        // Create enhanced key by directly modifying the original object
        // This preserves prototype chain and all hidden properties
        const enhancedKey = key;
        
        // Replace only the sign method, keep everything else intact
        enhancedKey.sign = function(data: Buffer) {
            console.log(`[SSH2-SIGNING-FIX] Custom sign called for key ${index + 1}, data length:`, data.length);
            console.log(`[SSH2-SIGNING-FIX] Skipping VSCode crypto, going straight to system crypto for reliable signing`);
            
            try {
                const systemSignature = signWithSystemCryptoSync(traditionalKeyPem, passphrase, data);
                console.log(`[SSH2-SIGNING-FIX] System crypto signing succeeded for key ${index + 1}, signature length:`, systemSignature.length);
                return systemSignature;
                
            } catch (systemError: any) {
                console.error(`[SSH2-SIGNING-FIX] System crypto signing failed for key ${index + 1}:`, systemError.message);
                
                // Only as a last resort, try VSCode crypto
                console.log(`[SSH2-SIGNING-FIX] Falling back to VSCode crypto as last resort...`);
                try {
                    const originalSignature = originalSign(data);
                    console.log(`[SSH2-SIGNING-FIX] VSCode crypto fallback succeeded, inspecting signature:`, {
                        type: typeof originalSignature,
                        isBuffer: Buffer.isBuffer(originalSignature),
                        length: originalSignature?.length,
                        hasLength: 'length' in (originalSignature || {}),
                        constructor: originalSignature?.constructor?.name
                    });
                    
                    // CRITICAL FIX: Ensure signature is a proper Buffer with valid length
                    if (!Buffer.isBuffer(originalSignature)) {
                        console.log(`[SSH2-SIGNING-FIX] Converting non-Buffer signature to Buffer`);
                        
                        // Try multiple conversion approaches
                        let convertedSig = null;
                        
                        if (originalSignature && typeof originalSignature === 'object') {
                            // Try Buffer.from with various approaches
                            try {
                                // Approach 1: Direct Buffer.from()
                                convertedSig = Buffer.from(originalSignature);
                                console.log(`[SSH2-SIGNING-FIX] Approach 1 success - Direct Buffer.from(), length:`, convertedSig.length);
                            } catch (e1) {
                                try {
                                    // Approach 2: Check if it has data property (like Uint8Array)
                                    if (originalSignature.data && Array.isArray(originalSignature.data)) {
                                        convertedSig = Buffer.from(originalSignature.data);
                                        console.log(`[SSH2-SIGNING-FIX] Approach 2 success - From .data array, length:`, convertedSig.length);
                                    } else if (originalSignature.buffer && originalSignature.byteLength) {
                                        // Approach 3: ArrayBuffer-like object
                                        convertedSig = Buffer.from(originalSignature.buffer, originalSignature.byteOffset || 0, originalSignature.byteLength);
                                        console.log(`[SSH2-SIGNING-FIX] Approach 3 success - From ArrayBuffer, length:`, convertedSig.length);
                                    } else {
                                        // Approach 4: Try Object.values() for object with numeric keys
                                        const values = Object.values(originalSignature);
                                        if (values.length > 0 && values.every(v => typeof v === 'number')) {
                                            convertedSig = Buffer.from(values as number[]);
                                            console.log(`[SSH2-SIGNING-FIX] Approach 4 success - From object values, length:`, convertedSig.length);
                                        }
                                    }
                                } catch (e2: any) {
                                    console.log(`[SSH2-SIGNING-FIX] All conversion approaches failed:`, (e1 as any).message, e2.message);
                                }
                            }
                        }
                        
                        if (!convertedSig) {
                            throw new Error(`VSCode signature cannot be converted to Buffer. Type: ${typeof originalSignature}, Constructor: ${originalSignature?.constructor?.name}`);
                        }
                        
                        return convertedSig;
                    }
                    
                    // Check if Buffer has valid length
                    if (typeof originalSignature.length !== 'number' || isNaN(originalSignature.length)) {
                        throw new Error(`VSCode signature Buffer has invalid length: ${originalSignature.length}`);
                    }
                    
                    console.log(`[SSH2-SIGNING-FIX] VSCode signature is valid Buffer with length:`, originalSignature.length);
                    return originalSignature;
                } catch (vscodeError: any) {
                    console.error(`[SSH2-SIGNING-FIX] Both system crypto and VSCode crypto failed`);
                    throw new Error(`All signing methods failed: System: ${systemError.message}, VSCode: ${vscodeError.message}`);
                }
            }
        };
        
        // DEBUG: Verify enhanced key still has all methods
        console.log(`[SSH2-SIGNING-FIX] Key ${index + 1} AFTER ENHANCEMENT:`);
        console.log(`[SSH2-SIGNING-FIX] - hasSign: ${typeof enhancedKey.sign === 'function'}`);
        console.log(`[SSH2-SIGNING-FIX] - hasGetPublicSSH: ${typeof enhancedKey.getPublicSSH === 'function'}`);
        
        // Test enhanced key getPublicSSH
        if (typeof enhancedKey.getPublicSSH === 'function') {
            try {
                const testPublicKey2 = enhancedKey.getPublicSSH();
                console.log(`[SSH2-SIGNING-FIX] - enhanced getPublicSSH test successful`);
            } catch (error: any) {
                console.log(`[SSH2-SIGNING-FIX] - enhanced getPublicSSH test failed:`, error.message);
            }
        } else {
            console.log(`[SSH2-SIGNING-FIX] CRITICAL - getPublicSSH method was lost during enhancement!`);
        }
        
        console.log(`[SSH2-SIGNING-FIX] Enhanced key ${index + 1} with custom signing function`);
        return enhancedKey;
    });
    
    // Return in same format as original result
    const finalResult = Array.isArray(originalResult) ? processedKeys : processedKeys[0];
    console.log('[SSH2-SIGNING-FIX] Returning processed result, isArray:', Array.isArray(finalResult));
    
    // DEBUG: Final result inspection
    if (Array.isArray(finalResult)) {
        console.log('[SSH2-SIGNING-FIX] Final result is array with length:', finalResult.length);
        finalResult.forEach((key, i) => {
            console.log(`[SSH2-SIGNING-FIX] Final array[${i}]:`, {
                hasSign: typeof key?.sign === 'function',
                hasGetPublicSSH: typeof key?.getPublicSSH === 'function',
                type: typeof key,
                constructor: key?.constructor?.name
            });
        });
    } else {
        console.log('[SSH2-SIGNING-FIX] Final result is single object:', {
            hasSign: typeof finalResult?.sign === 'function',
            hasGetPublicSSH: typeof finalResult?.getPublicSSH === 'function',
            type: typeof finalResult,
            constructor: finalResult?.constructor?.name
        });
    }
    
    return finalResult;
};
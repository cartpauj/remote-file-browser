import { execSync } from 'child_process';

const ssh2Streams = require('ssh2-streams');
const originalParseKey = ssh2Streams.utils.parseKey;

let shouldApplyFixes = false;

function detectKeyTypeFromPem(pemContent: string): string {
    // Detect key type from PEM content
    if (pemContent.includes('BEGIN RSA PRIVATE KEY') || pemContent.includes('ssh-rsa')) {
        return 'ssh-rsa';
    }
    if (pemContent.includes('BEGIN DSA PRIVATE KEY') || pemContent.includes('ssh-dss')) {
        return 'ssh-dss';
    }
    if (pemContent.includes('BEGIN EC PRIVATE KEY') || pemContent.includes('ecdsa-sha2-')) {
        // Try to detect ECDSA curve from content
        if (pemContent.includes('nistp256') || pemContent.includes('prime256v1')) {
            return 'ecdsa-sha2-nistp256';
        }
        if (pemContent.includes('nistp384') || pemContent.includes('secp384r1')) {
            return 'ecdsa-sha2-nistp384';
        }
        if (pemContent.includes('nistp521') || pemContent.includes('secp521r1')) {
            return 'ecdsa-sha2-nistp521';
        }
        return 'ecdsa-sha2-nistp256'; // Default to P-256
    }
    if (pemContent.includes('ssh-ed25519') || pemContent.includes('Ed25519')) {
        return 'ssh-ed25519';
    }
    
    // Default to RSA if unknown
    return 'ssh-rsa';
}

function detectKeyTypeFromOriginal(keyData: string | Buffer): string | null {
    // Try to detect key type from original key data (OpenSSH format, PPK, etc.)
    const keyStr = Buffer.isBuffer(keyData) ? keyData.toString() : keyData;
    
    // OpenSSH format detection
    if (keyStr.includes('BEGIN OPENSSH PRIVATE KEY')) {
        // Look for key type indicators in OpenSSH format
        if (keyStr.includes('ssh-rsa')) return 'ssh-rsa';
        if (keyStr.includes('ssh-dss')) return 'ssh-dss';
        if (keyStr.includes('ecdsa-sha2-nistp256')) return 'ecdsa-sha2-nistp256';
        if (keyStr.includes('ecdsa-sha2-nistp384')) return 'ecdsa-sha2-nistp384';
        if (keyStr.includes('ecdsa-sha2-nistp521')) return 'ecdsa-sha2-nistp521';
        if (keyStr.includes('ssh-ed25519')) return 'ssh-ed25519';
    }
    
    // PPK (PuTTY) format detection
    if (keyStr.includes('PuTTY-User-Key-File-')) {
        if (keyStr.includes('ssh-rsa')) return 'ssh-rsa';
        if (keyStr.includes('ssh-dss')) return 'ssh-dss';
        if (keyStr.includes('ecdsa-sha2-nistp256')) return 'ecdsa-sha2-nistp256';
        if (keyStr.includes('ecdsa-sha2-nistp384')) return 'ecdsa-sha2-nistp384';
        if (keyStr.includes('ecdsa-sha2-nistp521')) return 'ecdsa-sha2-nistp521';
        if (keyStr.includes('ssh-ed25519')) return 'ssh-ed25519';
    }
    
    // Traditional PEM format detection (fallback)
    if (keyStr.includes('BEGIN RSA PRIVATE KEY')) return 'ssh-rsa';
    if (keyStr.includes('BEGIN DSA PRIVATE KEY')) return 'ssh-dss';
    if (keyStr.includes('BEGIN EC PRIVATE KEY')) return 'ecdsa-sha2-nistp256'; // Default curve
    
    return null; // Unknown format
}

export function enableSigningFix(): void {
    shouldApplyFixes = true;
}

export function disableSigningFix(): void {
    shouldApplyFixes = false;
}

function signWithSystemCrypto(traditionalPem: string, passphrase: string | undefined, data: Buffer, keyType?: string): Buffer {
    const fs = require('fs');
    const tempFilename = '/tmp/ssh_sign_' + Math.random().toString(36).substring(7) + '.js';
    
    const signingScript = `
const crypto = require('crypto');
try {
    const input = JSON.parse(process.argv[2]);
    const { privateKey, passphrase, data, keyType } = input;
    
    // Determine hash algorithm based on SSH key type
    function getHashAlgorithmForKeyType(keyType) {
        if (!keyType) return 'SHA1'; // Default for unknown types
        
        switch(keyType.toLowerCase()) {
            case 'ssh-rsa':
            case 'ssh-dss':
                return 'SHA1';
            case 'ecdsa-sha2-nistp256':
                return 'SHA256';
            case 'ecdsa-sha2-nistp384':
                return 'SHA384';
            case 'ecdsa-sha2-nistp521':
                return 'SHA512';
            case 'ssh-ed25519':
                return null; // Ed25519 uses direct signing
            default:
                return 'SHA1'; // Fallback to RSA default
        }
    }
    
    const hashAlgorithm = getHashAlgorithmForKeyType(keyType);
    
    let signature;
    if (hashAlgorithm === null) {
        // Ed25519 keys use direct signing without hash algorithm
        signature = crypto.sign(null, Buffer.from(data, 'base64'), {
            key: privateKey,
            passphrase: passphrase || undefined
        });
    } else {
        // Traditional signing with hash algorithm
        const sign = crypto.createSign(hashAlgorithm);
        sign.update(Buffer.from(data, 'base64'));
        signature = sign.sign({ key: privateKey, passphrase: passphrase || undefined });
    }
    
    process.stdout.write(signature.toString('base64'));
} catch (error) {
    process.stderr.write('SIGNING_ERROR: ' + error.message);
    process.exit(1);
}`;
    
    try {
        fs.writeFileSync(tempFilename, signingScript);
        
        const input = JSON.stringify({
            privateKey: traditionalPem,
            passphrase: passphrase || undefined,
            data: data.toString('base64'),
            keyType: keyType
        });
        
        const result = execSync(`node ${tempFilename} ${JSON.stringify(input)}`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        fs.unlinkSync(tempFilename);
        return Buffer.from(result.trim(), 'base64');
        
    } catch (error) {
        try { fs.unlinkSync(tempFilename); } catch {}
        throw error;
    }
}

ssh2Streams.utils.parseKey = function(keyData: string | Buffer, passphrase?: string) {
    if (!shouldApplyFixes || !keyData) {
        return originalParseKey.call(this, keyData, passphrase);
    }
    
    const originalResult = originalParseKey.call(this, keyData, passphrase);
    
    if (!originalResult || originalResult instanceof Error) {
        return originalResult;
    }
    
    const keysToProcess = Array.isArray(originalResult) ? originalResult : [originalResult];
    
    const processedKeys = keysToProcess.map(key => {
        if (!key || typeof key.sign !== 'function') {
            return key;
        }
        
        // Try to find key material from ssh2-streams Symbol properties
        const privateKeyPemSymbol = Object.getOwnPropertySymbols(key).find(s => 
            s.toString().includes('Private key PEM')
        );
        
        // If no traditional PEM found, check if we can extract key info from the original key data
        if (!privateKeyPemSymbol) {
            console.log('[SSH2-Fix] No traditional PEM symbol found, checking if key type is available...');
            
            // Try to get key type from ssh2-streams key object
            const keyType = key.type || key.fulltype || detectKeyTypeFromOriginal(keyData);
            
            if (!keyType || !key.sign) {
                console.log('[SSH2-Fix] No key type detected or no sign method, skipping fix');
                return key; // Skip fix if we can't determine key type
            }
            
            // For non-PEM keys, try to use the original ssh2-streams signing but with better error handling
            console.log(`[SSH2-Fix] Applying minimal fix for key type: ${keyType}`);
            const originalSign = key.sign;
            key.sign = function(data: Buffer) {
                try {
                    const result = originalSign.call(this, data);
                    if (!result || result instanceof Error) {
                        throw new Error('Original ssh2-streams signing failed');
                    }
                    return result;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.log(`[SSH2-Fix] Original signing failed for ${keyType}:`, errorMessage);
                    throw error;
                }
            };
            
            return key;
        }
        
        const traditionalKeyPem = key[privateKeyPemSymbol];
        if (!traditionalKeyPem || typeof traditionalKeyPem !== 'string') {
            console.log('[SSH2-Fix] Traditional PEM symbol found but content invalid');
            return key;
        }
        
        // Detect key type from the key object and PEM content
        const keyType = key.type || key.fulltype || detectKeyTypeFromPem(traditionalKeyPem);
        console.log(`[SSH2-Fix] Applying full system crypto fix for key type: ${keyType}`);
        
        // Replace sign method with system crypto implementation
        key.sign = function(data: Buffer) {
            try {
                return signWithSystemCrypto(traditionalKeyPem, passphrase, data, keyType);
            } catch (error) {
                // Fallback to original signing if system crypto fails
                return originalParseKey.call(this, keyData, passphrase)?.[0]?.sign?.(data);
            }
        };
        
        return key;
    });
    
    return Array.isArray(originalResult) ? processedKeys : processedKeys[0];
};
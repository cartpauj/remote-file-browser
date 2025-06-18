import { execSync } from 'child_process';

const ssh2Streams = require('ssh2-streams');
const originalParseKey = ssh2Streams.utils.parseKey;

let shouldApplyFixes = false;

export function enableSigningFix(): void {
    shouldApplyFixes = true;
}

export function disableSigningFix(): void {
    shouldApplyFixes = false;
}

function signWithSystemCrypto(traditionalPem: string, passphrase: string | undefined, data: Buffer): Buffer {
    const fs = require('fs');
    const tempFilename = '/tmp/ssh_sign_' + Math.random().toString(36).substring(7) + '.js';
    
    const signingScript = `
const crypto = require('crypto');
try {
    const input = JSON.parse(process.argv[2]);
    const { privateKey, passphrase, data } = input;
    
    const sign = crypto.createSign('SHA1');
    sign.update(Buffer.from(data, 'base64'));
    const signature = sign.sign({ key: privateKey, passphrase: passphrase || undefined });
    
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
            data: data.toString('base64')
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
        
        // Find the traditional PEM that ssh2-streams converted and stored in Symbol properties
        const privateKeyPemSymbol = Object.getOwnPropertySymbols(key).find(s => 
            s.toString().includes('Private key PEM')
        );
        
        if (!privateKeyPemSymbol) {
            return key;
        }
        
        const traditionalKeyPem = key[privateKeyPemSymbol];
        if (!traditionalKeyPem || typeof traditionalKeyPem !== 'string') {
            return key;
        }
        
        // Replace sign method with system crypto implementation
        key.sign = function(data: Buffer) {
            try {
                return signWithSystemCrypto(traditionalKeyPem, passphrase, data);
            } catch (error) {
                // Fallback to original signing if system crypto fails
                return originalParseKey.call(this, keyData, passphrase)?.[0]?.sign?.(data);
            }
        };
        
        return key;
    });
    
    return Array.isArray(originalResult) ? processedKeys : processedKeys[0];
};
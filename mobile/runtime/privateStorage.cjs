const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

// Adapt desktop session persistence to Android's app-private files, with authenticated encryption and a separate private key.
function createPrivateStorage(stateDir) {
    const keyPath=path.join(stateDir,'kugou-session-key');
    if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,crypto.randomBytes(32),{mode:0o600,flag:'wx'});
    const key=fs.readFileSync(keyPath);
    if(key.length!==32)throw new Error('Invalid private session key');
    const aad=Buffer.from('Folia Android KuGou session v1');
    return {
        isEncryptionAvailable:()=>true,
        getSelectedStorageBackend:()=> 'android-app-private-aes-gcm',
        encryptString(plaintext) {
            const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
            cipher.setAAD(aad);
            const encrypted=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
            return Buffer.concat([Buffer.from([1]),iv,cipher.getAuthTag(),encrypted]);
        },
        decryptString(payload) {
            if(payload.length<29 || payload[0]!==1)throw new Error('Invalid session envelope');
            const cipher=crypto.createDecipheriv('aes-256-gcm',key,payload.subarray(1,13));
            cipher.setAAD(aad);cipher.setAuthTag(payload.subarray(13,29));
            return Buffer.concat([cipher.update(payload.subarray(29)),cipher.final()]).toString('utf8');
        },
    };
}
module.exports={createPrivateStorage};

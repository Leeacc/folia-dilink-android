const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createPrivateStorage}=require('../mobile/runtime/privateStorage.cjs');

// Login persistence must survive a process restart and reject altered ciphertext.
test('private Android session encryption survives restart without plaintext credentials',()=>{
    const folder=fs.mkdtempSync(path.join(os.tmpdir(),'folia-session-test-'));
    try{
        const first=createPrivateStorage(folder),sealed=first.encryptString('测试 credential');
        assert.equal(sealed.includes(Buffer.from('credential')),false);
        assert.equal(createPrivateStorage(folder).decryptString(sealed),'测试 credential');
        if(process.platform!=='win32')assert.equal(fs.statSync(path.join(folder,'kugou-session-key')).mode&0o777,0o600);
        sealed[sealed.length-1]^=1;assert.throws(()=>first.decryptString(sealed));
    }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

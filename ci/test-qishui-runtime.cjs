const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createPrivateStore} = require('../mobile/runtime/privateStore.cjs');
const {createPrivateStorage} = require('../mobile/runtime/privateStorage.cjs');
const {createSessionRepository,SESSION_KEY} = require('../electron/qishui/session.cjs');
const {createQishuiApiBridge} = require('../electron/qishui/qishuiApiBridge.cjs');
const {createQishuiGuard} = require('../mobile/runtime/node_modules/qishui-music-api/src/protocol.cjs');

// Check the real protocol package and Android persistence under the same Node 18 major as the APK.
test('encrypted account survives a runtime restart and logout removes it', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-qishui-'));
    try {
        const store = () => createPrivateStore(folder, 'qishui-session.json');
        const safeStorage = createPrivateStorage(folder);
        const first = createSessionRepository({store: store(), safeStorage});
        const account = {userId:'fixture-user',ticket:'fixture-private-ticket',guardKey:'key',guardCert:'cert',
            guardTsSign:'signature',accessCode:'access',expiresAt:Date.now()+3600000};
        first.set(account);
        assert.equal(fs.readFileSync(path.join(folder,'qishui-session.json'),'utf8').includes(account.ticket),false);
        const second = createSessionRepository({store: store(), safeStorage:createPrivateStorage(folder)});
        assert.equal(second.deviceId,first.deviceId);
        assert.equal(second.get().ticket,account.ticket);
        second.clear();
        assert.equal(store().get(SESSION_KEY),undefined);
        assert.equal(createSessionRepository({store:store(),safeStorage}).get(),null);
    } finally {fs.rmSync(folder,{recursive:true,force:true});}
});
test('ticket guard generates its cryptographic material on the embedded Node major', () => {
    const guard = createQishuiGuard();
    assert.equal(typeof guard.guardKey,'string');
    assert.ok(guard.csr || guard.guardCert);
});
test('protocol validation rejects invalid operations and arbitrary media input before networking', async () => {
    const values = new Map();let fetches=0;
    const store={get:k=>values.get(k),set:(k,v)=>values.set(k,v),delete:k=>values.delete(k)};
    const bridge=createQishuiApiBridge({store,fetch:()=>{fetches++;throw Error('unexpected network');},log:()=>{},warn:()=>{}});
    assert.equal((await bridge.request('fetch',{url:'https://invalid.example'})).error.code,'unsupported');
    assert.equal((await bridge.request('audio',{id:'https://invalid.example',quality:'standard'})).error.code,'invalid-response');
    assert.equal((await bridge.request('login_status')).ok,true);
    assert.equal(fetches,0);
});

test('packaged private listener exposes Qishui only through authenticated native requests', async () => {
    const {spawn} = require('node:child_process');
    const crypto = require('node:crypto');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'folia-runtime-'));
    const secret = crypto.randomBytes(24).toString('hex');
    const child = spawn(process.execPath,[path.resolve('mobile/runtime/main.cjs'),folder,secret],{stdio:['ignore','ignore','pipe']});
    const closed=new Promise(resolve=>child.once('close',resolve));
    let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
    try {
        const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
        const portFile=path.join(folder,'port');
        for(let count=0;count<100 && !fs.existsSync(portFile);count++){if(child.exitCode!==null)throw Error('Runtime exited before ready: '+errors);await delay(100);}
        assert.ok(fs.existsSync(portFile),'Runtime did not become ready');
        const base='http://127.0.0.1:'+fs.readFileSync(portFile,'utf8');
        assert.equal((await fetch(base+'/health')).status,403);
        const headers={'x-folia-token':secret,'Content-Type':'application/json'};
        const health=await (await fetch(base+'/health',{headers})).json();
        assert.ok(health.providers.includes('qishui'));
        const result=await (await fetch(base+'/request',{method:'POST',headers,
            body:JSON.stringify({provider:'qishui',endpoint:'/login_status',method:'POST',payload:'{}'})})).json();
        assert.deepEqual(result,{data:{ok:true,data:null}});
    } finally {child.kill();await closed;fs.rmSync(folder,{recursive:true,force:true});}
});

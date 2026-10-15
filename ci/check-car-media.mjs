import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

// Test a real app-restored public provider track through Android's native controller and volume keys.
const pages=await(await fetch('http://127.0.0.1:9222/json')).json();
const page=pages.find(value=>value.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let nextId=1;const pending=new Map();
ws.addEventListener('message',event=>{const data=JSON.parse(event.data);const current=pending.get(data.id);if(current){pending.delete(data.id);clearTimeout(current.timer);current.resolve(data);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Car WebView check timed out'));},90000);pending.set(id,{resolve,timer});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const data=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(data.result?.exceptionDetails)throw new Error(data.result.exceptionDetails.exception?.description || data.result.exceptionDetails.text);return data.result?.result?.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitForAudio=async paused=>{
    for(let attempt=0;attempt<30;attempt++){
        if(await evaluate(`document.querySelector('audio').paused === ${paused}`))return true;
        await delay(500);
    }
    return false;
};
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000});
const report={fixture:'Public NetEase stream 1909126284, synthetic cached display title; real native Android bridge',device:'emulator, not DiLink hardware'};
try {
    const initial=await evaluate('({ua:navigator.userAgent})');
    if(Number(initial.ua.match(/Chrome\/(\d+)/)?.[1])<95){report.skipped='Old WebView compatibility page';}
    else {
        await evaluate(`(async()=>{
            const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('KineticPlayerDB');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
            const song={id:1909126284,name:'Folia Car Integration Test',artists:[{id:1,name:'Provider test stream'}],album:{id:1,name:'CI verification'},durationMs:120000,sourceRef:{kind:'online',providerId:'netease',mediaId:'1909126284'}};
            await new Promise((resolve,reject)=>{const tx=db.transaction('api_cache','readwrite');const store=tx.objectStore('api_cache');store.put({key:'last_song',data:song,timestamp:Date.now()});store.put({key:'last_queue',data:[song],timestamp:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
            localStorage.setItem('visualizer_mode','fume');localStorage.setItem('auto_use_best_lyric','false');
        })()`);
        await call('Page.reload');await delay(8000);
        await evaluate(`(async()=>{for(let i=0;i<60;i++){const audio=document.querySelector('audio');if(audio?.src && audio.readyState>=1)break;await new Promise(r=>setTimeout(r,500));}const audio=document.querySelector('audio');if(!audio?.src)throw new Error('App session did not restore audio');
            const state={view:'player',appHistoryIndex:1};history.replaceState(state,'','#player');dispatchEvent(new PopStateEvent('popstate',{state}));
            window.__carNativeCommands=[];window.__carCommandListener=window.Capacitor.nativeCallback('CarMedia','addListener',{eventName:'command'},event=>window.__carNativeCommands.push(event.action));
            await audio.play();})()`);
        await delay(2000);
        const dump=adb('shell','dumpsys','media_session');writeFileSync('artifacts/car-media-session.txt',dump);
        report.nativeSession=dump.includes('Folia') && dump.includes('Folia Car Integration Test');
        if(!report.nativeSession)throw new Error('Folia track metadata missing from Android MediaSession');
        report.nativeDiagnostics=await evaluate("window.Capacitor.nativePromise('CarMedia','diagnostics',{})");
        const native=report.nativeDiagnostics.nativeAudio;
        if(!native || native.engine!=='android.media.MediaPlayer' || !native.prepared || !native.focusHeld || !native.playing)
            throw new Error('Actual native player/focus did not become active');
        if(native.gain>0.2001)throw new Error('Initial native gain exceeded startup guard');
        if(report.nativeDiagnostics.requestedOrientation!==-1)throw new Error('Activity still requests an orientation lock');
        if(report.nativeDiagnostics.oem?.splitManifestValue!==1)throw new Error('Packaged BYD split eligibility marker missing or not an integer');
        report.gainSteps=[];
        for(const value of [.01,.05,.2,.5,1]){
            await evaluate(`(async()=>{document.querySelector('audio').volume=${value};await new Promise(r=>setTimeout(r,400));})()`);
            const state=await evaluate("window.Capacitor.nativePromise('NativeAudio','status',{})");
            report.gainSteps.push({requested:value,applied:state.gain,playing:state.playing});
            if(Math.abs(state.gain-value)>0.0001||!state.playing)throw new Error('Native volume range regression');
            writeFileSync('artifacts/audio-mixer-'+value+'.txt',adb('shell','dumpsys','media.audio_flinger'));
        }
        await evaluate("document.querySelector('audio').volume=.2");
        const before=await evaluate("window.Capacitor.nativePromise('CarMedia','getVolume',{})");
        adb('shell','input','keyevent',before.index>=before.max?'25':'24');await delay(500);
        const after=await evaluate("window.Capacitor.nativePromise('CarMedia','getVolume',{})");
        report.hardwareVolume=before.index!==after.index;
        await evaluate(`window.Capacitor.nativePromise('CarMedia','setVolume',{value:${before.value}})`);
        if(!report.hardwareVolume)throw new Error('Hardware key did not change STREAM_MUSIC volume');
        adb('shell','cmd','media_session','dispatch','pause');await delay(1000);
        report.systemPause=await waitForAudio(true);
        adb('shell','cmd','media_session','dispatch','play');await delay(1500);
        report.systemPlay=await waitForAudio(false);
        report.transportDiagnostics=await evaluate("window.Capacitor.nativePromise('CarMedia','diagnostics',{})");
        report.nativeCommands=await evaluate('window.__carNativeCommands');
        if(!report.systemPause || !report.systemPlay)throw new Error('System controller did not pause/resume the app audio');
        for(const command of ['next','previous']){adb('shell','cmd','media_session','dispatch',command);await delay(1200);}
        for(let attempt=0;attempt<30;attempt++){
            report.nativeCommands=await evaluate('window.__carNativeCommands');
            if(['next','previous'].every(command=>report.nativeCommands.includes(command)))break;
            await delay(500);
        }
        if(!['pause','play','next','previous'].every(command=>report.nativeCommands.includes(command)))throw new Error('Native transport command did not reach the app');
        await evaluate('document.querySelector("audio").play()');await delay(1200);
        await delay(5500);
        report.idleControls=await evaluate('document.documentElement.dataset.carIdle === "true"');
        if(!report.idleControls)throw new Error('Car controls did not hide after inactivity');
        const timeBefore=await evaluate('document.querySelector("audio").currentTime');
        adb('shell','input','keyevent','3');await delay(7000);
        report.backgroundAudio=await evaluate(`!document.querySelector('audio').paused && document.querySelector('audio').currentTime > ${timeBefore+4}`);
        writeFileSync('artifacts/car-foreground-service.txt',adb('shell','dumpsys','activity','services','io.github.leeacc.folia.dilink'));
        if(!report.backgroundAudio)throw new Error('App audio stopped when returning to the launcher');
        adb('shell','cmd','media_session','dispatch','pause');await delay(1000);
        report.backgroundPause=await waitForAudio(true);
        adb('shell','cmd','media_session','dispatch','play');await delay(1500);
        report.backgroundPlay=await waitForAudio(false);
        if(!report.backgroundPause || !report.backgroundPlay)throw new Error('Background media transport failed');
        adb('shell','am','start','-n','io.github.leeacc.folia.dilink/top.izuna.foliamajor.MainActivity');await delay(1500);
        // Window-manager support differs across emulator images/OEMs. Record actual support, never infer it from a viewport resize.
        try {
            adb('shell','settings','put','global','enable_freeform_support','1');
            report.windowCommand=adb('shell','am','start','--windowingMode','5','-n','io.github.leeacc.folia.dilink/top.izuna.foliamajor.MainActivity').slice(0,500);
            await delay(2000);report.windowDiagnostics=await evaluate("window.Capacitor.nativePromise('CarMedia','diagnostics',{})");
            report.windowLayout=await evaluate('({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth})');
            const screenshot=await call('Page.captureScreenshot',{format:'png'});if(screenshot.result?.data)writeFileSync('artifacts/car-window.png',Buffer.from(screenshot.result.data,'base64'));
        } catch {report.multiWindow='Emulator command unavailable; browser narrow-window layout checked separately';}
        // Exercise the actual native engine with the same public KuGou preview used by the transport regression.
        report.nativeKugou=await evaluate(`(async()=>{
            const native=(method,input={})=>window.Capacitor.nativePromise('NativeAudio',method,input);
            const previous=JSON.parse(sessionStorage.getItem('ci-public-kugou-preview')||'null');
            let source=previous&&Date.now()-previous.at<600000?previous.source:null;
            for(let attempt=0;!source&&attempt<3;attempt++){
                const result=await window.Capacitor.nativePromise('EmbeddedMusic','request',{provider:'kugou',endpoint:'/song/url?hash=B04ED0F01ABBB62B9D22EC4616ED8AFE&quality=128&free_part=1'});
                const body=result.data?.body??result.data, urls=body?.data?.url??body?.url;
                source=(Array.isArray(urls)?urls:[urls]).find(value=>typeof value==='string'&&/^https?:/.test(value));
                if(source)break;await new Promise(r=>setTimeout(r,1500));
            }
            if(!source)throw new Error('No public KuGou preview URL for native check');
            await native('setGain',{value:.1});await native('prepare',{source,sourceId:'ci-native-kugou'});await native('play');
            await new Promise(r=>setTimeout(r,1800));const playing=await native('status');
            await native('seek',{position:5});await new Promise(r=>setTimeout(r,1500));const sought=await native('status');
            await native('pause');await native('setGain',{value:.2});
            return {playing:playing.playing&&playing.position>0,seek:sought.position>=5,scheme:new URL(source).protocol};
        })()`);
        if(!report.nativeKugou.playing||!report.nativeKugou.seek)throw new Error('Native KuGou playback/seek failed');
        await evaluate('document.querySelector("audio").pause()');
        // Capacitor removeListener returns no promise result; awaiting nativePromise would never settle.
        await evaluate("void window.Capacitor.nativeCallback('CarMedia','removeListener',{eventName:'command',callbackId:window.__carCommandListener})");
    }
} catch(error){report.error=error.message;process.exitCode=1;}
finally{writeFileSync('artifacts/car-integration.json',JSON.stringify(report,null,2));console.log(report);ws.close();}

import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

// Cold native launches and pane changes without touching the WebView or using music servers.
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8', timeout:30000}).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const component = 'io.github.leeacc.folia.dilink/top.izuna.foliamajor.MainActivity';
const report = {scope:'Android emulator window lifecycle, no touch; OEM firmware caption is not emulated',checks:[]};
let ws;
async function connect() {
    const pid = adb('shell','pidof','io.github.leeacc.folia.dilink');
    adb('forward','tcp:9222',`localabstract:webview_devtools_remote_${pid}`);
    for (let attempt=0;attempt<30;attempt++) {
        try {
            const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
            const target = pages.find(page => page.type==='page');
            if (target) {
                ws = new WebSocket(target.webSocketDebuggerUrl);
                await new Promise((resolve,reject) => {ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
                return;
            }
        } catch {}
        await delay(500);
    }
    throw new Error('Cold-start WebView did not attach');
}
let id=0;
async function evaluate(expression) {
    const request=++id;
    return new Promise((resolve,reject) => {
        const timer=setTimeout(()=>{ws.removeEventListener('message',receive);reject(new Error('Window diagnostics timed out'));},15000);
        function receive(event) {
            const data=JSON.parse(event.data);
            if(data.id!==request)return;
            clearTimeout(timer);ws.removeEventListener('message',receive);
            if(data.error || data.result?.exceptionDetails)reject(new Error(JSON.stringify(data.error || data.result.exceptionDetails)));
            else resolve(data.result?.result?.value);
        }
        ws.addEventListener('message',receive);
        ws.send(JSON.stringify({id:request,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
    });
}
async function inspect(label,split) {
    const data=await evaluate(`(async()=>({native:await Capacitor.nativePromise('CarMedia','diagnostics',{}),layout:{mode:document.documentElement.dataset.carWindow,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}}))()`);
    const state=data.native.windowState,bars=data.native.windowBars;
    report.checks.push({label,...data});
    if(!state?.attached || state.multiWindow!==split || data.layout.mode!==(split?'split':'full')) throw new Error('Native pane mode/DOM marker mismatch: '+label);
    if(state.behavior!==2 || bars.statusColor!==0 || bars.navigationColor!==0 || bars.statusContrast || bars.navigationContrast) throw new Error('Window immersive behavior/transparency regressed: '+label);
    if(!split && (state.statusVisible || state.navigationVisible)) throw new Error('Fullscreen bars remained visible without touch');
    if(data.layout.overflow)throw new Error('Pane has horizontal page overflow');
}
try {
    if(Number(adb('shell','getprop','ro.build.version.sdk'))<35) report.skipped='API29 validates old WebView fallback separately';
    else {
        adb('shell','settings','put','global','enable_freeform_support','1');
        adb('shell','settings','put','global','force_resizable_activities','1');
        for(const [label,mode] of [['cold-full',1],['cold-pane',5]]) {
            if(ws){ws.close();ws=null;}
            adb('shell','am','force-stop','io.github.leeacc.folia.dilink');
            adb('shell','am','start','-W','--windowingMode',String(mode),'-n',component);
            await delay(5000);await connect();
            await inspect(label,mode===5);
            if(mode===5) {
                adb('shell','input','keyevent','3');await delay(700);
                adb('shell','am','start','-W','--windowingMode','5','-n',component);
                await delay(2500);await inspect('resume-pane',true);
            }
        }
        if(ws){ws.close();ws=null;}
        adb('shell','am','force-stop','io.github.leeacc.folia.dilink');
        adb('shell','am','start','-W','--windowingMode','1','-n',component);
        await delay(5000);await connect();await inspect('restored-full',false);
    }
} catch(error) {report.error=error.message;process.exitCode=1;}
finally {if(ws)ws.close();writeFileSync('artifacts/window-startup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

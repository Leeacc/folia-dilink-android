import { writeFileSync } from 'node:fs';

// Verify the actual WebView DOM rather than treating a live native process as UI success.
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw new Error('No debuggable WebView page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
const response = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('WebView inspection timed out')), 15000);
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id === 1) {
      clearTimeout(timer);
      resolve(message);
    }
  });
});
ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
  expression: 'JSON.stringify({text:document.body.innerText,children:(document.getElementById("root") ? document.getElementById("root").children.length : 0),width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height,userAgent:navigator.userAgent})',
  returnByValue: true,
}}));
const message = await response;
ws.close();
if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails));
const dom = JSON.parse(message.result.result.value);
writeFileSync('artifacts/webview.json', JSON.stringify(dom, null, 2));
console.log(dom);
if (dom.width <= dom.height) throw new Error('Expected landscape WebView');
const webViewMajor = Number(dom.userAgent.match(/Chrome\/(\d+)/)?.[1]);
if (!webViewMajor) throw new Error('Cannot identify WebView version');
if (webViewMajor < 95) {
  if (!dom.text.includes('Folia') || !dom.text.includes('WebView')) throw new Error('Missing compatibility message');
} else {
  if (!dom.children || !/Playlists|歌单/.test(dom.text)) throw new Error('Folia library navigation did not render');
}

if (dom.width !== dom.screenWidth || dom.height !== dom.screenHeight) throw new Error('Emulator system bars are not hidden');

if (webViewMajor >= 95) {
  const native = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { native.addEventListener('open', resolve, {once:true}); native.addEventListener('error', reject, {once:true}); });
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Embedded runtime check timed out')), 360000);
    native.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id === 2) { clearTimeout(timer); resolve(data); }
    });
  });
  native.send(JSON.stringify({ id:2, method:'Runtime.evaluate', params:{awaitPromise:true,returnByValue:true,userGesture:true,expression:`(async () => {
    const request = (provider,endpoint) => window.Capacitor.nativePromise('EmbeddedMusic','request',{provider,endpoint});
    const generated = await request('netease','/login/qr/create?key=integration-test&qrimg=true');
    if (!generated.data?.data?.qrimg?.startsWith('data:image/png;base64,')) throw new Error('Embedded QR generation failed');
    const network = {};
    for (const provider of ['netease','kugou']) {
      try {
        const result = await request(provider,'/login/qr/key');
        network[provider] = {key:Boolean(result.data?.data?.unikey || result.data?.data?.qrcode), code:result.data?.code, diagnostic:result.data?.diagnostic, file:result.data?.file, message: typeof result.data?.msg === 'string' ? result.data.msg.replace(/https?:[^ ]+/g,'[host]').slice(0,160) : undefined};
      } catch { network[provider] = false; }
    }
    const qishuiRequest = async (operation, params={}) => (await window.Capacitor.nativePromise('EmbeddedMusic','request',{
      provider:'qishui',endpoint:'/'+operation,method:'POST',payload:JSON.stringify(params)
    })).data;
    const qishui = {authenticatedPlayback:'requires user scan'};
    const started = await qishuiRequest('login_qr_key');
    if (!started.ok) throw new Error('Qishui QR start failed: '+started.error?.code);
    const qr = await qishuiRequest('login_qr_create',started.data);
    qishui.qrGenerated = qr.ok && qr.data?.imageUrl?.startsWith('data:image/png;base64,');
    if (!qishui.qrGenerated) throw new Error('Qishui QR image missing');
    const waiting = await qishuiRequest('login_qr_check',started.data);
    qishui.waiting = waiting.ok && waiting.data?.state === 'waiting';
    await qishuiRequest('login_qr_cancel',started.data);
    const songs = await qishuiRequest('search',{query:'平凡之路',limit:5});
    qishui.search = songs.ok && songs.data?.items?.length > 0;
    if (!qishui.search) throw new Error('Qishui search failed: '+songs.error?.code);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const state = {view:'player', appHistoryIndex:0};
    history.replaceState(state, '', '#player');
    dispatchEvent(new PopStateEvent('popstate', {state}));
    await delay(1000);
    const back = document.querySelector('button[aria-label="返回选歌"]');
    if (!back || back.getBoundingClientRect().width < 80) throw new Error('Missing visible Android back button');
    back.click();
    await delay(1000);
    if (document.querySelector('button[aria-label="返回选歌"]')) throw new Error('Back action did not leave player');
    const media = {};
    // Exercise authorized provider streams, including a KuGou public preview, rather than a generic MP3.
    for (const provider of ['netease','kugou']) {
      const checked = media[provider] = {};
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.muted = true;
      try {
        let body, source;
        // Public preview availability is intermittent from hosted runners. Keep the real playback assertion after bounded retries.
        for (let attempt = 0; attempt < 3; attempt++) {
          checked.attempts = attempt + 1;
          const result = await request(provider, provider === 'netease'
            ? '/song/url/v1?id=1909126284&level=standard'
            : '/song/url?hash=B04ED0F01ABBB62B9D22EC4616ED8AFE&quality=128&free_part=1');
          body = result.data?.body ?? result.data;
          const candidates = provider === 'netease' ? body?.data?.[0]?.url : (body?.data?.url ?? body?.url);
          source = (Array.isArray(candidates) ? candidates : [candidates]).find(value => typeof value === 'string' && /^https?:/.test(value));
          if (source) break;
          await delay(1500);
        }
        if (!source) { checked.code = body?.code ?? body?.status; checked.diagnostic = body?.diagnostic; checked.frames = body?.frames; checked.detail = body?.detail; checked.upstreamCode = body?.upstreamCode; checked.httpStatus = body?.httpStatus; checked.itemCode = body?.data?.[0]?.code; checked.fee = body?.data?.[0]?.fee; throw new Error('No provider stream'); }
        if (provider === 'kugou') sessionStorage.setItem('ci-public-kugou-preview', JSON.stringify({source,at:Date.now()}));
        checked.scheme = new URL(source).protocol;
        audio.src = 'https://localhost/folia-media?url=' + encodeURIComponent(source);
        await Promise.race([audio.play(), delay(25000).then(() => {throw new Error('Media timeout');})]);
        await delay(1000);
        checked.playing = audio.currentTime > 0;
        audio.currentTime = 5;
        await delay(1500);
        checked.seek = audio.currentTime >= 5;
      } catch (error) { checked.error = error.name; }
      finally { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }
    // A platform-issued plaintext stream must prepare and advance on the actual Android player.
    qishui.nativePlaying = false;
    const nativeAudio = (method, params={}) => window.Capacitor.nativePromise('NativeAudio',method,params);
    try {
      for (const track of songs.data.items.slice(0,5)) {
        const id=String(track.base_info?.id || track.id);
        const source=await qishuiRequest('audio',{id,quality:'standard'});
        if (!source.ok) continue;
        qishui.preview=Boolean(source.data.preview);
        await nativeAudio('setGain',{value:0.05});
        await nativeAudio('prepare',{source:source.data.url,sourceId:'ci-qishui'});
        await nativeAudio('play');
        await delay(1500);
        const status=await nativeAudio('status');
        qishui.nativePlaying=Boolean(status.playing && status.position>0);
        break;
      }
    } finally {await nativeAudio('pause');}
    if (!qishui.nativePlaying) throw new Error('Qishui native playback did not advance');
    // Record both provider refusals and bridge failures before failing the check.
    const qq = {search:false,qrVisible:false,authenticatedPlayback:'requires user scan'};
    try {
      let response;
      for (let retry=0;retry<3;retry++) {
        const search=await request('qq','/getSearchByKey?key=' + encodeURIComponent('海阔天空') + '&limit=20&page=1');
        response=search.data;
        if(response?.body?.request?.data?.body?.song?.list?.length)break;
        await delay(1500);
      }
      qq.searchResponse = {code:response?.code,diagnostic:response?.diagnostic,file:response?.file,status:response?.status,outerCode:response?.body?.code,requestCode:response?.body?.request?.code};
      const songs = response?.body?.request?.data?.body?.song?.list;
      qq.search = Array.isArray(songs) && songs.length > 0 && Boolean(songs[0].mid || songs[0].songmid);
      // QQ now refuses anonymous search on both the unchanged stable bridge and the upstream Lite RPC.
      // Record the explicit provider refusal; HTTP/bridge failures and unexpected shapes still fail.
      qq.anonymousSearchRefused = response?.status === 200 && response?.body?.code === 0 && response?.body?.request?.code === 2001;
      if (qq.anonymousSearchRefused) qq.authenticatedSearch = 'requires user scan';
      const account = document.querySelector('[data-bravais-account-toggle]');
      if (!account) throw new Error('Account entry unavailable');
      account.click(); await delay(500);
      let qqRow;
      for (let attempt=0;attempt<20;attempt++) {
        qqRow = document.querySelector('[role="dialog"] [role="option"][data-row="qq"]');
        if (qqRow) break;
        await delay(250);
      }
      if (!qqRow || qqRow.getAttribute('aria-disabled') === 'true') throw new Error('QQ connection entry unavailable');
      qqRow.click(); await delay(1000);

      for (let attempt = 0; attempt < 90; attempt++) {
        const selected = document.querySelector('[role="dialog"] [data-row="qq"][aria-selected="true"]');
        const image = selected && document.querySelector('[role="dialog"] img.login-code');
        if (image?.complete && image.naturalWidth > 100 && image.src.startsWith('data:image/')) { qq.qrVisible = true; break; }
        await delay(1000);
      }
      qq.dialogText = document.querySelector('[role="dialog"]')?.textContent?.slice(0,400);
    } catch (error) { qq.error = error.message; }
    return {embeddedQr:true, network, back:true, media, qq, qishui};
  })()`}}));
  const inspected = await result;
  native.close();
  if (inspected.result?.exceptionDetails) throw new Error(JSON.stringify(inspected.result.exceptionDetails));
  writeFileSync('artifacts/embedded-music.json', JSON.stringify(inspected.result.result.value, null, 2));
  if (Object.values(inspected.result.result.value.media || {}).some(value => !value.playing || !value.seek)) throw new Error('Provider audio playback/seek did not pass');
  console.log('Embedded music:', inspected.result.result.value);
  const qq = inspected.result.result.value.qq;
  if ((!qq?.search && !qq?.anonymousSearchRefused) || !qq?.qrVisible || qq?.error) throw new Error('QQ transport/QR verification failed');
}

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
  if (!dom.children || !dom.text.includes('Folia') || !/Playlists|歌单/.test(dom.text)) throw new Error('Folia library navigation did not render');
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
        const result = await request(provider, provider === 'netease'
          ? '/song/url/v1?id=1909126284&level=standard'
          : '/song/url?hash=B04ED0F01ABBB62B9D22EC4616ED8AFE&quality=128&free_part=1');
        const body = result.data?.body ?? result.data;
        const candidates = provider === 'netease' ? body?.data?.[0]?.url : (body?.data?.url ?? body?.url);
        const source = (Array.isArray(candidates) ? candidates : [candidates]).find(value => typeof value === 'string' && /^https?:/.test(value));
        if (!source) { checked.code = body?.code ?? body?.status; checked.itemCode = body?.data?.[0]?.code; checked.fee = body?.data?.[0]?.fee; throw new Error('No provider stream'); }
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
    // Record both provider refusals and bridge failures before failing the check.
    const qq = {search:false,qrVisible:false,authenticatedPlayback:'requires user scan'};
    try {
      const search = await request('qq','/getSearchByKey?key=' + encodeURIComponent('海阔天空') + '&limit=20&page=1');
      const response = search.data;
      qq.searchResponse = {code:response?.code,diagnostic:response?.diagnostic,file:response?.file,status:response?.status,outerCode:response?.body?.code,requestCode:response?.body?.request?.code};
      const songs = response?.body?.request?.data?.body?.song?.list;
      qq.search = Array.isArray(songs) && songs.length > 0 && Boolean(songs[0].mid || songs[0].songmid);
      const qqButton = [...document.querySelectorAll('button')].find(button => /QQ音乐/.test(button.textContent) && /Connect|连接/.test(button.textContent));
      if (!qqButton || qqButton.disabled) throw new Error('QQ connection button unavailable');
      qqButton.click();
      for (let attempt = 0; attempt < 90; attempt++) {
        const image = document.querySelector('[role="dialog"] img[alt="QR Code"]');
        if (image?.complete && image.naturalWidth > 100 && image.src.startsWith('data:image/')) { qq.qrVisible = true; break; }
        await delay(1000);
      }
      qq.dialogText = document.querySelector('[role="dialog"]')?.textContent?.slice(0,400);
    } catch (error) { qq.error = error.message; }
    return {embeddedQr:true, network, back:true, media, qq};
  })()`}}));
  const inspected = await result;
  native.close();
  if (inspected.result?.exceptionDetails) throw new Error(JSON.stringify(inspected.result.exceptionDetails));
  writeFileSync('artifacts/embedded-music.json', JSON.stringify(inspected.result.result.value, null, 2));
  if (Object.values(inspected.result.result.value.media || {}).some(value => !value.playing || !value.seek)) throw new Error('Provider audio playback/seek did not pass');
  console.log('Embedded music:', inspected.result.result.value);
  if (!inspected.result.result.value.qq?.search || !inspected.result.result.value.qq?.qrVisible) throw new Error('QQ search/QR verification failed');
}

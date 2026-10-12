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
  if (!dom.children || dom.text.trim().length < 50) throw new Error('Folia UI did not render');
}

if (dom.width !== dom.screenWidth || dom.height !== dom.screenHeight) throw new Error('Emulator system bars are not hidden');

if (webViewMajor >= 95) {
  const native = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { native.addEventListener('open', resolve, {once:true}); native.addEventListener('error', reject, {once:true}); });
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Embedded runtime check timed out')), 120000);
    native.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id === 2) { clearTimeout(timer); resolve(data); }
    });
  });
  native.send(JSON.stringify({ id:2, method:'Runtime.evaluate', params:{awaitPromise:true,returnByValue:true,expression:`(async () => {
    const request = (provider,endpoint) => window.Capacitor.nativePromise('EmbeddedMusic','request',{provider,endpoint});
    const generated = await request('netease','/login/qr/create?key=integration-test&qrimg=true');
    if (!generated.data?.data?.qrimg?.startsWith('data:image/png;base64,')) throw new Error('Embedded QR generation failed');
    const network = {};
    for (const provider of ['netease','kugou']) {
      try {
        const result = await request(provider,'/login/qr/key');
        network[provider] = {key:Boolean(result.data?.data?.unikey || result.data?.data?.qrcode), code:result.data?.code, diagnostic:result.data?.diagnostic, message: typeof result.data?.msg === 'string' ? result.data.msg.replace(/https?:[^ ]+/g,'[host]').slice(0,160) : undefined};
      } catch { network[provider] = false; }
    }
    return {embeddedQr:true, network};
  })()`}}));
  const inspected = await result;
  native.close();
  if (inspected.result?.exceptionDetails) throw new Error(JSON.stringify(inspected.result.exceptionDetails));
  writeFileSync('artifacts/embedded-music.json', JSON.stringify(inspected.result.result.value, null, 2));
  console.log('Embedded music:', inspected.result.result.value);
}

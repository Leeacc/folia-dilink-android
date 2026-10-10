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
  expression: 'JSON.stringify({text:document.body.innerText,children:(document.getElementById("root") ? document.getElementById("root").children.length : 0),width:innerWidth,height:innerHeight,userAgent:navigator.userAgent})',
  returnByValue: true,
}}));
const message = await response;
ws.close();
if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails));
const dom = JSON.parse(message.result.result.value);
writeFileSync('artifacts/webview.json', JSON.stringify(dom, null, 2));
console.log(dom);
if (dom.width <= dom.height) throw new Error('Expected landscape WebView');
if (process.env.EXPECT_LEGACY === 'true') {
  if (!dom.text.includes('Folia') || !dom.text.includes('WebView')) throw new Error('Missing compatibility message');
} else {
  if (!dom.children || dom.text.trim().length < 50) throw new Error('Folia UI did not render');
}

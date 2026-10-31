const fs=require('node:fs');
const {chromium}=require(process.env.FOLIA_LEGACY_PLAYWRIGHT || '@playwright/test');

// Isolate old Linux software-driver behavior from the application's Android audio checks.
const deadline=setTimeout(()=>{console.error('Nebbia driver diagnostic exceeded 150 seconds');process.exit(1);},150000);
(async()=>{
 const mesa=process.env.FOLIA_GPU_BACKEND==='mesa';
 const browser=await chromium.launch({headless:!mesa,executablePath:process.env.FOLIA_CHROMIUM_EXECUTABLE,
  args:mesa?['--no-sandbox','--use-gl=desktop','--ignore-gpu-blocklist']:['--no-sandbox','--use-gl=swiftshader']});
 const page=await browser.newPage({viewport:{width:480,height:270}});const logs=[];
 page.on('console',m=>{if(m.text().startsWith('[Nebbia]')){logs.push(m.text());console.log(m.text());}});
 page.on('pageerror',e=>{logs.push(e.message);console.error(e.message);});
 try{
  await page.goto('http://127.0.0.1:4191/dev-probe.html?probe=visualizerMemory&vis=nebbia&freeze=1&lines=24');
  await page.waitForFunction(()=>document.querySelector('[data-probe-mode="nebbia"] canvas')&&!document.querySelector('[data-picture-arriving]'),undefined,{timeout:120000});
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  fs.mkdirSync('artifacts/gpu-diagnostic',{recursive:true});
  await page.screenshot({path:'artifacts/gpu-diagnostic/nebbia.png'});
  fs.writeFileSync('artifacts/gpu-diagnostic/report.json',JSON.stringify({browser:browser.version(),mesa,renderer,logs},null,2));
  console.log(JSON.stringify(renderer));
 }finally{await browser.close();clearTimeout(deadline);}
})().catch(e=>{console.error(e);process.exit(1);});

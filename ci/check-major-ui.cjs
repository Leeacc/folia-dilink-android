const fs = require('node:fs');
const { chromium } = require(process.env.FOLIA_LEGACY_PLAYWRIGHT || '@playwright/test');

// The production build and synthetic upstream probes have different roles; neither substitutes for native audio checks.
const modes = ['classic','cadenza','partita','fume','cappella','tilt','claddagh','monet','diorama','pendolo','lumiere','sonnet','still','tempera'];
const out = process.env.FOLIA_UI_OUTPUT || 'artifacts/major-ui';
const deadline = setTimeout(() => process.exit(1), 600000);
(async () => {
    fs.mkdirSync(out, {recursive: true});
    fs.mkdirSync('artifacts/chromium95', {recursive: true});
    const browser = await chromium.launch({headless: true, executablePath: process.env.FOLIA_CHROMIUM_EXECUTABLE, args:['--no-sandbox','--use-gl=swiftshader']});
    const report = {browser: browser.version(), modes: [], scope: 'Compiled UI/probes, synthetic lyrics and spectrum. Native audio verified separately.'};
    if (process.env.FOLIA_REQUIRE_CHROMIUM95 && !report.browser.startsWith('95.')) throw new Error('Expected actual Chromium 95');
    const base = process.env.FOLIA_UI_BASE || 'http://127.0.0.1:4191';
    try {
        await require('./check-car-toast.cjs')(browser, base);
        let page = await browser.newPage({viewport:{width:1280,height:720},locale:'en-US'});
        await page.addInitScript(() => {
            localStorage.setItem('folia_app_language','en');
            localStorage.setItem('library_suite','bravais');
            localStorage.setItem('library_suite_prompt_seen','true');
            localStorage.setItem('playback_entry_view_chosen','true');
            localStorage.setItem('folia_last_seen_ponder_onboarding_version','0.7.20');
        });
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
        await page.waitForSelector('[data-library-stage="bravais"]',{timeout:60000});
        await page.waitForTimeout(1500);
        await page.screenshot({path:out+'/bravais-home.png'});
        if(errors.length)throw new Error(errors.join(';'));
        await require('./check-visualizer-settings.cjs')(page);
        await require('./check-wall-tools.cjs')(page);
        await page.close();
        page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true});
        await page.goto(`${base}/dev-probe.html?probe=bravaisKinds`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__bravaisKindsProbe?.ready(),{timeout:60000});
        await page.waitForTimeout(1000);
        const before=await page.locator('[data-bravais-half="left"]').evaluate(e=>getComputedStyle(e).transform);
        const touch=await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:350,y:360}]});
        for(let step=1;step<=8;step++){
            await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:350-step*20,y:360}]});
            await page.waitForTimeout(30);
        }
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForTimeout(500);
        const after=await page.locator('[data-bravais-half="left"]').evaluate(e=>getComputedStyle(e).transform);
        report.bravais={tiles:await page.locator('[data-library-card]').count(),touchPan:before!==after};
        if(!report.bravais.tiles || !report.bravais.touchPan)throw new Error('Bravais touch navigation failed');
        await page.screenshot({path:out+'/bravais-tiles.png'});
        await page.setViewportSize({width:800,height:600});await page.waitForTimeout(500);
        await page.screenshot({path:out+'/bravais-split.png'});
        await page.close();
        for (const mode of modes) {
            page=await browser.newPage({viewport:{width:1280,height:720}});
            const errors=[];page.on('pageerror',e=>errors.push(e.message));
            await page.goto(`${base}/dev-probe.html?probe=visualizerMemory&vis=${mode}&lines=24&speed=2&start=3`,{waitUntil:'domcontentloaded'});
            await page.waitForSelector(`[data-probe-mode="${mode}"]`,{timeout:60000});
            const pixi = ['lumiere','sonnet','tempera'].includes(mode)
                ? await require('./check-pixi-draw.cjs')(page) : null;
            if(!pixi) await page.waitForTimeout(2500);
            const sample=await page.evaluate(()=>({children:document.querySelector('[data-probe-mode]')?.children.length,canvases:document.querySelectorAll('canvas').length}));
            await page.screenshot({path:`${out}/${mode}.png`});
            report.modes.push({mode,...sample,pixi,errors});
            console.log(JSON.stringify(report.modes[report.modes.length-1]));
            if(errors.length || !sample.children)throw new Error(`${mode} failed: ${errors.join(';')}`);
            await page.close();
        }
    } finally {
        fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
        await browser.close();clearTimeout(deadline);
    }
})().catch(e=>{console.error(e);process.exit(1);});

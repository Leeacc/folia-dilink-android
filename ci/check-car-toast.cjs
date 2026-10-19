const fs = require('node:fs');

// Validate actual rendered components and their interactions in the compiled old-WebView build.
module.exports = async function checkCarToast(browser, base) {
    const out = process.env.FOLIA_CAR_TOAST_OUTPUT || 'artifacts/chromium95';
    fs.mkdirSync(out,{recursive:true});
    const page = await browser.newPage({viewport:{width:960,height:720},locale:'en-US'});
    const errors = [], checks = [];
    page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('folia_app_language','en'));
        await page.goto(`${base}/dev-probe.html?probe=carTrackToast`,{waitUntil:'domcontentloaded'});
        await page.waitForSelector('[data-probe-car-toast]',{timeout:60000});
        await page.evaluate(()=>{document.documentElement.dataset.runtime='capacitor-android';document.documentElement.dataset.carWindow='split';});
        const sample = () => page.evaluate(() => {
            const rect = el => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
            return {toast:rect(document.querySelector('[data-toast-card]')),bar:rect(document.querySelector('[data-ponder="player-bar"]'))};
        });
        for (const [width,height] of [[1920,1080],[1280,720],[1200,600],[960,720],[800,600],[680,420],[412,732]]) {
            await page.setViewportSize({width,height});
            for (const expanded of [false,true]) {
                if (expanded) await page.locator('[data-test-playing]').click();
                await page.waitForTimeout(650);
                const bounds = await sample(), a=bounds.toast,b=bounds.bar;
                const overlaps=a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
                if(overlaps||a.left<0||a.right>width+1||a.top<0||a.bottom>height+1) throw new Error('Track toast overlap/clipping '+JSON.stringify({width,height,expanded,...bounds}));
                if (Math.abs((a.left+a.right)/2-width/2)>1) throw new Error('Split track toast is not centred');
                checks.push({width,height,expanded,...bounds});
                if(expanded) await page.screenshot({path:`${out}/car-toast-${width}x${height}.png`});
                if(expanded) await page.locator('[data-test-playing]').click();
            }
        }
        await page.setViewportSize({width:680,height:420});
        const before=await sample();
        await page.locator('[data-test-offset]').click();await page.waitForTimeout(500);
        const after=await sample();
        if(Math.abs(before.toast.bottom-after.toast.bottom-32)>1 || Math.abs(before.bar.bottom-after.bar.bottom-32)>1) throw new Error('Shared baseline did not move toast and capsule together');
        await page.locator('[data-test-auto]').click();
        await page.waitForSelector('[data-toast-card]',{state:'hidden',timeout:6000});
        await page.locator('[data-test-next]').click();
        await page.waitForSelector('[data-toast-card]',{state:'visible',timeout:5000});
        if(!(await page.locator('[data-toast-card]').textContent()).includes('1'))throw new Error('Next track did not update/show the toast');
        await page.evaluate(()=>document.documentElement.dataset.carWindow='full');
        await page.waitForTimeout(400);
        const full = await sample();
        if (Math.abs(full.toast.left-24)>1 || await page.locator('.now-playing-toast').evaluate(e=>parseFloat(getComputedStyle(e).marginBottom))!==144) throw new Error('Narrow fullscreen toast layout changed');
        await page.evaluate(()=>delete document.documentElement.dataset.runtime);
        if(await page.locator('.now-playing-toast').evaluate(e=>parseFloat(getComputedStyle(e).marginBottom))!==0)throw new Error('Car-only clearance leaked to desktop');
        if(errors.length)throw new Error(errors.join(';'));
    } finally {
        fs.writeFileSync(`${out}/car-toast-layout.json`,JSON.stringify({checks,errors,scope:'Rendered UI only; synthetic tracks, real toast/capsule.'},null,2));
        await page.close();
    }
};

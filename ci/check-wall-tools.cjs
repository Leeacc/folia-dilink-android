const fs = require('node:fs');

// Real Bravais/Lattice tools, with the Android styling marker only; this does not simulate native media integration.
module.exports = async function checkWallTools(page, base = 'http://127.0.0.1:4173') {
    const output = process.env.FOLIA_WALL_TOOLS_OUTPUT || 'artifacts/chromium95';
    fs.mkdirSync(output, {recursive: true});
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    const checks = [];
    const panel = page.locator('.lattice-tools-panel');
    const click = async locator => {
        await locator.evaluate(element => element.scrollIntoView({block: 'nearest'}));
        await page.waitForTimeout(150);
        const box = await locator.boundingBox();
        if (!box) throw new Error('Missing tools control');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    try {
        await page.goto(base, {waitUntil: 'domcontentloaded'});
        await page.waitForSelector('.lattice-tools', {timeout: 60000});
        if (!(await page.title()).includes('Folia')) throw new Error('Unexpected page identity');
        await page.evaluate(() => document.documentElement.dataset.runtime = 'capacitor-android');
        await click(page.locator('.lattice-tools button').first());
        await page.waitForSelector('.lattice-tools-panel', {state: 'visible'});
        await page.waitForTimeout(350);
        for (const [width, height] of [[1920,1080],[960,720],[800,600],[412,732],[680,420]]) {
            await page.setViewportSize({width,height});
            console.log(`Checking car tools at ${width}x${height}`);
            await page.waitForTimeout(350);
            const geometry = await panel.evaluate(element => {
                element.scrollTop = 0;
                const bounds = element.getBoundingClientRect();
                const quick = [...element.querySelectorAll('.lattice-tools-quick-action')].map(button => ({
                    width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height,
                    text: button.querySelector('.lattice-tools-quick-label')?.textContent,
                }));
                return {left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,width:bounds.width,
                    clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,
                    padding:getComputedStyle(element).paddingLeft,
                    columns:getComputedStyle(element.querySelector('.lattice-tools-quick')).gridTemplateColumns.split(' ').length,quick};
            });
            if (geometry.left < 0 || geometry.top < 0 || geometry.right > width + 1 || geometry.bottom > height + 1
                || geometry.width < Math.min(360,width - 32) || geometry.columns !== 3 || parseFloat(geometry.padding) < 16
                || geometry.quick.some(button => button.width < 90 || button.height < 76 || !button.text)) {
                throw new Error('Car tools geometry: '+JSON.stringify({width,height,...geometry}));
            }
            const tint = panel.locator('[role="menuitemcheckbox"]').first();
            const before = await tint.getAttribute('aria-checked');
            await click(tint);
            await page.waitForFunction(value => document.querySelector('.lattice-tools-panel [role="menuitemcheckbox"]')?.getAttribute('aria-checked') !== value, before, {timeout:5000});
            if (await tint.getAttribute('aria-checked') === before) throw new Error('Tint toggle failed');
            await click(tint);
            await page.waitForFunction(value => document.querySelector('.lattice-tools-panel [role="menuitemcheckbox"]')?.getAttribute('aria-checked') === value, before, {timeout:5000});
            await panel.evaluate(element => element.scrollTop = 0);
            await page.screenshot({path:`${output}/wall-tools-${width}x${height}.png`});
            await click(panel.locator('.lattice-tools-help-trigger'));
            await page.waitForFunction(() => document.querySelector('.lattice-tools-help-trigger')?.getAttribute('aria-expanded') === 'true', null, {timeout:5000});
            await page.waitForTimeout(220);
            const help = panel.locator('.lattice-tools-help');
            if (!(await help.isVisible())) throw new Error('Help could not be reached');
            await panel.evaluate(element => element.scrollTop = element.scrollHeight);
            await page.screenshot({path:`${output}/wall-tools-${width}x${height}-help.png`});
            await click(panel.locator('.lattice-tools-help-trigger'));
            await page.waitForSelector('.lattice-tools-help', {state:'hidden',timeout:5000});
            const slider = panel.locator('input[type="range"]');
            await slider.evaluate(element => element.scrollIntoView({block:'nearest'}));
            await page.waitForTimeout(150);
            const box = await slider.boundingBox();
            const previous = await slider.inputValue();
            await page.mouse.click(box.x + box.width * (Number(previous) > 0.5 ? 0.25 : 0.75), box.y + box.height / 2);
            await page.waitForFunction(value => document.querySelector('.lattice-tools-panel input[type="range"]')?.value !== value, previous, {timeout:5000});
            if (await slider.inputValue() === previous) throw new Error('Volume slider did not respond');
            checks.push({viewport:{width,height},...geometry,interaction:true});
        }
        if (errors.length || await page.locator('vite-error-overlay').count()) throw new Error(errors.join(';') || 'Framework error overlay');
    } finally {
        page.removeListener('pageerror', onError);
        fs.writeFileSync(`${output}/wall-tools-layout.json`,JSON.stringify({checks,errors,scope:'Rendered UI only; Browser plugin not available, Playwright used.'},null,2));
    }
};

const fs = require('node:fs');

// Exercise real settings navigation and the last reachable control at car pane sizes.
module.exports = async function checkVisualizerSettings(page) {
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('[data-library-stage]') || document.getElementById('root')?.children.length > 0);
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const state = {view: 'player', appHistoryIndex: 1};
    history.replaceState(state, '', '#player');
    dispatchEvent(new PopStateEvent('popstate', {state}));
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('s');
  await page.locator('[role="combobox"]').fill('visualizer settings');
  const command = page.locator('button:has-text("Visualizer settings")').first();
  await page.waitForSelector('button:has-text("Visualizer settings")', {state: 'visible'});
  await command.evaluate(button => button.click());
  await page.waitForSelector('[data-ponder="vis-playground"]', {state: 'visible'});
  // Freeze the preview clock using its actual control while inspecting scrolling and geometry.
  await page.locator('button[aria-label="Pause preview"]').evaluate(button => button.click());
  await page.waitForSelector('button[aria-label="Resume preview"]', {state: 'visible'});
  const checks = [];
  for (const [width, height] of [[800, 600], [960, 720], [680, 420], [412, 732], [1920, 1080]]) {
    console.log(`Checking visualizer settings at ${width}x${height}`);
    await page.setViewportSize({width, height});
    await page.waitForTimeout(500);
    const sections = [];
    const tabs = page.locator('[data-ponder="vis-playground"] [role="tablist"] button');
    if (await tabs.count() !== 5) throw new Error('Missing visualizer settings tabs');
    for (let index = 0; index < 5; index++) {
      if (!await tabs.nth(index).isVisible()) throw new Error('Settings tab is not visible');
      // Playwright 1.15's scroll-into-view protocol can stall after a reload on Chromium 95.
      // Actual pointer interactions are also covered by the modern-browser car UI check.
      await tabs.nth(index).evaluate(button => button.click());
      await page.waitForTimeout(100);
      const section = await page.locator('[data-ponder="vis-playground"] aside').evaluate(element => {
        const scroller = element.querySelector('.st-scroll');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
        const controls = [...element.querySelectorAll('button,input,select')].filter(e => e.getBoundingClientRect().height > 0);
        const last = controls[controls.length - 1];
        if (last) last.scrollIntoView({block: 'nearest'});
        const bounds = element.getBoundingClientRect();
        const control = last?.getBoundingClientRect();
        return {height: bounds.height, bottom: bounds.bottom, scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight, lastControl: control ? {top: control.top, bottom: control.bottom} : null};
      });
      if (section.height < 140
          || (section.lastControl && (section.lastControl.top < 0 || section.lastControl.bottom > height + 1))) {
        const layout = await page.locator('[data-ponder="vis-playground"]').evaluate(element => ({
          rows:getComputedStyle(element).gridTemplateRows, columns:getComputedStyle(element).gridTemplateColumns,
          bounds:element.getBoundingClientRect().toJSON(),
        }));
        await page.screenshot({path:`artifacts/chromium95/settings-failed-${width}x${height}.png`});
        throw new Error(`Settings cannot be reached: ${JSON.stringify({width, height, index, section, layout})}`);
      }
      sections.push(section);
    }
    checks.push({width, height, sections});
    await page.screenshot({path: `artifacts/chromium95/settings-${width}x${height}.png`});
  }
  fs.writeFileSync('artifacts/chromium95/settings-layout.json', JSON.stringify(checks, null, 2));
};

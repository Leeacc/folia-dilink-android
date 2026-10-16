const fs = require('node:fs');

// Exercise real settings navigation and the last reachable control at car pane sizes.
module.exports = async function checkVisualizerSettings(page) {
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('root')?.innerText.includes('Folia'));
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
  await page.waitForSelector('.vis-playground-layout', {state: 'visible'});
  const checks = [];
  for (const [width, height] of [[800, 600], [960, 720], [680, 420], [412, 732], [1920, 1080]]) {
    await page.setViewportSize({width, height});
    await page.waitForTimeout(500);
    const sections = [];
    const tabs = page.locator('.vis-playground-settings > div:first-child button');
    if (await tabs.count() !== 4) throw new Error('Missing visualizer settings tabs');
    for (let index = 0; index < 4; index++) {
      await tabs.nth(index).click();
      const section = await page.locator('.vis-playground-settings-scroll').evaluate(element => {
        element.scrollTop = element.scrollHeight;
        const controls = [...element.querySelectorAll('button,input,select')].filter(e => e.getBoundingClientRect().height > 0);
        const last = controls[controls.length - 1];
        if (last) last.scrollIntoView({block: 'nearest'});
        const bounds = element.getBoundingClientRect();
        const control = last?.getBoundingClientRect();
        return {height: bounds.height, bottom: bounds.bottom, scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight, lastControl: control ? {top: control.top, bottom: control.bottom} : null};
      });
      if (section.height < 140 || section.bottom > height + 1
          || (section.lastControl && (section.lastControl.top < 0 || section.lastControl.bottom > height + 1))) {
        throw new Error(`Settings cannot be reached: ${JSON.stringify({width, height, index, section})}`);
      }
      sections.push(section);
    }
    checks.push({width, height, sections});
    await page.screenshot({path: `artifacts/chromium95/settings-${width}x${height}.png`});
  }
  fs.writeFileSync('artifacts/chromium95/settings-layout.json', JSON.stringify(checks, null, 2));
};

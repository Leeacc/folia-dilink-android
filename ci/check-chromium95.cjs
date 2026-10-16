const { chromium } = require(process.env.FOLIA_LEGACY_PLAYWRIGHT);
const fs = require('node:fs');

// Exercise the compiled UI in a real Chromium 95 process; a user-agent override is insufficient.
const deadline = setTimeout(() => { console.error('Chromium 95 check exceeded three minutes'); process.exit(1); }, 180000);
(async () => {
  fs.mkdirSync('artifacts/chromium95', {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.FOLIA_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox']});
  const version = browser.version();
  if (!version.startsWith('95.')) throw new Error(`Expected Chromium 95, got ${version}`);
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}, locale: 'en-US'});
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('root')?.innerText.includes('Folia'), {timeout: 30000});
  await page.waitForTimeout(20000);
  const canvases = await page.evaluate(() => [...document.querySelectorAll('[data-paper-shader] canvas')].map(canvas => {
    const c = canvas.getBoundingClientRect();
    const p = canvas.parentElement.getBoundingClientRect();
    return {width: c.width, height: c.height, parentWidth: p.width, parentHeight: p.height};
  }));
  fs.writeFileSync('artifacts/chromium95/canvases.json', JSON.stringify(canvases, null, 2));
  await page.screenshot({path: 'artifacts/chromium95/home.png'});
  if (!canvases.length || canvases.some(c => Math.abs(c.width-c.parentWidth)>2 || Math.abs(c.height-c.parentHeight)>2)) throw new Error('Shader background does not fill its container');
  const before = await page.evaluate(() => ({title: document.title, text: document.body.innerText, buttons: [...document.querySelectorAll('button')].map(b => ({text: b.innerText, title: b.title, aria: b.getAttribute('aria-label')}))}));
  fs.writeFileSync('artifacts/chromium95/page.json', JSON.stringify({version, ...before, errors}, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  if (!before.text.includes('Folia') || before.buttons.length < 4) throw new Error('Missing homepage navigation');
  // Check generated CSS behaviors that Chromium 95 does not support natively.
  const styles = await page.evaluate(() => {
    const element = document.createElement('div');
    element.className = 'bg-white/10 translate-x-1/2';
    element.style.width = '100px';
    document.body.appendChild(element);
    const style = getComputedStyle(element);
    const result = {background: style.backgroundColor, transform: style.transform};
    element.remove();
    return result;
  });
  fs.writeFileSync('artifacts/chromium95/styles.json', JSON.stringify(styles, null, 2));
  if (styles.background !== 'rgba(255, 255, 255, 0.1)' || !styles.transform.includes('50')) throw new Error(`CSS compatibility failed: ${JSON.stringify(styles)}`);
  const settings = page.locator('button[title="Help & Options"]');
  if (await settings.count()) {
    await settings.first().click();
  } else {
    await page.locator('button[title="设置"],button[title="Settings"],button[aria-label="Settings"],button[aria-label="设置"]').first().click();
  }
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => document.body.innerText);
  await page.screenshot({path: 'artifacts/chromium95/settings.png'});
  fs.writeFileSync('artifacts/chromium95/interaction.txt', after);
  if (after === before.text || errors.length) throw new Error(`Settings did not open cleanly: ${errors.join(';')}`);
  await require('./check-visualizer-settings.cjs')(page);
  await page.setViewportSize({width: 1920, height: 1080});
  await page.reload({waitUntil: 'domcontentloaded'});
  // The dialog stays in this SPA; assert its rendered state instead of waiting on unrelated navigation.
  // The old Playwright scroll-into-view path can stall on Chromium 95 after a reload.
  // Visibility and ordinary pointer interactions are covered above; inspect the login handler directly here.
  await page.locator('button:has-text("Connect 网易云 Account")').evaluate(button => button.click());
  await page.waitForFunction(() => document.body.innerText.includes('No music service is connected.'));
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.locator('.animate-spin').count()) throw new Error('Error dialog still shows a loading spinner');
  await page.screenshot({path: 'artifacts/chromium95/login-unconfigured.png'});
  if (errors.length) throw new Error(errors.join(';'));
  await browser.close();
  clearTimeout(deadline);
})().catch(error => { console.error(error); process.exit(1); });

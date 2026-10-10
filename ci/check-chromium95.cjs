const { chromium } = require(process.env.FOLIA_LEGACY_PLAYWRIGHT);
const fs = require('node:fs');

// Exercise the compiled UI in a real Chromium 95 process; a user-agent override is insufficient.
(async () => {
  fs.mkdirSync('artifacts/chromium95', {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.FOLIA_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox']});
  const version = browser.version();
  if (!version.startsWith('95.')) throw new Error(`Expected Chromium 95, got ${version}`);
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}, locale: 'zh-CN'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('root')?.innerText.includes('Folia'), {timeout: 30000});
  await page.waitForTimeout(5000);
  await page.screenshot({path: 'artifacts/chromium95/home.png'});
  const before = await page.evaluate(() => ({title: document.title, text: document.body.innerText, buttons: [...document.querySelectorAll('button')].map(b => ({text: b.innerText, title: b.title, aria: b.getAttribute('aria-label')}))}));
  fs.writeFileSync('artifacts/chromium95/page.json', JSON.stringify({version, ...before, errors}, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  if (before.text.length < 50) throw new Error('Missing meaningful homepage');
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
  const settings = page.locator('button').filter({has: page.locator('svg.lucide-settings')});
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
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

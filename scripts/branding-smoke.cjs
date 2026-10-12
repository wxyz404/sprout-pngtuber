const { _electron } = require(process.env.SPROUT_PLAYWRIGHT || 'playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const workspace = path.resolve('../..');
  const legacy = process.env.SPROUT_LEGACY_FIXTURE || path.join(workspace, 'work', 'smoke-old-identity');
  const data = process.env.SPROUT_SMOKE_DATA_DIR || path.join(workspace, 'work', 'smoke-sprout-branding');
  await fs.cp(legacy, data, { recursive: true });
  const prefs = JSON.parse(await fs.readFile(path.join(data, 'preferences.json'), 'utf8'));
  const oldProfile = JSON.parse(await fs.readFile(path.join(data, 'profiles', prefs.active + '.json'), 'utf8'));
  const app = await _electron.launch({ executablePath: process.env.SPROUT_EXECUTABLE || require('electron'),
    args: process.env.SPROUT_EXECUTABLE ? ['--no-sandbox'] : ['.', '--no-sandbox'],
    env: { ...process.env, SPROUT_TEST_MODE: '1', SPROUT_DATA_DIR: data }, timeout: 30000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('heading', { name: 'Bring a little character.' }).waitFor();
    const config = await page.evaluate(() => window.desktop.config());
    if (config.serverWarning) await page.getByRole('button', { name: 'Dismiss error' }).click();
    assert.equal(await page.title(), 'Sprout · Avatar studio');
    assert.equal(await page.locator('.brand b').innerText(), 'sprout.');
    assert(!(await page.locator('body').innerText()).includes('Luma'));
    const { poses, layers, ...savedFields } = oldProfile;
    savedFields.settings = { cartoon: .65, mirrorAvatar: false, ...savedFields.settings };
    const { poses: currentPoses, layers: currentLayers, ...currentFields } = config.active;
    assert.deepEqual(currentFields, savedFields);
    assert.deepEqual(currentLayers.map(({ variants, ...geometry }) => geometry), layers.map(({ variants, ...geometry }) => geometry));
    for (const [key, value] of Object.entries(poses)) assert.equal(currentPoses[key], value);
    assert.equal(Object.keys(currentPoses).length, 36);
    assert.equal(new URL(config.outputUrl).searchParams.get('token'), prefs.token);
    const identity = await app.evaluate(({ app }) => ({ name: app.getName(), version: app.getVersion() }));
    assert.deepEqual(identity, { name: 'sprout-pngtuber', version: require('../package.json').version });
    await page.waitForFunction(() => document.querySelector('.stage canvas').getContext('2d').getImageData(512, 500, 1, 1).data[3] > 0);
    await page.screenshot({ path: path.join(workspace, 'outputs', 'Sprout-preview.png') });
    await page.setViewportSize({ width: 1100, height: 800 });
    assert(await page.locator('.brand').evaluate(el => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right));
    const next = app.waitForEvent('window');
    await app.evaluate(async ({ BrowserWindow }, url) => { const w = new BrowserWindow({ width: 1024, height: 1024, useContentSize: true, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } }); await w.loadURL(url); }, config.outputUrl);
    const overlay = await next; overlay.setDefaultTimeout(20000); await overlay.setViewportSize({ width: 1024, height: 1024 });
    assert.equal(await overlay.title(), 'Sprout output');
    await overlay.waitForFunction(() => document.querySelector('canvas').getContext('2d').getImageData(512, 500, 1, 1).data[3] > 0);
    assert.equal(await overlay.evaluate(() => document.querySelector('canvas').getContext('2d').getImageData(0, 0, 1, 1).data[3]), 0);
    assert.equal(await overlay.locator('video').count(), 0);
    await overlay.close();
    assert.deepEqual(errors, []);
    const result = { passed: true, version: identity.version, checks: ['Sprout app identity, window title, and visible branding', 'Existing Luma profile retains settings, geometry, and assignments while gaining stock artwork slots', 'Existing OBS access token is retained', 'Brand fits minimum window size', 'Sprout OBS title and transparent artwork output'], pageErrors: errors };
    await fs.writeFile(path.join(workspace, 'outputs', 'Sprout-branding-validation.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

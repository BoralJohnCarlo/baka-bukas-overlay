// Optional cross-engine checks. Install Playwright and its Chromium/WebKit browsers
// to run, or point PLAYWRIGHT_MODULE at an external Playwright installation.
const { chromium, webkit, devices, _android } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const checkHearts = require('./hearts-check.cjs');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    const deliver = () => {
      if (res.destroyed) return;
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start > end) { res.writeHead(416).end(); return; }
      if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
      res.setHeader('Content-Length', end - start + 1);
      res.writeHead(range ? 206 : 200);
      if (process.env.SLOW_MEDIA && path.extname(target) === '.mp3') {
        // Stream about 64 KB/s: playback must start before the clip fully downloads.
        let position = start;
        const timer = setInterval(() => {
          const next = Math.min(position + 4096, end + 1);
          res.write(data.subarray(position, next));
          position = next;
          if (position > end) { clearInterval(timer); res.end(); }
        }, 64);
        res.on('close', () => clearInterval(timer));
      } else res.end(data.subarray(start, end + 1));
    };
    // Delay the real HTTP response, rather than intercepting browser media requests.
    if (path.extname(target) === '.mp3') setTimeout(deliver, 350);
    else deliver();
  });
});

async function checkLayout(page, padding = '') {
  await page.evaluate(padding => { document.body.style.padding = padding; document.body.scrollTop = 0; }, padding);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const issues = await page.evaluate(() => {
    const issues = [];
    const controlsElement = document.querySelector('.controls');
    if (controlsElement.getBoundingClientRect().bottom > innerHeight) controlsElement.scrollIntoView({ block: 'end' });
    const bounds = stage.getBoundingClientRect();
    const controls = controlsElement.getBoundingClientRect();
    const overlaps = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
    if (document.body.scrollWidth > innerWidth) issues.push('horizontal overflow');
    if (controls.top < 0 || controls.left < 0 || controls.right > innerWidth || controls.bottom > innerHeight + 1) issues.push('inaccessible controls');
    if (overlaps(bounds, controls)) issues.push('controls overlap stage');
    if (playBtn.getBoundingClientRect().height < 44 || seek.getBoundingClientRect().height < 44) issues.push('small touch target');
    for (const time of [100, 100.18, 100.4, 100.9, 101.48, 102, 102.8, 103.08, 103.4, 103.5, 104.1, ...cues.map(cue => cue.time + 1.3)]) {
      renderAt(time);
      const text = lyric.getBoundingClientRect();
      if (Number(lyric.style.opacity) > 0.01 && (text.left < bounds.left - 2 || text.right > bounds.right + 2 || text.top < bounds.top - 2 || text.bottom > bounds.bottom + 2)) issues.push('lyric clipped at ' + time);
      if (Number(intro.style.opacity) <= 0.01) continue;
      const introBounds = intro.getBoundingClientRect();
      if (Number(lyric.style.opacity) > 0.01 && overlaps(introBounds, text)) issues.push('intro overlaps lyric at ' + time);
      for (const photo of photos) if (Number(photo.style.opacity) > 0.01 && overlaps(introBounds, photo.getBoundingClientRect())) issues.push('intro overlaps photo at ' + time);
    }
    return issues;
  });
  assert.deepEqual(issues, []);
}

async function activate(page, locator, options) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap(options);
  else await locator.click(options);
}

async function checkPlayback(page) {
  try {
    // WebKit may withhold metadata until a real user gesture starts loading.
    await page.evaluate(() => { audio.volume = 0; });
    const started = Date.now();
    await activate(page, page.locator('#playBtn'));
    await page.waitForFunction(() => !audio.paused && !startup && recordingTime() >= 99.95 && recordingTime() < 102);
    assert.ok(Date.now() - started < 6000, 'cold playback should start without downloading the entire clip');
    assert.deepEqual(await page.evaluate(() => window.mediaTrace.filter(event => event.type === 'seeking')), [], 'cold clip must not seek before playback');
    await activate(page, page.locator('#playBtn'));
    assert.equal(await page.evaluate(() => audio.paused && frame === null), true);
    assert.deepEqual(await page.evaluate(() => window.mediaTrace?.filter(event => !event.muted && !event.paused && event.time < 99.95) || []), []);
    assert.equal(await page.locator('#audioBtn').count(), 0);
    await activate(page, page.locator('#resetBtn'));
    // Windows WebKit can read back 100.01 after an MP3 seek to exactly 100.
    // Allow less than one MP3 frame here; unit tests still verify the request is 100.
    await page.waitForFunction(() => !audio.seeking && Math.abs(recordingTime() - 100) < 0.025);
  } catch (error) {
    console.error('Media diagnostics:', await page.evaluate(() => ({ time: recordingTime(), duration: audio.duration, ready: audio.readyState, disabled: playBtn.disabled, error: audio.error?.message, code: audio.error?.code, status: status.textContent, src: audio.src })));
    throw error;
  }
}

async function checkSlider(page) {
  const slider = page.locator('#seek');
  await slider.focus();
  await page.keyboard.press('Home');
  await page.waitForFunction(() => !audio.seeking && Math.abs(recordingTime() - 100) < 0.025);
  // WebKit MP3 readback can land within one audio frame of the requested zero.
  assert.ok(Math.abs(Number(await slider.inputValue())) < 0.025);
  const box = await slider.boundingBox();
  await activate(page, slider, { position: { x: box.width / 2, y: box.height / 2 } });
  await page.waitForFunction(() => !audio.seeking && recordingTime() > 128 && recordingTime() < 132);
  assert.equal(await page.evaluate(() => audio.paused), true);
  await activate(page, page.locator('#playBtn'));
  await page.waitForFunction(() => !audio.paused && !startup && recordingTime() > 128 && recordingTime() < 134);
  // Native ranges reserve half the 22px thumb at both ends of the track.
  const activeBox = await slider.boundingBox();
  await activate(page, slider, { position: { x: 11 + (activeBox.width - 22) * 0.75, y: activeBox.height / 2 } });
  await page.waitForFunction(() => !audio.paused && !startup && !audio.seeking && recordingTime() > 142 && recordingTime() < 148);
  await activate(page, page.locator('#playBtn'));
  await page.waitForFunction(() => audio.paused && frame === null);
  const progress = await slider.inputValue();
  await page.waitForTimeout(120);
  assert.equal(await slider.inputValue(), progress);
  await slider.focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => !audio.seeking && recordingTime() >= 159.95);
  assert.equal(await page.evaluate(() => Number(seek.value) > 59.9 && lyric.style.opacity === '0'), true);
  await activate(page, page.locator('#playBtn'));
  await page.waitForFunction(() => !audio.paused && !startup && recordingTime() >= 99.95 && recordingTime() < 102);
  await activate(page, page.locator('#resetBtn'));
  await page.waitForFunction(() => audio.paused && !audio.seeking && Math.abs(recordingTime() - 100) < 0.025);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
  try {
    if (process.argv.includes('--android')) {
      const serial = process.env.ANDROID_SERIAL || 'emulator-5580';
      const device = (await _android.devices()).find(device => device.serial() === serial);
      assert.ok(device, `Android emulator ${serial} must be online`);
      // Android emulator's 10.0.2.2 address reaches the Windows loopback server.
      const context = await device.launchBrowser();
      try {
        const page = await context.newPage();
        await page.goto(url.replace('127.0.0.1', '10.0.2.2'));
        await checkLayout(page);
        await checkPlayback(page);
        console.log('Android Chrome emulator: layout and touch playback passed');
      } finally { await context.close(); await device.close(); }
    } else {
      for (const [engine, names] of [[chromium, ['Desktop Chrome', 'Pixel 5', 'Galaxy S9+', 'Pixel 5 landscape']], [webkit, ['iPhone SE', 'iPhone 12', 'iPhone 13', 'iPhone 13 landscape', 'iPad Mini']]]) {
        const browser = await engine.launch({ headless: true });
        try {
          for (const name of names) {
            if (process.env.MOBILE_PROFILE && name !== process.env.MOBILE_PROFILE) continue;
            const context = await browser.newContext(devices[name]);
            try {
              const page = await context.newPage();
              const errors = [];
              page.on('pageerror', error => errors.push(error.message));
              await page.addInitScript(() => {
                window.mediaTrace = [];
                for (const type of ['seeking', 'playing', 'timeupdate']) document.addEventListener(type, event => {
                  if (event.target.id === 'audio') window.mediaTrace.push({ type, time: event.target.currentTime + (event.target.src.endsWith('/edit.mp3') ? 100 : 0), muted: event.target.muted, paused: event.target.paused });
                }, true);
              });
              await page.goto(url, { waitUntil: 'domcontentloaded' });
              await checkHearts(page);
              await checkPlayback(page);
              await page.waitForFunction(() => photoBanks.every(bank => bank.images.every(image => image.complete && image.naturalWidth > 0)));
              await checkLayout(page);
              try { await checkSlider(page); }
              catch (error) {
                console.error('Slider diagnostics:', name, await page.evaluate(() => ({ time: recordingTime(), paused: audio.paused, seeking: audio.seeking, startup, draggingSeek, resumeAfterScrub, status: status.textContent, slider: seek.value })));
                throw error;
              }
              for (const [width, height, padding] of [[320, 480, ''], [320, 400, ''], [480, 320, ''], [390, 844, '47px 0px 34px'], [844, 390, '0px 47px 21px'], [568, 260, '0px 44px 21px'], [360, 240, ''], [390, 320, '']]) {
                await page.setViewportSize({ width, height });
                await checkLayout(page, padding);
              }
              await page.emulateMedia({ reducedMotion: 'reduce' });
              await checkLayout(page);
              await checkHearts(page, true);
              assert.deepEqual(errors, []);
              console.log(`${engine.name()} / ${name}: cold startup, elapsed slider, pause/resume, layout, intro separation, rotation, simulated safe areas, reduced motion and heart balloon interactions passed`);
            } finally { await context.close(); }
          }
        } finally { await browser.close(); }
      }
    }
  } finally { server.closeAllConnections(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

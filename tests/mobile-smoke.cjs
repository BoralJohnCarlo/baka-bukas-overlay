// Serve the actual site over HTTP without Electron's preload bridge.
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
app.setPath('userData', path.join(process.env.OVERLAY_TEST_FOLDER, 'mobile-profile'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
      if (start > end) { res.writeHead(416).end(); return; }
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
      res.end(data.subarray(start, end + 1)); return;
    }
    res.setHeader('Content-Length', data.length);
    res.end(data);
  });
});

app.whenReady().then(async () => {
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    for (const [width, height] of [[280, 653], [320, 480], [320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [480, 320], [568, 320], [667, 375], [844, 390], [932, 430], [600, 960], [768, 1024], [820, 1180], [1024, 768], [1024, 1366], [1180, 820], [1366, 1024], [390, 600], [844, 320], [320, 400], [320, 240], [360, 240], [390, 320], [568, 240]]) {
      win.setContentSize(width, height);
      const result = await win.webContents.executeJavaScript(`(async () => {
        const check = (ok, message) => { if (!ok) throw new Error(message); };
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        check(!window.overlay && document.documentElement.classList.contains('browser-mode'), 'browser mode missing');
        check(getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)', 'browser background missing');
        document.body.scrollTop = 0;
        const controlsElement = document.querySelector('.controls');
        if (controlsElement.getBoundingClientRect().bottom > innerHeight) controlsElement.scrollIntoView({ block: 'end' });
        const controls = controlsElement.getBoundingClientRect();
        const bounds = stage.getBoundingClientRect();
        check(controls.top >= 0 && controls.left >= 0 && controls.right <= innerWidth && controls.bottom <= innerHeight + 1, 'controls inaccessible after scrolling');
        check(bounds.bottom <= controls.top + 1 || bounds.right <= controls.left + 1, 'controls overlap stage');
        check(playBtn.getBoundingClientRect().height >= 44, 'play button too small for touch');
        check(seek.getBoundingClientRect().height >= 44, 'seek control too small for touch');
        check(document.body.scrollWidth <= innerWidth, 'horizontal overflow');
        const overlaps = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
        for (const time of [100, 100.18, 100.4, 100.9, 101.48, 102, 102.8, 103.08, 103.4, 103.5, 104.1]) {
          renderAt(time);
          if (Number(intro.style.opacity) <= 0.01) continue;
          const introBounds = intro.getBoundingClientRect();
          if (Number(lyric.style.opacity) > 0.01) check(!overlaps(introBounds, lyric.getBoundingClientRect()), 'intro overlaps lyric at ' + time);
          photos.forEach(photo => {
            if (Number(photo.style.opacity) > 0.01) check(!overlaps(introBounds, photo.getBoundingClientRect()), 'intro overlaps photo at ' + time);
          });
        }
        for (const cue of cues) {
          renderAt(cue.time + 1);
          const text = lyric.getBoundingClientRect();
          check(text.left >= bounds.left - 2 && text.right <= bounds.right + 2 && text.top >= bounds.top && text.bottom <= bounds.bottom, 'lyric clipped: ' + cue.text);
          photos.forEach(photo => {
            if (Number(photo.style.opacity) < 0.9) return;
            const card = photo.getBoundingClientRect();
            check(card.left >= bounds.left - 2 && card.right <= bounds.right + 2 && card.top >= bounds.top - 2 && card.bottom <= bounds.bottom + 2, 'photo clipped: ' + cue.text);
          });
        }
        return { width: innerWidth, height: innerHeight };
      })()`);
      console.log('Mobile browser layout passed:', result);
    }
    await win.webContents.executeJavaScript(`(async () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const until = async predicate => { for (let i = 0; i < 400; i++) { if (predicate()) return; await wait(10); } throw new Error('Media timeout'); };
      await until(() => audio.readyState >= 2 && !audio.seeking);
      check(Math.abs(audio.currentTime - 100) < 0.001 && !playBtn.disabled, 'hosted MP3 did not initialize: ' + JSON.stringify({ time: audio.currentTime, disabled: playBtn.disabled, duration: audio.duration, readyState: audio.readyState, status: status.textContent }));
      check(!document.getElementById('audioBtn') && !document.getElementById('audioFile'), 'song picker must be removed');
      const bytes = new Uint8Array(44);
      const sourceBytes = new Uint8Array(${JSON.stringify([...fs.readFileSync(path.join(process.env.OVERLAY_TEST_FOLDER, 'silent.wav')).subarray(0, 44)])});
      bytes.set(sourceBytes);
      audio.src = URL.createObjectURL(new Blob([bytes, new Uint8Array(161 * 8000 * 2)], { type: 'audio/wav' }));
      audio.load();
      await until(() => audio.readyState >= 2 && !audio.seeking);
      audio.muted = true;
      playBtn.click(); await until(() => !audio.paused && audio.currentTime > 100);
      playBtn.click(); check(audio.paused, 'pause failed');
      document.getElementById('resetBtn').click();
      await until(() => !audio.seeking);
      check(audio.currentTime === 100, 'reset failed');

      // A shorter file must end naturally and replay within the selected segment.
      const shortData = new Uint8Array(44 + 120 * 8000 * 2);
      shortData.set(bytes);
      const header = new DataView(shortData.buffer);
      header.setUint32(4, shortData.length - 8, true);
      header.setUint32(40, shortData.length - 44, true);
      audio.src = URL.createObjectURL(new Blob([shortData], { type: 'audio/wav' }));
      audio.load();
      await until(() => audio.readyState >= 2 && !audio.seeking);
      check(audio.duration === 120, 'short recording duration changed');
      audio.currentTime = 119.9;
      await until(() => !audio.seeking);
      playBtn.click();
      await until(() => audio.ended && audio.paused && frame === null && lyric.style.opacity === '0');
      check(audio.currentTime === 120, 'short recording must stop at its natural end');
    })()`);
    console.log('Hosted audio and fixed-song controls passed.');
    // Exercise a real layout change and its ResizeObserver after natural EOF.
    win.setContentSize(844, 390);
    await win.webContents.executeJavaScript(`(async () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const until = async predicate => { for (let i = 0; i < 400; i++) { if (predicate()) return; await wait(10); } throw new Error('Replay timeout'); };
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      check(audio.ended && audio.currentTime === 120, 'resize changed the media clock');
      check(lyric.style.opacity === '0' && photos.every(photo => photo.style.opacity === '0'), 'resize restored finished visuals');
      playBtn.click();
      await until(() => !audio.paused && !audio.seeking);
      check(audio.currentTime >= 100 && audio.currentTime < 101, 'short recording replay rewound to zero');
      playBtn.click();
      check(audio.paused && frame === null, 'short recording replay did not pause');
      audio.currentTime = 119.9;
      await until(() => !audio.seeking);
      playBtn.click();
      await until(() => audio.ended && lyric.style.opacity === '0');
      seek.value = '13.25';
      seek.dispatchEvent(new Event('input'));
      await until(() => !audio.seeking);
      check(!audio.ended && lyric.style.opacity === '1', 'seeking back did not restore visuals');
      document.getElementById('resetBtn').click();
      await until(() => !audio.seeking);
      check(audio.currentTime === 100 && intro.style.opacity === '0.85', 'short recording reset failed');
    })()`);
    console.log('Short-recording end, rotation, replay, seek and reset checks passed.');
    server.close(); app.exit(0);
  } catch (error) {
    console.error(error); server.close(); app.exit(1);
  }
});

const { app, BrowserWindow, globalShortcut } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const folder = process.env.OVERLAY_TEST_FOLDER;
app.setPath('userData', path.join(folder, 'profile'));
const errors = [];
app.on('browser-window-created', (_, win) => {
  win.hide();
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', (_, level, message) => { if (level >= 3) errors.push(message); });
  win.webContents.on('render-process-gone', (_, details) => errors.push(JSON.stringify(details)));
  win.webContents.once('did-finish-load', async () => {
    try {
      assert.equal(win.isDestroyed(), false);
      const result = await win.webContents.executeJavaScript(`(async () => {
        const check = (value, message) => { if (!value) throw new Error(message); };
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async predicate => {
          for (let i = 0; i < 300; i++) { if (predicate()) return; await wait(10); }
          throw new Error('Timed out waiting for playback state');
        };
        const pose = () => JSON.stringify([lyric.style.cssText, photos.map(p => p.style.cssText), units.map(u => u.style.cssText), photoBanks.map(b => b.images.map(image => image.style.cssText))]);
        check(window.overlay.desktop === true, 'preload bridge unavailable');
        check(getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)', 'body must be transparent');
        check(getComputedStyle(document.getElementById('stage')).backgroundColor === 'rgba(0, 0, 0, 0)', 'stage must be transparent');
        check(photoBanks.length === 2 && photoBanks.every(b => b.images.length === 5), 'expected five images per person');
        await until(() => photoBanks.every(b => b.images.every(image => image.complete && image.naturalWidth > 0)));
        audio.muted = true;
        const configuredRecording = audio.getAttribute('src');
        if (configuredRecording) {
          await until(() => audio.readyState >= 2 && !audio.seeking);
          check(audio.currentTime === 100 && !playBtn.disabled, 'local MP3 must load automatically at 100');
          check(audio.duration > END_AT, 'local recording must cover the selected segment');
          for (let index = 0; index < cues.length; index++) {
            audio.currentTime = cues[index].time + 1.4;
            await until(() => !audio.seeking);
            photoSequence[index].forEach((number, card) => {
              if (number === null) return;
              const bank = photoBanks[card];
              check(bank.images[number - 1].style.opacity === '1', 'wrong photo at cue ' + index + ', card ' + card);
              check(bank.number.textContent === String(number).padStart(2, '0'), 'wrong photo number');
              check(bank.images.every((image, i) => i === number - 1 || image.style.opacity === '0'), 'old photo remained visible');
            });
          }
          for (const cue of cues) {
            audio.currentTime = cue.time - 0.06;
            await until(() => !audio.seeking);
            await audio.play();
            await until(() => audio.currentTime >= cue.time + 0.04);
            // The media clock can advance between animation frames.
            await new Promise(resolve => requestAnimationFrame(resolve));
            check(lyric.getAttribute('aria-label') === cue.text, 'MP3 playback missed cue at ' + cue.time + ': ' + JSON.stringify({ time: audio.currentTime, cue: lastCue, text: lyric.getAttribute('aria-label'), frame, paused: audio.paused }));
            audio.pause();
            await until(() => frame === null);
          }
        }
        audio.src = ${JSON.stringify(pathToFileURL(path.join(folder, 'silent.wav')).href)};
        audio.load();
        await until(() => audio.readyState >= 2 && !audio.seeking);
        check(audio.currentTime === 100, 'recording must initialize at exactly 100 seconds');
        for (const cue of cues) {
          audio.currentTime = cue.time;
          await until(() => !audio.seeking);
          check(lyric.getAttribute('aria-label') === cue.text, 'wrong lyric at ' + cue.time + ', media clock ' + audio.currentTime + ', cue index ' + lastCue);
          check(units.every(u => Number(u.style.opacity) < 0.01), 'fade did not start transparent at ' + cue.time);
          audio.currentTime = cue.time + 0.5;
          await until(() => !audio.seeking);
          check(units.every(u => Number(u.style.opacity) === 1), 'fade did not finish at ' + cue.time);
        }
        for (let i = 0; i < 3; i++) {
          playBtn.click();
          await until(() => !audio.paused && frame !== null);
          await wait(100);
          playBtn.click();
          await until(() => audio.paused && frame === null);
          const frozen = pose(), time = audio.currentTime;
          await wait(150);
          check(pose() === frozen && audio.currentTime === time, 'paused motion must freeze');
        }
        audio.currentTime = 113.25;
        await until(() => !audio.seeking);
        const expected = pose();
        for (const time of [149.5, 104.1, 131.7, 113.25]) {
          audio.currentTime = time; await until(() => !audio.seeking);
        }
        check(pose() === expected, 'seeking introduced drift');
        document.getElementById('resetBtn').click();
        await until(() => !audio.seeking);
        check(audio.currentTime === 100 && audio.paused, 'reset must return to 100');
        playBtn.click(); await until(() => !audio.paused);
        check(audio.currentTime >= 100 && audio.currentTime < 100.2, 'replay started outside selected segment');
        audio.currentTime = 159.85;
        await until(() => audio.paused && frame === null);
        check(lyric.style.opacity === '0' && photos.every(p => p.style.opacity === '0'), 'outro must clear the stage');
        check(document.getAnimations().length === 0, 'independent browser animations found');
        playBtn.click(); await until(() => !audio.paused);
        check(audio.currentTime >= 100 && audio.currentTime < 100.2, 'segment replay must restart at 100');
        document.getElementById('resetBtn').click();
        await until(() => !audio.seeking);
        audio.currentTime = 132.5;
        await until(() => !audio.seeking);
        check(audio.playbackRate === 1 && audio.duration === 161, 'test recording speed or duration changed');
        return { cueCount: cues.length, start: START_AT, end: END_AT, paused: audio.paused, testedLocalMP3: Boolean(configuredRecording), loadedPhotos: photoBanks.reduce((sum, bank) => sum + bank.images.length, 0) };
      })()`);
      assert.deepEqual(errors, []);
      assert.ok(globalShortcut.isRegistered('CommandOrControl+Shift+Q'));
      assert.ok(globalShortcut.isRegistered('CommandOrControl+Shift+H'));
      const screenshot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(folder, 'preview.png'), screenshot.toPNG());
      console.log('Electron startup and real-media checks passed:', result);
      console.log('Preview:', path.join(folder, 'preview.png'));
      app.exit(0);
    } catch (err) {
      console.error(err);
      app.exit(1);
    }
  });
});
// Run the real application entry point, including preload and keyboard shortcuts.
require('../main.js');

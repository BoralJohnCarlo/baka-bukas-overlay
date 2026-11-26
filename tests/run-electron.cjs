const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'baka-bukas-test-'));
// Silent test recording only. The user's song is never loaded or modified.
const samples = 161 * 8000;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
fs.writeFileSync(path.join(folder, 'silent.wav'), wav);
const env = { ...process.env, OVERLAY_TEST_FOLDER: folder };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), ['--enable-logging=stderr', path.join(__dirname, process.argv[2] || 'electron-smoke.cjs')], { env, stdio: 'inherit', windowsHide: true });
child.on('error', error => console.error('Could not launch Electron:', error));
const watchdog = setTimeout(() => { child.kill(); process.exitCode = 1; }, 120000);
child.on('exit', code => {
  clearTimeout(watchdog);
  if (code !== 0) console.error('Electron smoke test exited with code:', code);
  // Remove only files owned by this test. No recursive directory deletion.
  for (const file of ['silent.wav']) fs.rmSync(path.join(folder, file), { force: true });
  process.exitCode = code ?? 1;
});

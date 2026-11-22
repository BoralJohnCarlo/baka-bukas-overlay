const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const originalTimeline = require('./fixtures/original-timeline.json');
const alignment = require('./fixtures/aligned-timeline.json');

class Element {
  constructor() {
    this.style = { setProperty(key, value) { this[key] = value; } }; this.dataset = {}; this.attributes = {}; this.children = [];
    this.listeners = new Map(); this.textContent = ''; this.disabled = false;
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    list.push(fn); this.listeners.set(type, list);
  }
  async emit(type) { for (const fn of this.listeners.get(type) || []) await fn(); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  querySelector(selector) {
    this.descendants ??= {};
    return this.descendants[selector] ??= new Element();
  }
}

function setup({ browser = false } = {}) {
  const ids = Object.fromEntries(['audio', 'lyric', 'playBtn', 'resetBtn', 'seek', 'timeLabel', 'status', 'intro', 'stage'].map(id => [id, new Element()]));
  ids.stage.clientWidth = 1440;
  ids.stage.clientHeight = 900;
  const audio = ids.audio;
  Object.assign(audio, { src: 'file:///original.mp3', currentTime: 0, duration: 200, readyState: 0, seeking: false, paused: true, ended: false, muted: false, playbackRate: 1 });
  let currentTime = 0;
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: value => { currentTime = value; if (value < audio.duration) audio.ended = false; }
  });
  audio.play = async () => { if (audio.ended) audio.currentTime = 0; audio.paused = false; await audio.emit('play'); };
  audio.pause = () => { if (!audio.paused) { audio.paused = true; void audio.emit('pause'); } };
  audio.load = () => { audio.readyState = 0; };
  const photos = [new Element(), new Element()];
  const frames = new Map();
  let nextFrame = 0;
  const windowEvents = new Element();
  const documentEvents = new Element();
  const motionPreference = Object.assign(new Element(), { matches: false });
  let stageResize;
  const context = vm.createContext({
    document: {
      addEventListener: (...args) => documentEvents.addEventListener(...args),
      documentElement: new Element(),
      getElementById: id => ids[id], querySelectorAll: () => photos,
      createElement: () => new Element(), createTextNode: text => Object.assign(new Element(), { textContent: text })
    },
    window: { innerWidth: 1440, matchMedia: () => motionPreference, addEventListener: (...args) => windowEvents.addEventListener(...args), overlay: browser ? undefined : { desktop: true } },
    ResizeObserver: class { constructor(callback) { stageResize = callback; } observe() {} },
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  for (const file of ['timeline.js', 'motion.js', 'photo-sequence.js', 'renderer.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  const run = code => vm.runInContext(code, context);
  const step = time => {
    audio.currentTime = time;
    const pending = [...frames.values()]; frames.clear();
    for (const fn of pending) fn();
  };
  const load = async () => {
    audio.readyState = 4; await audio.emit('loadedmetadata');
  };
  const snapshot = () => JSON.stringify([ids.lyric.style, photos.map(p => p.style), run('units.map(u => u.style)'), run('photoBanks.map(b => b.images.map(image => image.style))')]);
  return { ids, audio, photos, frames, run, step, load, snapshot, windowEvents, documentEvents, motionPreference, resizeStage: () => stageResize() };
}

test('short recordings replay from 1:40 rather than the browser rewind to zero', async () => {
  for (const duration of [100.5, 120, 159.5]) {
    const s = setup();
    await s.load();
    s.audio.duration = duration;
    s.audio.currentTime = duration;
    s.audio.ended = true;
    await s.audio.emit('ended');
    await s.ids.playBtn.emit('click');
    assert.equal(s.audio.currentTime, 100);
    assert.equal(s.audio.ended, false);
    assert.equal(s.audio.paused, false);
    assert.equal(s.frames.size, 1);
  }
});

test('short-recording end stays cleared on redraw, hide and pause; seeking and reset restore visuals', async () => {
  for (const browser of [false, true]) {
    const s = setup({ browser });
    s.audio.src = 'test.wav';
    s.audio.readyState = 4;
    s.audio.duration = 120;
    await s.audio.emit('loadedmetadata');
    s.audio.currentTime = 120;
    s.audio.ended = true;
    await s.audio.emit('ended');
    const assertCleared = () => {
      assert.equal(s.ids.lyric.style.opacity, '0');
      assert.equal(s.ids.intro.style.opacity, '0');
      assert.ok(s.photos.every(photo => photo.style.opacity === '0'));
      assert.equal(s.audio.currentTime, 120);
      assert.equal(s.frames.size, 0);
    };
    assertCleared();
    await s.windowEvents.emit('resize'); assertCleared();
    s.resizeStage(); assertCleared();
    s.motionPreference.matches = true;
    await s.motionPreference.emit('change'); assertCleared();
    await s.windowEvents.emit('pagehide'); assertCleared();
    s.run('document.hidden = true');
    await s.documentEvents.emit('visibilitychange'); assertCleared();
    await s.audio.emit('pause'); assertCleared();
    await s.audio.emit('timeupdate'); assertCleared();
    s.ids.seek.value = '13.25';
    await s.ids.seek.emit('input');
    assert.equal(s.audio.ended, false);
    assert.equal(s.ids.lyric.style.opacity, '1');
    s.audio.currentTime = 120;
    s.audio.ended = true;
    await s.audio.emit('ended');
    await s.ids.resetBtn.emit('click');
    assert.equal(s.audio.currentTime, 100);
    assert.equal(s.ids.intro.style.opacity, '0.85');
  }
});

test('a browser tap starts loading even before metadata is available', async () => {
  const s = setup({ browser: true });
  s.audio.src = 'https://example.test/song.mp3';
  assert.equal(s.ids.playBtn.disabled, false);
  let finishPlay;
  let called = false;
  s.audio.play = () => { called = true; return new Promise(resolve => { finishPlay = resolve; }); };
  const pendingClick = s.ids.playBtn.emit('click');
  assert.equal(called, true);
  s.audio.readyState = 4;
  await s.audio.emit('loadedmetadata');
  assert.equal(s.audio.currentTime, 100);
  assert.equal(s.audio.muted, true);
  await s.audio.emit('seeked');
  assert.equal(s.audio.muted, false);
  s.audio.paused = false;
  await s.audio.emit('play');
  finishPlay();
  await pendingClick;
  assert.equal(s.audio.paused, false);
  assert.equal(s.frames.size, 1);
});

test('mobile placement follows available stage space without changing audio timing', async () => {
  const s = setup();
  await s.load();
  s.ids.stage.clientWidth = 360;
  s.run('renderAt(130)');
  assert.equal(s.ids.lyric.style.width, '90%');
  assert.equal(s.ids.lyric.style.top, '72%');
  assert.deepEqual(s.photos.map(p => p.style.left), ['26%', '74%']);
  assert.equal(s.audio.currentTime, 100);
});

test('cold playback remains muted until the requested edit position is confirmed', async () => {
  const s = setup({ browser: true });
  let requested = 0;
  let actual = 0;
  Object.defineProperty(s.audio, 'currentTime', {
    get: () => actual,
    set: value => { requested = value; s.audio.seeking = true; },
    configurable: true
  });
  const pending = s.ids.playBtn.emit('click');
  assert.equal(s.audio.muted, true);
  assert.equal(actual, 0);
  s.audio.readyState = 4;
  await s.audio.emit('loadedmetadata');
  assert.equal(requested, 100);
  assert.equal(s.audio.muted, true);
  await pending;
  assert.equal(s.ids.seek.value, 0);
  assert.equal(s.ids.timeLabel.textContent, '0:00 / 1:00');
  actual = 100.01;
  s.audio.seeking = false;
  await s.audio.emit('seeked');
  assert.equal(s.audio.muted, false);
  assert.equal(s.audio.paused, false);
});

test('a refused edit seek stops playback instead of exposing the song opening', async () => {
  const s = setup({ browser: true });
  let actual = 0;
  Object.defineProperty(s.audio, 'currentTime', { get: () => actual, set() {}, configurable: true });
  await s.ids.playBtn.emit('click');
  assert.equal(s.audio.muted, true);
  s.audio.readyState = 4;
  for (let i = 0; i < 4; i++) await s.audio.emit('canplay');
  assert.equal(s.audio.paused, true);
  assert.equal(s.audio.muted, false);
  assert.equal(s.frames.size, 0);
  assert.match(s.ids.status.textContent, /retry/);
});

test('reset cancels a cold play request without leaving muted audio or resuming later', async () => {
  const s = setup({ browser: true });
  let finishPlay;
  s.audio.play = () => {
    s.audio.paused = false;
    return new Promise(resolve => { finishPlay = resolve; });
  };
  const pending = s.ids.playBtn.emit('click');
  assert.equal(s.audio.muted, true);
  await s.ids.resetBtn.emit('click');
  assert.equal(s.audio.paused, true);
  assert.equal(s.audio.muted, false);
  s.audio.readyState = 4;
  await s.audio.emit('loadedmetadata');
  finishPlay();
  await pending;
  assert.equal(s.audio.currentTime, 100);
  assert.equal(s.audio.paused, true);
  assert.equal(s.frames.size, 0);
  assert.equal(s.ids.playBtn.textContent, 'Play song');
});

test('elapsed progress follows the audio and reaches the real end of short files', async () => {
  const s = setup(); await s.load();
  s.audio.currentTime = 130;
  await s.audio.emit('timeupdate');
  assert.equal(s.ids.seek.value, 30);
  assert.equal(s.ids.seek.style['--progress'], '50%');
  assert.equal(s.ids.timeLabel.textContent, '0:30 / 1:00');
  s.audio.duration = 120;
  s.audio.currentTime = 120;
  s.audio.ended = true;
  await s.audio.emit('ended');
  assert.equal(s.ids.seek.max, '20');
  assert.equal(s.ids.seek.value, 20);
  assert.equal(s.ids.seek.style['--progress'], '100%');
  assert.equal(s.ids.timeLabel.textContent, '0:20 / 0:20');
});

test('dragging the seek thumb holds its position and resumes only if previously playing', async () => {
  const s = setup(); await s.load();
  await s.ids.playBtn.emit('click');
  s.step(110);
  await s.ids.seek.emit('pointerdown');
  assert.equal(s.audio.paused, true);
  assert.equal(s.frames.size, 0);
  s.ids.seek.value = '35';
  await s.ids.seek.emit('input');
  s.audio.currentTime = 110;
  await s.audio.emit('timeupdate');
  assert.equal(s.ids.seek.value, '35');
  assert.equal(s.ids.timeLabel.textContent, '0:35 / 1:00');
  s.audio.currentTime = 135;
  await s.audio.emit('seeked');
  await s.windowEvents.emit('pointerup');
  assert.equal(s.audio.paused, false);
  await s.ids.playBtn.emit('click');
  await s.ids.seek.emit('pointerdown');
  s.ids.seek.value = '20';
  await s.ids.seek.emit('input');
  await s.ids.seek.emit('change');
  assert.equal(s.audio.paused, true);
  assert.equal(s.audio.currentTime, 120);
});

test('hiding a browser tab during a scrub cancels automatic resume', async () => {
  const s = setup({ browser: true }); await s.load();
  await s.ids.playBtn.emit('click');
  await s.ids.seek.emit('pointerdown');
  s.run('document.hidden = true');
  await s.documentEvents.emit('visibilitychange');
  await s.windowEvents.emit('pointerup');
  assert.equal(s.audio.paused, true);
  assert.equal(s.frames.size, 0);
});

test('approved alignment: measured times, unchanged segment, original text/order/photos', () => {
  const { run } = setup();
  assert.equal(run('START_AT'), 100); assert.equal(run('END_AT'), 160);
  const actual = JSON.parse(run('JSON.stringify(cues)'));
  assert.deepEqual(actual.map(c => c.time), alignment.cues.map(c => c.time));
  assert.deepEqual(actual.map(({ text, photos }) => ({ text, photos })), originalTimeline.cues.map(({ text, photos }) => ({ text, photos })));
  assert.ok(actual.every((cue, i) => cue.time >= 100 && cue.time < 160 && (!i || cue.time > actual[i - 1].time)));
  assert.equal(run('Object.isFrozen(cues) && cues.every(c => Object.isFrozen(c) && Object.isFrozen(c.photos))'), true);
});

test('photo inventory covers every assignment, follows 1–5 per person, and matches the existing cards', () => {
  const { run } = setup();
  const library = JSON.parse(run('JSON.stringify(photoLibrary)'));
  const sequence = JSON.parse(run('JSON.stringify(photoSequence)'));
  const timeline = JSON.parse(run('JSON.stringify(cues)'));
  assert.equal(sequence.length, timeline.length);
  for (const [card, owner] of ['me', 'her'].entries()) {
    const files = fs.readdirSync(path.join(__dirname, '..', owner)).filter(name => /\.(jpg|jpeg|png|webp|avif)$/i.test(name));
    assert.equal(files.length, 5, `${owner} inventory changed; check the photo plan`);
    library[card].forEach(asset => assert.ok(fs.existsSync(path.join(__dirname, '..', asset.src)), `Missing ${asset.src}`));
    const used = sequence.map(pair => pair[card]).filter(number => number !== null);
    assert.deepEqual([...new Set(used)], [1, 2, 3, 4, 5]);
    assert.deepEqual(used, [...used].sort((a, b) => a - b));
  }
  sequence.forEach((pair, i) => {
    pair.forEach((number, card) => assert.equal(number !== null, timeline[i].photos.includes(card)));
  });
});

const recordingPath = path.join(__dirname, '..', alignment.sourceFile);
test('supplied MP3 remains byte-for-byte unchanged', { skip: !fs.existsSync(recordingPath) }, () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(recordingPath)).digest('hex');
  assert.equal(hash.toUpperCase(), alignment.sha256);
});

test('intro starts at 100 independently of the measured first lyric', () => {
  const { run, ids } = setup();
  run('renderAt(100)');
  assert.equal(run('lastCue'), -1);
  assert.equal(ids.lyric.style.opacity, '0');
  assert.equal(ids.intro.style.opacity, '0.85');
});

test('each cue replaces the lyric at its absolute boundary, with every unit visible', () => {
  const { run, ids } = setup();
  const times = run('cues.map(c => c.time)');
  times.forEach((time, i) => {
    run(`renderAt(${time - 0.001})`);
    assert.equal(run('lastCue'), i - 1);
    run(`renderAt(${time})`);
    assert.equal(run('lastCue'), i);
    assert.equal(ids.lyric.attributes['aria-label'], run(`cues[${i}].text`));
    assert.equal(run('units.every(u => Number(u.style.opacity) >= 0.78)'), true);
    assert.equal(ids.lyric.style.opacity, '1');
  });
  run('renderAt(160)'); assert.equal(ids.lyric.style.opacity, '0');
});

test('decimal MP3 seeks tolerate microsecond truncation without advancing millisecond-early cues', () => {
  const { run } = setup();
  alignment.cues.forEach((cue, i) => {
    assert.equal(run(`cueAt(${cue.time - 0.000002})`), i);
    assert.equal(run(`cueAt(${cue.time - 0.001})`), i - 1);
  });
  assert.equal(run('cueAt(159.999998)'), -1);
});

test('start at 100, repeated pause/resume freezes poses, single loop, reset and replay', async () => {
  const s = setup(); await s.load();
  assert.equal(s.audio.currentTime, 100);
  for (let i = 0; i < 5; i++) {
    await s.ids.playBtn.emit('click');
    assert.equal(s.frames.size, 1);
    s.step(113.25 + i);
    await s.ids.playBtn.emit('click');
    assert.equal(s.frames.size, 0);
    const pose = s.snapshot();
    await s.audio.emit('timeupdate');
    assert.equal(s.snapshot(), pose);
    assert.equal(s.audio.currentTime, 113.25 + i);
  }
  await s.ids.resetBtn.emit('click');
  assert.equal(s.audio.currentTime, 100); assert.equal(s.frames.size, 0);
  await s.ids.playBtn.emit('click'); assert.equal(s.audio.currentTime, 100);
  s.step(160.001);
  assert.equal(s.audio.paused, true); assert.equal(s.frames.size, 0);
  assert.equal(s.ids.lyric.style.opacity, '0');
  assert.ok(s.photos.every(p => p.style.opacity === '0'));
  await s.ids.playBtn.emit('click'); assert.equal(s.audio.currentTime, 100);
  assert.equal(s.audio.playbackRate, 1);
});

test('arbitrary forward/backward seeks reproduce exact poses with no cumulative drift', async () => {
  const s = setup(); await s.load();
  s.audio.currentTime = 143.45; await s.audio.emit('seeked');
  const expected = s.snapshot();
  for (const time of [155.8, 100, 131.03, 118.99, 159.9, 108.1, 143.45]) {
    s.audio.currentTime = time; await s.audio.emit('seeking'); await s.audio.emit('seeked');
    assert.equal(s.run('lastCue'), s.run(`cueAt(${time})`));
    assert.equal(s.frames.size, 0);
  }
  assert.equal(s.snapshot(), expected);
  await s.ids.playBtn.emit('click');
  for (let i = 0; i < 20; i++) await s.audio.emit('seeked');
  assert.equal(s.frames.size, 1);
  s.ids.seek.value = '25.5'; await s.ids.seek.emit('input');
  assert.equal(s.audio.currentTime, 125.5); assert.equal(s.run('lastCue'), 5);
});

test('metadata events do not add listeners; incomplete recordings stay disabled', async () => {
  const s = setup();
  const counts = () => [...s.audio.listeners].map(([type, list]) => [type, list.length]);
  const original = counts();
  for (let i = 0; i < 8; i++) await s.load();
  assert.deepEqual(counts(), original);
  s.audio.duration = 90; await s.audio.emit('loadedmetadata');
  assert.equal(s.ids.playBtn.disabled, true); assert.equal(s.ids.seek.disabled, true);
});

test('no independent stage animation clocks or queues', () => {
  for (const file of ['renderer.js', 'motion.js', 'timeline.js', 'photo-sequence.js']) {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(text, /setTimeout\s*\(|setInterval\s*\(|performance\.now\s*\(|\.animate\s*\(/);
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /@keyframes|\banimation\s*:|\btransition\s*:/);
});

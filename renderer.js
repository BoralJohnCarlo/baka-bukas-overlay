const audio = document.getElementById('audio');
const lyric = document.getElementById('lyric');
const photos = [...document.querySelectorAll('.polaroid')];
const playBtn = document.getElementById('playBtn');
const seek = document.getElementById('seek');
const timeLabel = document.getElementById('timeLabel');
const status = document.getElementById('status');
const intro = document.getElementById('intro');
const stage = document.getElementById('stage');
const memoryPrevious = document.getElementById('memoryPrevious');
const memoryCurrent = document.getElementById('memoryCurrent');
const desktopOverlay = window.overlay?.desktop === true;
if (desktopOverlay && audio.dataset.fullSrc) audio.src = audio.dataset.fullSrc;

// The browser clip begins at the edit; choreography keeps its original recording clock.
const recordingOffset = () => audio.src.endsWith('/edit.mp3') ? START_AT : 0;
const recordingTime = () => audio.currentTime + recordingOffset();
const seekRecording = time => { audio.currentTime = Math.max(0, time - recordingOffset()); };
document.documentElement.classList.toggle('browser-mode', !desktopOverlay);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const photoBanks = photos.map((photo, card) => {
  const mount = photo.querySelector('.photo');
  const images = photoLibrary[card].map((asset, i) => {
    const image = document.createElement('img');
    image.alt = '';
    image.draggable = false;
    image.loading = 'eager';
    image.decoding = 'async';
    image.dataset.number = String(i + 1);
    image.style.objectPosition = asset.position;
    image.style.opacity = '0';
    image.src = asset.src;
    mount.append(image);
    if (typeof image.decode === 'function') void image.decode().catch(() => {});
    return image;
  });
  return { images, caption: photo.querySelector('.handwriting'), number: photo.querySelector('.photo-number') };
});
let frame = null;
let lastCue = -1;
let units = [];
let playPending = false;
let playbackGeneration = 0;
let startup = null;
let draggingSeek = false;
let resumeAfterScrub = false;
let previewTime = null;

const formatTime = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
const segmentEnd = () => Number.isFinite(audio.duration) && audio.duration + recordingOffset() > START_AT ? Math.min(END_AT, audio.duration + recordingOffset()) : END_AT;

function showCue(index) {
  lyric.replaceChildren();
  units = [];
  if (index < 0) return;
  const direction = arrangements[index];
  lyric.dataset.composition = direction.name;
  lyric.dataset.treatment = direction.treatment;
  lyric.classList.toggle('emphasis', Boolean(direction.strong));
  lyric.setAttribute('aria-label', cues[index].text);
  for (const [wordIndex, word] of cues[index].text.split(' ').entries()) {
    const lineBreak = (index === 4 || index === 8) && wordIndex === 2;
    if (lineBreak) lyric.append(document.createElement('br'));
    else if (wordIndex) lyric.append(document.createTextNode(' '));
    const wrapper = document.createElement('span');
    wrapper.className = 'word';
    if (direction.accent.includes(wordIndex)) wrapper.className += ' accent-word';
    wrapper.setAttribute('aria-hidden', 'true');
    for (const part of direction.type === 'letters' ? [...word] : [word]) {
      const span = document.createElement('span');
      span.className = 'unit';
      span.textContent = part;
      wrapper.append(span);
      units.push(span);
    }
    lyric.append(wrapper);
  }
}

function renderAt(seconds) {
  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;
  const compact = stageWidth < 760 || stageHeight < 500;
  const shortStage = compact && stageHeight < 400;
  stage.classList.toggle('compact-stage', compact);
  stage.classList.toggle('short-stage', shortStage);
  const index = cueAt(seconds);
  if (index !== lastCue) {
    lastCue = index;
    showCue(index);
  }
  const duration = segmentEnd() - START_AT;
  const elapsed = Math.max(0, Math.min(duration, seconds - START_AT));
  if (!draggingSeek) seek.value = elapsed;
  seek.max = String(duration);
  seek.style.setProperty('--progress', `${elapsed / duration * 100}%`);
  timeLabel.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
  seek.setAttribute('aria-valuetext', `${formatTime(elapsed)} of ${formatTime(duration)}`);
  const introAge = seconds - START_AT;
  const backdropIndex = seconds >= END_AT ? cues.length - 1 : Math.max(0, index);
  const backdropCard = photoSequence[backdropIndex][1] !== null ? 1 : 0;
  const backdropNumber = photoSequence[backdropIndex][backdropCard] ?? 1;
  const backdropAsset = photoLibrary[backdropCard][backdropNumber - 1].src;
  // Reconstruct both layers from the cue clock so seeking is deterministic.
  const priorIndex = Math.max(0, backdropIndex - 1);
  const priorCard = photoSequence[priorIndex][1] !== null ? 1 : 0;
  const priorAsset = photoLibrary[priorCard][(photoSequence[priorIndex][priorCard] ?? 1) - 1].src;
  memoryPrevious.style.backgroundImage = `url("${priorAsset}")`;
  memoryCurrent.style.backgroundImage = `url("${backdropAsset}")`;
  memoryCurrent.style.opacity = String(reducedMotion.matches ? 1 : smooth((seconds - cues[backdropIndex].time) / 1.2));
  stage.style.setProperty('--memory-drift', `${reducedMotion.matches ? 0 : Math.sin((seconds - START_AT) * 0.12) * 2}%`);
  intro.style.opacity = String(introAge >= 0 && introAge < 3.5 ? (1 - smooth((introAge - 2) / 1.5)) * 0.85 : 0);
  if (index < 0) {
    lyric.style.opacity = '0';
    lyric.removeAttribute('aria-label');
    photos.forEach(photo => { photo.style.opacity = '0'; });
    return;
  }
  const direction = arrangements[index];

  const introLayout = shortStage ? 1 - smooth((introAge - 3.5) / 0.6) : 0;
  const cardWidth = `${Math.max(52, Math.min(224, stageWidth * (compact ? 0.36 : 0.16), stageHeight * (0.30 - 0.07 * introLayout)))}px`;
  const layout = sampleLayout(index, compact, introLayout);
  const [x, y, width] = layout.text;
  lyric.style.left = `${x}%`;
  lyric.style.top = `${y}%`;
  lyric.style.width = `${width}%`;
  lyric.style.textAlign = compact ? 'center' : direction.align;
  lyric.style.setProperty('--lyric-size', `${Math.max(18, Math.min(direction.strong ? 66 : 52, stageWidth * (compact ? 0.068 : 0.047), stageHeight * (compact ? 0.105 : 0.12)))}px`);
  lyric.style.opacity = String(1 - smooth((seconds - (END_AT - 2)) / 2));
  units.forEach((unit, i) => {
    const pose = sampleText(seconds, index, i, units.length, reducedMotion.matches);
    unit.style.opacity = String(pose.opacity);
    unit.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scale(${pose.scale})`;
    unit.style.clipPath = `inset(0 0 ${pose.mask}% 0)`;
  });
  photos.forEach((photo, card) => {
    const content = samplePhotoContent(seconds, index, card, reducedMotion.matches);
    const bank = photoBanks[card];
    bank.images.forEach((image, i) => {
      image.style.opacity = String(i + 1 === content.number ? content.progress : i + 1 === content.previous && content.progress < 1 ? 1 : 0);
    });
    if (bank.caption.textContent !== content.caption) bank.caption.textContent = content.caption;
    const number = content.number === null ? '' : String(content.number).padStart(2, '0');
    if (bank.number.textContent !== number) bank.number.textContent = number;
    const pose = sampleCard(seconds, index, card, reducedMotion.matches);
    photo.style.opacity = String(pose.opacity);
    let [cardX, cardY] = compact ? layout.cards[card] : [pose.x, pose.y];
    if (compact && index > 0 && cues[index - 1].photos.includes(card)) {
      const previousLayout = sampleLayout(index - 1, true, introLayout).cards[card];
      const travelProgress = cues[index].photos.includes(card)
        ? (reducedMotion.matches ? 1 : easeOut((seconds - cues[index].time) / 0.95)) : 0;
      cardX = mix(previousLayout[0], cardX, travelProgress);
      cardY = mix(previousLayout[1], cardY, travelProgress);
    }
    if (compact && !reducedMotion.matches && index === cues.length - 1) {
      const gather = smooth((seconds - (END_AT - 2)) / 2);
      cardX = mix(cardX, 50, gather);
      cardY = mix(cardY, 30, gather);
    }
    if (photo.style.width !== cardWidth) photo.style.width = cardWidth;
    photo.style.left = `${cardX}%`;
    photo.style.top = `${cardY}%`;
    // Keep the photograph readable and use a flat transform once depth motion settles.
    const depth = Math.abs(pose.tilt) > 0.01 ? ` perspective(900px) rotateY(${pose.tilt}deg)` : '';
    const scale = pose.scale === 1 ? '' : ` scale(${pose.scale})`;
    const travel = compact ? Math.min(0.35, stageWidth / 1600) : 1;
    photo.style.transform = `translate(-50%, -50%) translate(${pose.dx * travel}px, ${pose.dy * travel}px)${depth} rotate(${pose.rotation * 0.6}deg)${scale}`;
  });
}

function cancelLoop() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function renderCurrent() {
  renderAt(previewTime ?? startup?.target ?? (audio.ended ? END_AT : recordingTime()));
}

function finishStartup() {
  if (!startup || audio.readyState < 1 || audio.seeking) return;
  if (recordingTime() >= startup.target - 0.05 && recordingTime() < startup.target + 0.5) {
    const muted = startup.muted;
    startup = null;
    audio.muted = muted;
    status.textContent = 'Baka Bukas · Angela Ken';
    renderCurrent();
    return;
  }
  if (startup.attempts >= 3) {
    pause();
    status.textContent = 'Could not load the edit position. Tap Play song to retry.';
    return;
  }
  startup.attempts++;
  try { seekRecording(startup.target); }
  catch {
    pause();
    status.textContent = 'Could not load the edit position. Tap Play song to retry.';
  }
}

function guardStartup(target) {
  startup = { target, muted: audio.muted, attempts: 0 };
  // A cold browser clip already starts at the correct sound. Keep the user-gesture
  // play audible: iOS can pause a muted start when it is unmuted asynchronously.
  if (recordingOffset() === 0 || Math.abs(recordingTime() - target) > 0.05) audio.muted = true;
  finishStartup();
}

function tick() {
  frame = null;
  renderCurrent();
  if (recordingTime() >= END_AT || audio.ended) {
    audio.pause();
    status.textContent = 'A little hope, until tomorrow. Replay when you’re ready.';
    return;
  }
  if (!audio.paused) frame = requestAnimationFrame(tick);
}

function startLoop() {
  cancelLoop();
  tick();
}

function pause() {
  playbackGeneration++;
  draggingSeek = false;
  resumeAfterScrub = false;
  audio.pause();
  if (startup) {
    const muted = startup.muted;
    startup = null;
    audio.muted = muted;
  }
  cancelLoop();
  renderCurrent();
  playBtn.textContent = 'Play song';
  playBtn.setAttribute('aria-pressed', 'false');
}

function reset({ initializing = false } = {}) {
  draggingSeek = false;
  resumeAfterScrub = false;
  previewTime = null;
  pause();
  const atClipStart = initializing && recordingOffset() > 0 && audio.currentTime < 0.05;
  if (audio.src && audio.readyState >= 1 && recordingTime() !== START_AT && !atClipStart) seekRecording(START_AT);
  renderAt(audio.src && audio.readyState >= 1 ? START_AT : 0);
  status.textContent = 'Ready when you are.';
}

async function play() {
  if (!audio.src || playBtn.disabled) return;
  if (playPending) return;
  const generation = playbackGeneration;
  const target = previewTime ?? (audio.ended || recordingTime() < START_AT || recordingTime() >= segmentEnd() ? START_AT : recordingTime());
  if (audio.readyState < 1 || audio.seeking || Math.abs(recordingTime() - target) > 0.05) guardStartup(target);
  if (generation !== playbackGeneration) return;
  playPending = true;
  status.textContent = startup ? 'Loading the edit…' : 'Baka Bukas · Angela Ken';
  try {
    await audio.play();
    if (generation !== playbackGeneration) return;
    finishStartup();
    if (!startup) status.textContent = 'Baka Bukas · Angela Ken';
  } catch (err) {
    if (generation === playbackGeneration) {
      pause();
      status.textContent = `Could not play the edit. Tap Play song to retry. ${err.message}`;
    }
  } finally {
    playPending = false;
  }
}

playBtn.addEventListener('click', () => {
  if (!audio.paused || playPending) pause();
  else return play();
});

document.getElementById('resetBtn').addEventListener('click', reset);

function recordingReady() {
  const valid = audio.duration + recordingOffset() > START_AT;
  playBtn.disabled = !valid;
  seek.disabled = !valid;
  if (valid && startup) {
    finishStartup();
    renderCurrent();
  } else if (valid) reset({ initializing: true });
  else {
    pause();
    renderAt(0);
    status.textContent = 'The recording could not load the edit. Please reload the page.';
  }
}
audio.addEventListener('loadedmetadata', recordingReady);
audio.addEventListener('play', () => {
  if (audio.paused) return;
  if (!startup && recordingTime() < START_AT) guardStartup(START_AT);
  if (audio.paused) return;
  playBtn.textContent = 'Pause';
  playBtn.setAttribute('aria-pressed', 'true');
  startLoop();
});
audio.addEventListener('pause', () => {
  if (!audio.paused) return;
  cancelLoop();
  renderCurrent();
  playBtn.textContent = 'Play song';
  playBtn.setAttribute('aria-pressed', 'false');
});
audio.addEventListener('seeking', renderCurrent);
audio.addEventListener('seeked', () => {
  finishStartup();
  previewTime = null;
  renderCurrent();
  if (!audio.paused) startLoop();
});
audio.addEventListener('canplay', finishStartup);
audio.addEventListener('playing', finishStartup);
audio.addEventListener('timeupdate', () => {
  if (recordingTime() >= END_AT && !audio.paused) startLoop();
  else if (audio.paused) renderCurrent();
});
audio.addEventListener('ended', () => {
  pause();
  renderAt(END_AT);
  status.textContent = 'Recording ended. Ready to replay.';
});
audio.addEventListener('error', () => {
  pause();
  playBtn.disabled = true;
  seek.disabled = true;
  status.textContent = 'The song could not be loaded. Please reload the page.';
});
seek.addEventListener('pointerdown', () => {
  if (seek.disabled) return;
  const wasPlaying = !audio.paused || playPending;
  pause();
  draggingSeek = true;
  resumeAfterScrub = wasPlaying;
});
seek.addEventListener('input', () => {
  if (!audio.src || audio.readyState < 1) return;
  const elapsed = Number(seek.value);
  if (!Number.isFinite(elapsed)) return;
  previewTime = Math.max(START_AT, Math.min(segmentEnd(), START_AT + elapsed));
  seekRecording(previewTime);
  renderCurrent();
});
function finishScrub(resume = true) {
  if (!draggingSeek) return;
  draggingSeek = false;
  const shouldPlay = resume && resumeAfterScrub;
  resumeAfterScrub = false;
  renderCurrent();
  if (shouldPlay) void play();
}
seek.addEventListener('change', () => finishScrub());
window.addEventListener('pointerup', () => finishScrub());
window.addEventListener('pointercancel', () => finishScrub(false));
window.addEventListener('blur', () => finishScrub(false));
window.addEventListener('resize', renderCurrent);
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(renderCurrent).observe(stage);
}
reducedMotion.addEventListener('change', renderCurrent);
window.addEventListener('pagehide', pause);
document.addEventListener('visibilitychange', () => {
  if (!desktopOverlay && document.hidden) pause();
});
renderAt(0);
if (audio.readyState >= 1) recordingReady();
else if (!desktopOverlay) {
  playBtn.disabled = false;
  status.textContent = 'Tap Play song to begin.';
}

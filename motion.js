// Stateless choreography, sampled from original audio time. No animation queues.
const arrangements = [
  { name: 'beside', text: [67, 51, 43], cards: [[23, 43, -9], [79, 35, 8]], enter: 'fall', exit: 'float', type: 'words' },
  { name: 'framed', text: [50, 66, 58], cards: [[23, 33, -11], [77, 34, 9]], enter: 'slide', exit: 'turn', type: 'letters' },
  { name: 'aside', text: [32, 51, 46], cards: [[22, 34, -8], [77, 44, 7]], enter: 'depth', exit: 'depth', type: 'lift' },
  { name: 'gathered', text: [50, 65, 66], cards: [[43, 30, -12], [58, 32, 10]], enter: 'fall', exit: 'stack', type: 'words' },
  { name: 'promise', text: [64, 48, 46], cards: [[22, 44, -7], [80, 30, 8]], enter: 'slide', exit: 'float', type: 'lift', strong: true },
  { name: 'corner', text: [39, 59, 57], cards: [[20, 31, -8], [79, 29, 11]], enter: 'depth', exit: 'turn', type: 'letters' },
  { name: 'refrain', text: [50, 49, 60], cards: [[17, 30, -12], [83, 64, 12]], enter: 'slide', exit: 'depth', type: 'words', strong: true },
  { name: 'beside', text: [65, 50, 48], cards: [[23, 41, -7], [79, 35, 8]], enter: 'fall', exit: 'stack', type: 'letters' },
  { name: 'framed', text: [50, 64, 64], cards: [[24, 31, -9], [76, 33, 10]], enter: 'depth', exit: 'float', type: 'lift', strong: true },
  { name: 'aside', text: [33, 51, 48], cards: [[20, 32, -8], [78, 43, 8]], enter: 'slide', exit: 'turn', type: 'words' },
  { name: 'farewell', text: [50, 60, 66], cards: [[39, 29, -10], [62, 31, 9]], enter: 'fall', exit: 'stack', type: 'letters', strong: true }
];
// Each phrase has an editorial treatment; repeated lyrics build into a new scene.
const treatments = [
  ['whisper', 'left', [3]],
  ['question', 'center', [4]],
  ['whisper', 'left', [4, 7]],
  ['statement', 'center', [0, 1, 2]],
  ['statement', 'left', [0, 1]],
  ['whisper', 'right', [4, 5]],
  ['refrain', 'center', [1, 3]],
  ['statement', 'right', [3, 4]],
  ['statement', 'center', [0, 1]],
  ['whisper', 'left', [4, 5]],
  ['refrain', 'center', [1, 3]]
];
arrangements.forEach((scene, i) => {
  [scene.treatment, scene.align, scene.accent] = treatments[i];
  scene.type = 'words';
});

function sampleLayout(index, compact, introLayout = 0) {
  if (!compact) return { text: arrangements[index].text, cards: arrangements[index].cards };
  const paired = cues[index].photos.length === 2;
  const variations = [0, -3, 3, 1, -2, 2, 0, -3, 2, -1, 0];
  const shift = variations[index];
  const textY = 73 + shift - 20 * introLayout;
  const photoY = 30 + shift * 0.6 - 4 * introLayout;
  return {
    text: [50, textY, 90],
    cards: paired
      ? [[26 + shift * 0.4, photoY - 1], [74 + shift * 0.4, photoY + 2]]
      : [[50 + shift, photoY], [50 + shift, photoY]]
  };
}
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 4);
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
// One slow eight-second cycle, shared across cues and sampled from the audio clock.
const floatOffset = (seconds, phase = 0, amplitude = 3) => Math.sin((seconds - START_AT) * Math.PI / 4 + phase) * amplitude;

function cardPose(index, card) {
  const [x, y, rotation] = arrangements[index].cards[card];
  return { x, y, rotation, dx: 0, dy: 0, tilt: 0, scale: 1, opacity: 1 };
}

function displaced(pose, kind, card, exiting = false) {
  const side = card === 0 ? -1 : 1;
  const result = { ...pose, opacity: 0 };
  if (kind === 'fall') Object.assign(result, { dy: -110, rotation: pose.rotation + side * 19, tilt: -12, scale: 0.92 });
  if (kind === 'slide' || kind === 'turn') Object.assign(result, { dx: side * 230, dy: exiting ? 70 : 30, rotation: side * 32 });
  if (kind === 'depth') Object.assign(result, { scale: 0.7, tilt: side * 28, dy: 30, rotation: side * 16 });
  if (kind === 'float') Object.assign(result, { dy: -110, rotation: pose.rotation + side * 7 });
  if (kind === 'stack') Object.assign(result, { x: 50, y: 32, rotation: side * 2, scale: 0.85 });
  return result;
}

function sampleCard(seconds, index, card, reducedMotion) {
  const current = cues[index].photos.includes(card);
  const previous = index > 0 && cues[index - 1].photos.includes(card);
  const age = seconds - cues[index].time;
  const progress = reducedMotion ? 1 : easeOut((age - (!previous ? card * 0.10 : 0)) / 0.95);
  const target = cardPose(index, card);
  let from, to;
  if (current) {
    from = previous ? cardPose(index - 1, card) : displaced(target, arrangements[index].enter, card);
    to = target;
  } else if (previous) {
    from = cardPose(index - 1, card);
    to = displaced(from, arrangements[index - 1].exit, card, true);
  } else return { ...target, opacity: 0 };
  const result = {};
  for (const key of Object.keys(target)) result[key] = mix(from[key], to[key], progress);
  if (!reducedMotion) {
    result.rotation += floatOffset(seconds, card * 0.8, 0.4) * result.opacity;
  }
  const farewell = smooth((seconds - (END_AT - 2)) / 2);
  if (!reducedMotion && farewell > 0) {
    const exitPose = displaced(result, arrangements[index].exit, card, true);
    for (const key of ['x', 'y', 'rotation', 'dx', 'dy', 'tilt', 'scale']) {
      result[key] = mix(result[key], exitPose[key], farewell);
    }
  }
  result.opacity *= 1 - farewell;
  result.floatY = reducedMotion ? 0 : floatOffset(seconds, card * 0.8, 6) * result.opacity;
  return result;
}

// White words rise softly; gold words follow with delayed scale and fade.
// Sampling the recording clock keeps pause, replay, and seeking deterministic.
function sampleText(seconds, index, unit, count, reducedMotion, highlighted = false) {
  const age = seconds - cues[index].time;
  const duration = (cues[index + 1]?.time ?? END_AT) - cues[index].time;
  // Each color has its own word order, so a late gold word still leads its group.
  const stagger = reducedMotion ? 0 : Math.min(unit * (highlighted ? 0.05 : 0.03), 0.15);
  const entranceDelay = (highlighted ? 0.25 : 0) + stagger;
  const entrance = smooth((age - entranceDelay) / 0.45);
  const settle = easeOut((age - entranceDelay) / 0.45);
  const outroWindow = index === cues.length - 1 ? 2 : 0.55;
  const exitStart = duration - outroWindow + (highlighted ? 0.2 : 0) + stagger;
  // Shorten delayed exits so every word is gone at the next lyric boundary.
  const exit = smooth((age - exitStart) / (duration - exitStart));
  return {
    opacity: entrance * (1 - exit),
    scale: highlighted && !reducedMotion ? 0.82 + 0.18 * settle * (1 - exit) : 1,
    x: 0,
    y: reducedMotion ? 0 : (highlighted ? 10 : 8) * (1 - settle) - (highlighted ? 4 : 5) * exit + floatOffset(seconds) * entrance * (1 - exit),
    rotation: 0, mask: 0
  };
}

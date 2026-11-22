// Retimed against the supplied MP3 with user approval on 2026-11-22.
// Estimated phrase starts from local token alignment; locked against automatic edits.
// See tests/fixtures/aligned-timeline.json for the recording hash and measurements.
// Choreography belongs in motion.js, never in this timeline.
const START_AT = 100;
const END_AT = 160;
const cues = Object.freeze([
  { time: 100.18, text: "Patapos na ang kanta", photos: [0] },
  { time: 103.08, text: "Nasa'n ka na ba, sinta?", photos: [0, 1] },
  { time: 105.90, text: "Tiyak na ba ang bukas na nandiyan ka na?", photos: [1] },
  { time: 113.20, text: "Ibahin mo ako sa milyong mata nila", photos: [0, 1] },
  { time: 119.10, text: "Piliin ako, sana bukas ay ako na", photos: [0] },
  { time: 124.88, text: "Hayaan akong ipadama na iba ka", photos: [1] },
  { time: 132.14, text: "Baka bukas, baka bukas", photos: [0, 1] },
  { time: 135.56, text: "Ibahin mo ako sa milyong mata nila", photos: [0] },
  { time: 141.38, text: "Piliin ako, sana bukas ay ako na", photos: [0, 1] },
  { time: 147.16, text: "Hayaan akong ipadama na iba ka", photos: [1] },
  { time: 154.62, text: "Baka bukas, baka bukas", photos: [0, 1] }
].map(cue => Object.freeze({ ...cue, photos: Object.freeze(cue.photos) })));

function cueAt(seconds) {
  // Chromium MP3 seeks can truncate a requested timestamp by 1–2 microseconds.
  // Ten microseconds is less than one 44.1 kHz sample; this only absorbs clock
  // conversion noise, without changing any cue timestamp or playback position.
  const clockTolerance = 0.00001;
  if (seconds < START_AT - clockTolerance || seconds >= END_AT - clockTolerance) return -1;
  let index = -1;
  for (let i = 0; i < cues.length && seconds + clockTolerance >= cues[i].time; i++) index = i;
  return index;
}

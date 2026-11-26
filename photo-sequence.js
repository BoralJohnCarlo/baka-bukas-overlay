// Five narrator photos and three original portraits, repeated in numbered order.
// Visual assignments only. The lyric timeline and its timestamps stay untouched.
// Card 0 is the narrator (me / ako); card 1 is the person addressed (her / ikaw).
const photoLibrary = Object.freeze([
  Object.freeze(['50% 100%', '62% 50%', '50% 100%', '50% 85%', '50% 45%'].map((position, i) => Object.freeze({ src: `me/${i + 1}.jpg`, position }))),
  Object.freeze(Array.from({ length: 5 }, (_, i) => Object.freeze({ src: `her (original)/${i % 3 + 1}.jpg`, position: '50% 50%' })))
]);

// Keep a photo through connected lines; advance each person's album only 1 → 5.
// null means that card exits/is absent, matching the existing cue.photos values.
const photoSequence = Object.freeze([
  [1, null], // Patapos: the narrator, remembering.
  [1, 1],    // Nasa'n: introduce the person being missed.
  [null, 1], // Nandiyan ka na: keep her in focus.
  [2, 2],    // Ibahin mo ako: the request, addressed to her.
  [2, null], // Piliin ako: hold the narrator's portrait.
  [null, 3], // Iba ka: focus on her.
  [3, 3],    // Baka bukas: bring both into the same composition.
  [4, null], // Ibahin mo ako: return to the narrator.
  [4, 4],    // Piliin ako: the same narrator, with her alongside.
  [null, 5], // Iba ka: her final portrait.
  [5, 5]     // Baka bukas: finish with both final portraits.
].map(pair => Object.freeze(pair)));

function samplePhotoContent(seconds, index, card, reducedMotion) {
  const current = photoSequence[index][card];
  const previous = index > 0 ? photoSequence[index - 1][card] : null;
  const changing = current !== null && previous !== null && current !== previous;
  return {
    number: current ?? previous,
    previous: changing ? previous : null,
    progress: changing && !reducedMotion ? smooth((seconds - cues[index].time) / 0.45) : 1,
    caption: cues[current !== null ? index : Math.max(0, index - 1)].text.startsWith('Baka bukas')
      ? 'baka bukas…' : card === 0 ? 'piliin ako' : 'ikaw, sinta'
  };
}

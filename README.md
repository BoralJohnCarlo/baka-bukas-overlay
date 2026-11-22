# Baka Bukas — Code in Motion

A transparent Electron overlay for cinematic Polaroids and lyrics over your actual VS Code editor. No editor screenshot, full-screen background, external fonts, or additional runtime dependencies.

## Run

1. Run `npm install` if dependencies are not installed.
2. Run `npm start` with VS Code behind the overlay.
3. The recording in `audio/Angela Ken - 'Baka Bukas' Official Music Video.mp3` loads automatically. Select **Play song**. Use **Choose song** to select another file.

The supplied audio file is read locally and never modified. Keep it in the `audio` folder; audio analysis tools and model files are not application dependencies.

## Mobile and browser use

Serve `index.html`, `style.css`, `renderer.js`, `timeline.js`, `motion.js`, `photo-sequence.js`, and the `audio`, `me`, and `her` folders together on a static web host. The host must support media byte-range requests so the recording can seek to 1:40. File names and capitalization must stay intact. Desktop Electron still runs with `npm start`.

In a browser, the page has a dark background and **Choose song** uses the device's file picker; the selected file stays local. Tap **Play song** to begin. The supplied recording and lyric timing cover 1:40–2:40; choosing a different song does not realign the lyrics. Desktop overlay transparency and global shortcuts are available in Electron only.

The browser layout reserves separate space for animation and touch controls on phones and tablets, respects display safe areas, and places controls beside the stage in short landscape windows. Photo sizes follow the available stage width and height. Very short windows can scroll to keep controls accessible. Playback pauses when the tab is hidden or the page is left. The Play button also works when a browser defers audio metadata until a user taps it.

The Electron browser smoke test uses Chromium at 22 viewport sizes, from a narrow 280-pixel phone through 1366×1024 tablets, including portrait, landscape, rotation, and reduced viewport heights. It checks lyric and photo bounds, touch targets, horizontal overflow, hosted MP3 playback, and local-file playback. A unit test covers deferred-metadata startup. This Electron-only check does not emulate Safari/WebKit, device codecs, or native file-picker behavior; physical iOS/Android devices still need a listening and visual check. The supplied MP3 is the intended recording; playback of other file formats depends on the device's codecs.

Run `npm run test:mobile` for the HTTP browser smoke test (a hidden Electron window without the desktop preload bridge).

Compact layouts keep the intro in a separate band below the lyrics. Short stages temporarily use smaller cards and a higher lyric position until the intro has faded, then restore the normal arrangement from audio time. The mobile tests check intro/photo and intro/lyric separation throughout the entrance.

Optional cross-engine checks: install test tooling with `npm install --no-save --package-lock=false playwright`, run `npx playwright install chromium webkit`, then `npm run test:platforms`. This tests Android-style Chromium and iPhone/iPad-style WebKit device profiles, including touch playback, local audio selection, rotation, reduced motion, and simulated safe-area padding. These are browser emulations, not physical Android/iOS certification. `PLAYWRIGHT_MODULE` can point to an external Playwright installation instead. `MOBILE_PROFILE` selects one profile for a focused rerun. A running Android emulator can be checked with `npm run test:platforms -- --android`; set `ANDROID_SERIAL` to its ADB serial (default `emulator-5580`).

The Windows WebKit port in this environment rejects local blob audio with `MEDIA_ERR_SRC_NOT_SUPPORTED`, reproduced with a standalone audio element outside the app. The platform suite explicitly reports that local-file case as unavailable after an independent probe; hosted MP3 playback is still checked. Its MP3 reset check allows a 25 ms readback tolerance because this port sometimes reports 100.01 seconds after a seek to 100; the application still requests exactly 100 seconds and the approved timeline is unchanged.

## Controls

- **Choose song** selects a local MP3, WAV, OGG, or M4A recording.
- **Play song / Pause** starts or resumes the selected recording and freezes all stage motion when paused.
- **Reset** pauses and returns to exactly 1:40, with the intro ready to play.
- The position slider seeks within the selected original-recording segment, updating the visuals immediately while playing or paused.
- **Ctrl+Shift+H** hides/shows the overlay; **Ctrl+Shift+Q** quits.

The recording is the only animation clock. Recordings ending before 1:40 cannot play this segment; shorter recordings ending within the segment stop at their natural end without stretching or looping.

## Timing protection

`timeline.js` holds the corrected timeline for the supplied recording. The user authorized lyric retiming on 2026-11-22. `START_AT = 100`, `END_AT = 160`, and all 11 cues' text, order, and photo assignments are preserved. The intro begins at 100 seconds; the first lyric starts at 100.18 seconds. The timeline objects remain frozen and are not adjusted automatically during playback.

Phrase starts were estimated locally from the actual recording using multilingual Whisper token alignment, with a focused recheck of the opening lines. These are model-derived alignment estimates, not human-verified or sample-accurate vocal onsets. The original times are archived in `tests/fixtures/original-timeline.json`. The revised times, recording SHA-256, and alignment measurements are recorded in `tests/fixtures/aligned-timeline.json`. Further timing changes require approval.

`motion.js` defines photo arrangements and samples choreography from absolute recording time. `renderer.js` uses one cancellable `requestAnimationFrame` loop and `audio.currentTime`. There are no animation timers, CSS stage transitions, or independent animation clocks. Pausing freezes poses, and seeking reconstructs the state directly without replaying earlier animations.

All lyric words are present and legible at their scheduled cue boundary. Staggering affects visual emphasis and transforms only. The last two seconds of the existing segment fade the stage out; the segment boundaries stay unchanged. Playback stops on the first frame or media update that observes the end boundary, without seeking or changing playback speed.

## Customize visuals

- `me/1.jpg` through `me/5.jpg` contain the narrator's photos; `her/1.jpg` through `her/5.jpg` contain the person addressed in the lyrics. Both folders were counted before integration: five images each, with no numbering gaps.
- `photo-sequence.js` assigns the images to the existing lyric cues in numbered order. Photos hold across connected lines, so all ten images cover the full sequence without requiring extra images. Each card has five preloaded images, with framing set per photo; image changes crossfade from audio time and never delay lyrics.
- Edit arrangements and motion in `motion.js`, and typography, paper styling, and controls in `style.css`.
- The stage respects the system's reduced-motion preference.

| Lyric cue | Your photo | Her photo |
| --- | --- | --- |
| Patapos na ang kanta | 1 | — |
| Nasa'n ka na ba, sinta? | 1 | 1 |
| Tiyak na ba ang bukas… | — | 1 |
| Ibahin mo ako… | 2 | 2 |
| Piliin ako… | 2 | — |
| Hayaan akong ipadama na iba ka | — | 3 |
| Baka bukas, baka bukas | 3 | 3 |
| Ibahin mo ako… | 4 | — |
| Piliin ako… | 4 | 4 |
| Hayaan akong ipadama na iba ka | — | 5 |
| Baka bukas, baka bukas | 5 | 5 |

An absent card keeps its previous image while it exits. Seeking reconstructs the same image and crossfade state directly, including when paused. Image files are used as supplied; framing uses CSS and does not crop or overwrite the originals.

## Verify

- `npm test` checks the approved cue times, original cue text/order/photos, unchanged segment and recording hash, every cue boundary, immediate text visibility, repeated pause/resume, deterministic seeking, reset/replay, end cleanup, single-loop ownership, and listener stability.
- `npm run test:electron` launches the actual Electron entry point, verifies that the local MP3 loads at 100 seconds, and crosses every lyric boundary during real MP3 playback (muted). It also tests the preload bridge, transparency, shortcuts, and media controls with a temporary silent WAV. It saves a preview in the temporary test directory and exits. The test needs the supplied recording and desktop application launch permissions.

Automated tests verify playback behavior and protect the approved alignment from regressions. They cannot independently judge the musical accuracy of model-estimated timestamps; a final listening pass can identify any small vocal-onset adjustments.

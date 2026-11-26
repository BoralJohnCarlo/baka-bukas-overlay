# Baka Bukas — Code in Motion

A transparent Electron overlay for cinematic Polaroids and lyrics over your actual VS Code editor. No editor screenshot, full-screen background, external fonts, or additional runtime dependencies.

## Run

1. Run `npm install` if dependencies are not installed.
2. Run `npm start` with VS Code behind the overlay.
3. The recording in `audio/Angela Ken - 'Baka Bukas' Official Music Video.mp3` loads automatically. Select **Play song** to play the fixed edit.

The supplied audio file is read locally and never modified. Keep it in the `audio` folder; audio analysis tools and model files are not application dependencies.

## Mobile and browser use

Serve `index.html`, `favicon.svg`, `style.css`, `renderer.js`, `timeline.js`, `motion.js`, `photo-sequence.js`, and the `audio`, `me`, and `her (original)` folders together on a static web host. Browsers play `audio/edit.mp3`, a 60-second derivative of the original recording from 1:40 to 2:40, without an initial seek. Byte-range support is still recommended for slider seeking. File names and capitalization must stay intact. Desktop Electron still runs with `npm start`.

In a browser, the page has a dark photographic background with soft focus, a vignette, warm light, and subtle grain. Its two photo layers crossfade from the recording clock, with slow horizontal drift. Tap **Play song** to begin the fixed edit. There is no song picker. The browser clip maps its 0:00–1:00 media clock to the original 1:40–2:40 lyric timeline; the original recording stays unchanged. A cold start neither seeks nor starts muted, avoiding mobile Safari seek waits and asynchronous unmute restrictions. Desktop overlay transparency and global shortcuts are available in Electron only.

The browser layout reserves separate space for animation and touch controls on phones and tablets, respects display safe areas, and places controls beside the stage in short landscape windows. Photo sizes follow the available stage width and height. Very short windows can scroll to keep controls accessible. Playback pauses when the tab is hidden or the page is left. The Play button also works when a browser defers audio metadata until a user taps it.

The Electron browser smoke test uses Chromium at 27 viewport sizes, from a narrow 280-pixel phone through 1366×1024 tablets, including portrait, landscape, rotation, and reduced viewport heights. It checks lyric and photo bounds, touch targets, horizontal overflow, hosted MP3 playback, and short-recording edge cases. A unit test covers deferred-metadata startup. This Electron-only check does not emulate Safari/WebKit, device codec behavior; physical iOS/Android devices still need a listening and visual check. Only the supplied MP3 is exposed by the player.

Run `npm run test:mobile` for the HTTP browser smoke test (a hidden Electron window without the desktop preload bridge).

Compact layouts keep the intro in a separate band below the lyrics. Short stages temporarily use smaller cards and a higher lyric position until the intro has faded, then restore the normal arrangement from audio time. The mobile tests check intro/photo and intro/lyric separation throughout the entrance.

Optional cross-engine checks: install test tooling with `npm install --no-save --package-lock=false playwright`, run `npx playwright install chromium webkit`, then `npm run test:platforms`. This tests Android-style Chromium and iPhone/iPad-style WebKit device profiles, including delayed cold startup, checks against unmuted playback before 1:40, real touch and keyboard slider input, replay, rotation, reduced motion, and simulated safe-area padding. These are browser emulations, not physical Android/iOS certification. `PLAYWRIGHT_MODULE` can point to an external Playwright installation instead. `MOBILE_PROFILE` selects one profile for a focused rerun, including `iPhone 12`. Set `SLOW_MEDIA=1` to stream audio at about 64 KB/s and verify playback starts before the full download. `MOBILE_TEST_URL` runs the same checks against a deployed site instead of the temporary local server. A running Android emulator can be checked with `npm run test:platforms -- --android`; set `ANDROID_SERIAL` to its ADB serial (default `emulator-5580`).

The WebKit MP3 reset check allows a 25 ms readback tolerance because this port sometimes reports 100.01 seconds after a seek to 100; the application still requests exactly 100 seconds and the approved timeline is unchanged.


## Controls

- **Play song / Pause** starts or resumes the edit and freezes all stage motion when paused.
- **Reset** pauses and returns to the edit start (1:40 in the original recording), with the intro ready to play.
- The position slider and time display run from **0:00 to 1:00** for the edit. Touch dragging pauses motion to keep the thumb steady, then resumes only if playback was active before the drag; dragging while paused stays paused. Keyboard seeking and replay use the same original-recording clock.
- **Ctrl+Shift+H** hides/shows the overlay; **Ctrl+Shift+Q** quits.

The recording is the only animation clock. Recordings ending before 1:40 cannot play this segment; shorter recordings ending within the segment stop at their natural end without stretching or looping.

## Timing protection

`timeline.js` holds the corrected timeline for the supplied recording. The user authorized lyric retiming on 2026-11-22. `START_AT = 100`, `END_AT = 160`, and all 11 cues' text, order, and photo assignments are preserved. The intro begins at 100 seconds; the first lyric starts at 100.18 seconds. The timeline objects remain frozen and are not adjusted automatically during playback.

Phrase starts were estimated locally from the actual recording using multilingual Whisper token alignment, with a focused recheck of the opening lines. These are model-derived alignment estimates, not human-verified or sample-accurate vocal onsets. The original times are archived in `tests/fixtures/original-timeline.json`. The revised times, recording SHA-256, and alignment measurements are recorded in `tests/fixtures/aligned-timeline.json`. Further timing changes require approval.

`motion.js` defines photo arrangements and samples choreography from absolute recording time. `renderer.js` uses one cancellable `requestAnimationFrame` loop and `audio.currentTime`. There are no animation timers, CSS stage transitions, or independent animation clocks. Pausing freezes poses, and seeking reconstructs the state directly without replaying earlier animations.

Lyric content switches at its scheduled cue boundary. White words fade in over 450 ms while rising 8 px, staggered by 30 ms. Gold words follow after 250 ms, staggered by 50 ms, growing from 82% to full size while rising 10 px. Staggering is capped at 150 ms per color group. Text floats vertically by 3 px on a slow eight-second cycle; Polaroids float by 6 px with a gentle phase offset. The shared recording clock keeps the float continuous across lyric changes. White words start fading and lifting 550 ms before the next cue; gold words start their shrink, fade, and lift 200 ms later. Delayed exits shorten to finish at the next cue. The final line exits over the last two seconds with the same gold delay. Cue timestamps and segment boundaries stay unchanged. Playback stops on the first frame or media update that observes the end boundary, without seeking or changing playback speed. Reduced motion keeps the fades and color delays but removes movement, scaling, and word staggering.

## Customize visuals

- `me/1.jpg` through `me/5.jpg` contain the narrator's photos. `her (original)/1.jpg` through `her (original)/3.jpg` contain the person addressed in the lyrics and repeat in order across her five slots: 1, 2, 3, 1, 2. The older `her/` folder is unused.
- `photo-sequence.js` assigns the images to the existing lyric cues in numbered slots. Photos hold across connected lines. Each card has five preloaded slots; image changes crossfade from audio time and never delay lyrics. Her original portraits use centered framing.
- Edit arrangements and motion in `motion.js`, and typography, paper styling, and controls in `style.css`.
- Each lyric has its own serif or bold treatment and emphasized gold words. White text rises and fades; gold words follow with delayed growth and shrinking. The repeated “Piliin ako” phrases have a dedicated headline and supporting line. Wide browser stages use the full scene compositions; compact stages use centered solo portraits or staggered pairs with varied lyric heights. Very short stages condense the intro to keep it separate from the lyrics.
- `grain.svg` supplies the lightweight backdrop texture and must be included when hosting. All backdrop and foreground movement pauses and seeks with the audio. Reduced motion removes movement and settles the photo layers immediately.
- The stage respects the system's reduced-motion preference.

| Lyric cue | Your photo slot | Her photo slot (originals 1, 2, 3, 1, 2) |
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

- `npm test` checks the approved cue times, original cue text/order/photos, unchanged segment and recording hash, every cue boundary, white fades and gold scale/fade transitions, repeated pause/resume, deterministic seeking, reset/replay, end cleanup, single-loop ownership, and listener stability.
- `npm run test:electron` launches the actual Electron entry point, verifies that the local MP3 loads at 100 seconds, and crosses every lyric boundary during real MP3 playback (muted). It also tests the preload bridge, transparency, shortcuts, and media controls with a temporary silent WAV. It saves a preview in the temporary test directory and exits. The test needs the supplied recording and desktop application launch permissions.

Automated tests verify playback behavior and protect the approved alignment from regressions. They cannot independently judge the musical accuracy of model-estimated timestamps; a final listening pass can identify any small vocal-onset adjustments.

The browser clip was generated using FFmpeg with: `-i ORIGINAL.mp3 -ss 100 -t 60 -map_metadata -1 -c:a libmp3lame -b:a 192k -write_xing 1 audio/edit.mp3`. The seek is applied after input decoding for precise trimming. MP3 gapless metadata preserves encoder-delay compensation. No FFmpeg installation is required to run the website.

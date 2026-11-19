# Changelog

## v0.2.1 (2026-11-18, 21:45 PT)

**Time spent:** about 5 minutes

**What changed**
- Added the podcast **Sana G's Crush On You** (iHeart) to the Podcasts tab.

**Why**
- Requested by Atsushi. It is published as a podcast, so it can be saved for offline listening like the other shows.

## v0.2.0 (2026-11-18, 21:45 PT)

**Time spent:** about 25 minutes

**What changed**
- New **Podcasts** tab (Japan TV and Learning tabs unchanged).
- Follows 6 shows: Acquired, Dwarkesh Podcast, BG2Pod, No Priors, Lex Fridman Podcast, View From The Top (Stanford GSB).
- **⬇ Save** an episode to the device and play it with no internet. Shows download progress and how much space is used.
- Remembers where you stopped in each episode, marks finished ones, and has a speed button (1×–2×).
- Lock-screen and Bluetooth (car) play/pause and skip controls.
- Filter chips: All / Saved / each show. With no internet the app jumps to Saved.
- A GitHub Action updates the episode list every 6 hours for free.
- App remembers the last tab you used.

**Why**
- Saving YouTube videos is against YouTube's rules, but podcast creators publish their episodes for download, so this is the legal way to listen offline in the car.
- Podcast feeds can't be read directly by web pages (CORS), so GitHub does it on a schedule.

**Known limits**
- Some podcast servers block web apps from saving files; those episodes can only be streamed.
- Saved episodes and "My list" stay on one device and don't sync.

## v0.1.0 (2026-11-18, 21:30 PT)

**Time spent:** about 30 minutes

**What changed**
- First version of the app.
- **Japan TV tab:** video player (hls.js) with NHK World-Japan (3 backup links), Shop Channel, and a link to Weathernews LiVE on YouTube.
- Each channel tries its backup links automatically if the first one fails, and shows a plain-English message if none work.
- **Learning tab:** 8 starting searches for interviews with tech leaders (Jensen Huang, Satya Nadella, Lisa Su, Demis Hassabis, Dario Amodei, Stanford GSB).
- **My list:** add your own video links; saved on the device.
- Installable as an app (PWA) on Windows and Android (Pixel).
- README with setup and install steps.

**Why**
- Start small with only official, free streams so the app is legal and reliable.
- One web app works on both the PC and the Pixel, with free hosting on GitHub Pages.

**Known limits**
- Streams could not be test-played during development; real playback testing happens on the PC and Pixel.
- Learning items are YouTube searches for now; exact video links will come in v0.2.
- "My list" does not sync between devices.

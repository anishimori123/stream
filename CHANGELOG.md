# Changelog

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

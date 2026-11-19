# Stream

A small web app with three tabs:

- **Japan TV:** official, free Japan TV streams.
- **Learning:** a list of interviews with tech leaders (Jensen Huang and others), plus your own list.
- **Podcasts:** the newest episodes of tech-leader podcasts. Save episodes on your phone and play them later with no internet (great for the car).

It runs in any browser and can be **installed like an app** on Windows and on an Android phone (Pixel). It is free to host and use.

**Live site:** https://anishimori123.github.io/stream/ (works after GitHub Pages is turned on, see below)

## What's inside

| File | What it does |
|---|---|
| `index.html` | The page layout (the two tabs, the video player) |
| `style.css` | Colors and layout |
| `app.js` | The logic: plays streams, shows lists, saves "My list" |
| `channels.json` | **The channel and learning list.** Edit this to add or remove items |
| `podcasts.js` | The Podcasts tab: episode list, play, save for offline, speed, resume |
| `podcasts-config.json` | **Which podcasts to follow.** Edit this to add or remove shows |
| `podcasts.json` | Latest episodes. Filled in **automatically** by GitHub; don't edit by hand |
| `scripts/update-podcasts.mjs` | Reads each show's public feed and writes `podcasts.json` |
| `.github/workflows/podcasts.yml` | Runs that script on GitHub every 6 hours (free) |
| `manifest.webmanifest` | Lets phones and PCs "install" the site as an app |
| `sw.js` | Service worker: keeps the app's own files so it opens fast |
| `icons/` | App icons |

## Rules for channels

Only **official** streams go in `channels.json`: streams published by the TV station itself, or the station's own YouTube channel.
No re-uploads, no VPN tricks, no recording copy-protected shows.

Each TV channel can have several `urls`. The app tries them in order, so backups help when one is down.

## How to add a channel or video

1. On GitHub, open `channels.json` and click the pencil (Edit) icon.
2. Copy one block in the `"tv"` or `"learning"` list and change the values.
3. Click **Commit changes**. The live site updates in about 1 minute.

Videos you add inside the app under **My list** are saved only on that device (your PC and phone have separate lists).

## Podcasts: how it works

1. Every 6 hours, GitHub runs a small script for free (a "GitHub Action").
2. The script finds each show's public RSS feed (a list of episodes that podcast creators publish for podcast apps) and saves the newest episodes into `podcasts.json`.
3. The app reads that file. Tap **▶** to stream, or **⬇ Save** to store the episode on your device.
4. Saved episodes play with **no internet**. The app remembers where you stopped, and you can change speed (1× to 2×). Phone lock-screen and car Bluetooth buttons work too.

To refresh episodes right away: open the repo's **Actions** tab, then **Update podcast episodes**, then **Run workflow**.

To add a show: in `podcasts-config.json`, copy one line and change `id`, `name`, `search` (words to find it) and `match` (a word in the show's real name). Commit, and GitHub updates the list within a few minutes.

**Notes:** episodes take about 50–150 MB per hour of audio. A few podcast servers don't allow web apps to save files. Those episodes can still be streamed. If your phone runs very low on space, Android may clear saved episodes.

## Turn on the free website (GitHub Pages), one time only

1. Go to https://github.com/anishimori123/stream/settings/pages
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
4. Wait 1–2 minutes and open https://anishimori123.github.io/stream/

## Install on your Pixel

1. Open the live site in **Chrome** on the Pixel.
2. Tap the **⋮** menu (top right), then **Add to Home screen** (or **Install app**).
3. Tap **Install**. A "Stream" icon appears on your home screen.

## Install on Windows

1. Open the live site in **Chrome** or **Edge**.
2. Click the install icon at the right end of the address bar (a small monitor with a down arrow).
3. Click **Install**.

## Test it on your PC without the internet site

```
cd stream
python -m http.server 8000
```
Then open http://localhost:8000 in Chrome. Press **Ctrl + C** in the terminal to stop.

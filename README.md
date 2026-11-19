# Stream

A small web app for watching **official, free Japan TV streams** and keeping a **learning list** of interviews with tech leaders (Jensen Huang and others).

It runs in any browser and can be **installed like an app** on Windows and on an Android phone (Pixel). It is free to host and use.

**Live site:** https://anishimori123.github.io/stream/ (works after GitHub Pages is turned on, see below)

## What's inside

| File | What it does |
|---|---|
| `index.html` | The page layout (the two tabs, the video player) |
| `style.css` | Colors and layout |
| `app.js` | The logic: plays streams, shows lists, saves "My list" |
| `channels.json` | **The channel and learning list.** Edit this to add or remove items |
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

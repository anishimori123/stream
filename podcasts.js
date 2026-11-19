// Podcasts tab: list episodes, stream them, or save them on this device for offline listening.
// Saved audio lives in IndexedDB (the browser's built-in storage for big files).
(() => {
  const listEl = document.getElementById("pod-list");
  const chipsEl = document.getElementById("pod-chips");
  const infoEl = document.getElementById("pod-info");
  const bar = document.getElementById("pod-bar");
  const audio = document.getElementById("pod-audio");
  const titleEl = document.getElementById("pod-title");
  const showEl = document.getElementById("pod-show");
  const speedBtn = document.getElementById("pod-speed");

  let shows = [];
  let filter = "all";
  let savedIds = new Set();
  const downloading = new Map(); // id -> percent
  let current = null; // { ep, show }
  let objectUrl = null;

  // ---------- small helpers ----------
  const $ = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmtDur = (s) => {
    if (!s) return "";
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  };
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
  const fmtMB = (b) => (!b ? "" : b < 1e6 ? "under 1 MB" : `${Math.round(b / 1e6)} MB`);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ---------- IndexedDB ----------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("stream-podcasts", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("episodes", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function dbOp(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction("episodes", mode);
      const r = fn(tx.objectStore("episodes"));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const dbGet = (id) => dbOp("readonly", (s) => s.get(id));
  const dbPut = (rec) => dbOp("readwrite", (s) => s.put(rec));
  const dbDel = (id) => dbOp("readwrite", (s) => s.delete(id));
  const dbKeys = () => dbOp("readonly", (s) => s.getAllKeys());
  const dbAllMeta = async () => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const out = [];
      const req = d.transaction("episodes").objectStore("episodes").openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        const { blob, ...meta } = c.value;
        out.push({ ...meta, bytes: blob ? blob.size : 0 });
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  };

  // ---------- download ----------
  async function save(ep, show) {
    if (downloading.has(ep.id)) return;
    downloading.set(ep.id, 0);
    render();
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const res = await fetch(ep.url, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const total = +res.headers.get("content-length") || ep.size || 0;
      const chunks = [];
      let got = 0;
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (total) { downloading.set(ep.id, Math.min(99, Math.round((got / total) * 100))); updateProgress(ep.id); }
        }
      } else {
        chunks.push(new Uint8Array(await res.arrayBuffer()));
      }
      const blob = new Blob(chunks, { type: res.headers.get("content-type") || "audio/mpeg" });
      await dbPut({ id: ep.id, blob, ep, showId: show.id, showName: show.name, image: show.image, savedAt: Date.now() });
      savedIds.add(ep.id);
    } catch (err) {
      console.warn("Download failed", ep.url, err);
      alertInline(
        `Couldn't save "${ep.title}". This show's server doesn't let web apps download it. You can still tap ▶ to stream it with internet.`
      );
    } finally {
      downloading.delete(ep.id);
      render();
    }
  }
  async function removeSaved(ep) {
    if (current && current.ep.id === ep.id && !audio.paused) audio.pause();
    await dbDel(ep.id);
    savedIds.delete(ep.id);
    render();
  }
  function alertInline(msg) {
    infoEl.textContent = msg;
    infoEl.classList.add("warn");
    clearTimeout(alertInline.t);
    alertInline.t = setTimeout(() => { infoEl.classList.remove("warn"); updateInfo(); }, 9000);
  }

  // ---------- playback ----------
  const POS_KEY = "stream.pod.pos";
  async function play(ep, show) {
    current = { ep, show };
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    let src = ep.url;
    let offline = false;
    try {
      const rec = await dbGet(ep.id);
      if (rec && rec.blob) { objectUrl = URL.createObjectURL(rec.blob); src = objectUrl; offline = true; }
    } catch {}
    if (!offline && !navigator.onLine) {
      alertInline("You're offline and this episode isn't saved. Save episodes while you have Wi-Fi.");
      return;
    }
    audio.src = src;
    titleEl.textContent = ep.title;
    showEl.textContent = show.name + (offline ? " · saved on device" : " · streaming");
    bar.hidden = false;
    document.body.classList.add("has-podbar");
    const pos = store.get(POS_KEY, {})[ep.id];
    audio.addEventListener("loadedmetadata", () => {
      if (pos && pos < audio.duration - 10) audio.currentTime = pos;
    }, { once: true });
    audio.playbackRate = store.get("stream.pod.speed", 1);
    audio.play().catch(() => {});
    setMediaSession(ep, show);
    render();
  }

  // Remember where you stopped (every few seconds).
  let lastSave = 0;
  audio.addEventListener("timeupdate", () => {
    if (!current || Date.now() - lastSave < 5000) return;
    lastSave = Date.now();
    const all = store.get(POS_KEY, {});
    all[current.ep.id] = Math.floor(audio.currentTime);
    store.set(POS_KEY, all);
  });
  audio.addEventListener("ended", () => {
    if (!current) return;
    const all = store.get(POS_KEY, {});
    delete all[current.ep.id];
    store.set(POS_KEY, all);
    const done = store.get("stream.pod.done", {});
    done[current.ep.id] = true;
    store.set("stream.pod.done", done);
    render();
  });

  const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
  function showSpeed() { speedBtn.textContent = audio.playbackRate + "×"; }
  speedBtn.addEventListener("click", () => {
    const i = SPEEDS.indexOf(audio.playbackRate);
    audio.playbackRate = SPEEDS[(i + 1) % SPEEDS.length];
    store.set("stream.pod.speed", audio.playbackRate);
    showSpeed();
  });
  audio.addEventListener("ratechange", showSpeed);

  // Lock-screen / car Bluetooth controls
  function setMediaSession(ep, show) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ep.title,
      artist: show.name,
      artwork: show.image ? [{ src: show.image, sizes: "512x512" }] : [],
    });
    const skip = (s) => () => { audio.currentTime = Math.max(0, Math.min(audio.duration || 1e9, audio.currentTime + s)); };
    try {
      navigator.mediaSession.setActionHandler("play", () => audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("seekbackward", skip(-15));
      navigator.mediaSession.setActionHandler("seekforward", skip(30));
      navigator.mediaSession.setActionHandler("previoustrack", skip(-15));
      navigator.mediaSession.setActionHandler("nexttrack", skip(30));
    } catch {}
  }

  // ---------- rendering ----------
  function renderChips() {
    chipsEl.innerHTML = "";
    const opts = [["all", "All"], ["saved", "⬇ Saved"], ...shows.map((s) => [s.id, s.name])];
    for (const [id, label] of opts) {
      const b = $("button", "chip" + (filter === id ? " on" : ""), label);
      b.addEventListener("click", () => { filter = id; store.set("stream.pod.filter", id); render(); });
      chipsEl.append(b);
    }
  }

  async function updateInfo() {
    if (infoEl.classList.contains("warn")) return;
    let txt = "";
    if (savedIds.size) {
      const meta = await dbAllMeta().catch(() => []);
      const bytes = meta.reduce((a, m) => a + m.bytes, 0);
      txt = `${savedIds.size} episode${savedIds.size > 1 ? "s" : ""} saved · ${fmtMB(bytes) || "0 MB"} used on this device.`;
    }
    infoEl.textContent = txt;
  }

  function updateProgress(id) {
    const btn = listEl.querySelector(`[data-dl="${CSS.escape(id)}"]`);
    if (btn) btn.textContent = `${downloading.get(id)}%`;
  }

  async function episodesToShow() {
    if (filter === "saved") {
      const meta = await dbAllMeta().catch(() => []);
      return meta.sort((a, b) => b.savedAt - a.savedAt).map((m) => ({
        ep: m.ep,
        show: shows.find((s) => s.id === m.showId) || { id: m.showId, name: m.showName, image: m.image },
      }));
    }
    const pool = filter === "all" ? shows : shows.filter((s) => s.id === filter);
    const rows = pool.flatMap((show) => show.episodes.map((ep) => ({ ep, show })));
    rows.sort((a, b) => (b.ep.date || "").localeCompare(a.ep.date || ""));
    return filter === "all" ? rows.slice(0, 40) : rows;
  }

  const PAGE = 50;
  let limit = PAGE;
  let lastFilter = null;
  let renderToken = 0;
  async function render() {
    const token = ++renderToken;
    if (filter !== lastFilter) { limit = PAGE; lastFilter = filter; }
    renderChips();
    const allRows = await episodesToShow();
    if (token !== renderToken) return;
    const rows = allRows.slice(0, limit);
    listEl.innerHTML = "";
    const done = store.get("stream.pod.done", {});
    const pos = store.get(POS_KEY, {});

    if (!rows.length) {
      const msg = filter === "saved"
        ? "Nothing saved yet. Tap ⬇ Save on any episode."
        : shows.length ? "No episodes here." : "Episodes are being collected for the first time. Check back in a few minutes.";
      listEl.append($("li", "hint", msg));
    }

    for (const { ep, show } of rows) {
      const li = $("li");
      const row = $("div", "item ep" + (current && current.ep.id === ep.id ? " active" : ""));
      if (show.image) {
        const img = $("img", "cover"); img.src = show.image; img.alt = ""; img.loading = "lazy";
        row.append(img);
      } else {
        row.append($("span", "icon", "🎧"));
      }
      const txt = $("div", "txt");
      txt.append($("div", "name", ep.title));
      const bits = [show.name, fmtDate(ep.date), fmtDur(ep.duration)];
      if (pos[ep.id]) bits.push(`stopped at ${fmtDur(pos[ep.id]) || "<1 min"}`);
      if (done[ep.id]) bits.push("✓ finished");
      txt.append($("div", "desc", bits.filter(Boolean).join(" · ")));
      row.append(txt);

      const btns = $("div", "btns");
      const playB = $("button", "btn play", "▶");
      playB.title = "Play";
      playB.addEventListener("click", () => play(ep, show));
      btns.append(playB);

      if (downloading.has(ep.id)) {
        const b = $("button", "btn", `${downloading.get(ep.id)}%`);
        b.dataset.dl = ep.id; b.disabled = true;
        btns.append(b);
      } else if (savedIds.has(ep.id)) {
        const b = $("button", "btn saved", "✓ Saved");
        b.title = "Saved on this device. Tap to remove.";
        b.addEventListener("click", () => {
          if (confirmRemove(b)) removeSaved(ep);
        });
        btns.append(b);
      } else {
        const b = $("button", "btn", "⬇ Save");
        b.title = ep.size ? `Save for offline (${fmtMB(ep.size)})` : "Save for offline";
        b.addEventListener("click", () => save(ep, show));
        btns.append(b);
      }
      row.append(btns);
      li.append(row);
      listEl.append(li);
    }
    if (allRows.length > rows.length) {
      const li = $("li");
      const more = $("button", "chip more", `Show more (${allRows.length - rows.length} older episodes)`);
      more.addEventListener("click", () => { limit += PAGE; render(); });
      li.append(more);
      listEl.append(li);
    }
    updateInfo();
  }

  // Two-tap remove (no pop-up dialogs): first tap asks, second tap removes.
  function confirmRemove(btn) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1";
    btn.textContent = "Remove?";
    btn.classList.add("danger");
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = "✓ Saved"; btn.classList.remove("danger"); } }, 3000);
    return false;
  }

  // ---------- start ----------
  async function init() {
    filter = store.get("stream.pod.filter", "all");
    try { savedIds = new Set(await dbKeys()); } catch { savedIds = new Set(); }
    try {
      const data = await fetch("podcasts.json", { cache: "no-cache" }).then((r) => r.json());
      shows = data.shows || [];
    } catch {
      shows = [];
    }
    if (filter !== "all" && filter !== "saved" && !shows.some((s) => s.id === filter)) filter = "all";
    // With no internet, jump straight to saved episodes.
    if (!navigator.onLine && savedIds.size) filter = "saved";
    render();
  }
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  init();
})();

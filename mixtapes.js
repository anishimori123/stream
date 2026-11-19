// Mixtapes tab: official J.PERIOD links + your own audio files saved on this device.
// Files are stored in IndexedDB and play offline through the shared player bar (window.StreamPlayer).
(() => {
  const linksEl = document.getElementById("mix-links");
  const listEl = document.getElementById("mix-list");
  const infoEl = document.getElementById("mix-info");
  const fileInput = document.getElementById("mix-file");

  const $ = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmtMB = (b) => (b < 1e6 ? "under 1 MB" : `${Math.round(b / 1e6)} MB`);
  const fmtDur = (s) => {
    if (!s || !isFinite(s)) return "";
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  };

  // ---------- IndexedDB ----------
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open("stream-mixtapes", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("files", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction("files", mode);
      const r = fn(t.objectStore("files"));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = () => reject(t.error);
    });
  }
  const getAll = () => tx("readonly", (s) => s.getAll());
  const put = (rec) => tx("readwrite", (s) => s.put(rec));
  const del = (id) => tx("readwrite", (s) => s.delete(id));

  // Read the length of an audio file (so the list can show "1 h 12 min").
  function durationOf(blob) {
    return new Promise((resolve) => {
      const a = new Audio();
      const url = URL.createObjectURL(blob);
      const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
      a.preload = "metadata";
      a.onloadedmetadata = () => done(a.duration);
      a.onerror = () => done(0);
      setTimeout(() => done(0), 8000);
      a.src = url;
    });
  }

  // ---------- add files ----------
  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (!files.length) return;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    let added = 0;
    for (const f of files) {
      const isAudio = (f.type && f.type.startsWith("audio/")) || /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(f.name);
      if (!isAudio) { infoEl.textContent = `Skipped "${f.name}": not an audio file. (If it's a .zip, extract it first in the Files app.)`; continue; }
      infoEl.textContent = `Saving "${f.name}"…`;
      try {
        const duration = await durationOf(f);
        await put({
          id: "mix-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          title: f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " "),
          blob: f,
          size: f.size,
          duration,
          addedAt: Date.now(),
        });
        added++;
      } catch (err) {
        console.warn(err);
        infoEl.textContent = `Couldn't save "${f.name}". Your phone may be out of space.`;
      }
    }
    if (added) infoEl.textContent = "";
    render();
  });

  // ---------- render ----------
  function renderLinks(links) {
    linksEl.innerHTML = "";
    for (const l of links) {
      const li = $("li");
      const a = $("a", "item");
      a.href = l.url; a.target = "_blank"; a.rel = "noopener";
      a.append($("span", "icon", l.icon || "↗"));
      const t = $("span", "txt");
      t.append($("div", "name", l.name), $("div", "desc", l.desc || ""));
      a.append(t);
      li.append(a);
      linksEl.append(li);
    }
  }

  async function render() {
    let items = [];
    try { items = await getAll(); } catch { items = []; }
    items.sort((a, b) => b.addedAt - a.addedAt);
    listEl.innerHTML = "";
    if (!items.length) {
      listEl.append($("li", "hint", "No mixtapes yet. Tap ➕ Add audio file."));
    }
    const nowId = window.StreamPlayer && window.StreamPlayer.currentId();
    let total = 0;
    for (const it of items) {
      total += it.size || 0;
      const li = $("li");
      const row = $("div", "item ep" + (nowId === it.id ? " active" : ""));
      row.append($("span", "icon", "🎧"));
      const t = $("div", "txt");
      t.append($("div", "name", it.title), $("div", "desc", [fmtDur(it.duration), fmtMB(it.size || 0)].filter(Boolean).join(" · ")));
      row.append(t);
      const btns = $("div", "btns");
      const play = $("button", "btn play", "▶");
      play.title = "Play";
      play.addEventListener("click", () => {
        window.StreamPlayer && window.StreamPlayer.playBlob({ id: it.id, title: it.title, subtitle: "My mixtapes", blob: it.blob });
      });
      const rm = $("button", "btn", "Remove");
      rm.addEventListener("click", async () => {
        if (!rm.dataset.armed) {
          rm.dataset.armed = "1"; rm.textContent = "Sure?"; rm.classList.add("danger");
          setTimeout(() => { if (rm.isConnected) { delete rm.dataset.armed; rm.textContent = "Remove"; rm.classList.remove("danger"); } }, 3000);
          return;
        }
        window.StreamPlayer && window.StreamPlayer.stopIf(it.id);
        await del(it.id);
        render();
      });
      btns.append(play, rm);
      row.append(btns);
      li.append(row);
      listEl.append(li);
    }
    if (items.length && !infoEl.textContent.startsWith("Saving")) {
      infoEl.textContent = `${items.length} mixtape${items.length > 1 ? "s" : ""} · ${fmtMB(total)} used on this device.`;
    }
  }

  window.addEventListener("stream:nowplaying", render);

  fetch("channels.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => renderLinks(d.mixtapes || []))
    .catch(() => {});
  render();
})();

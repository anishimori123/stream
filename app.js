// Stream app — plays official Japan TV streams and keeps a learning list.
const APP_VERSION = "0.4.1";

const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const nowEl = document.getElementById("now");
let hls = null;
let currentId = null;

document.getElementById("ver").textContent = "v" + APP_VERSION;

// ---------- Tabs ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.tab === name))
  );
  document.getElementById("tab-tv").hidden = name !== "tv";
  document.getElementById("tab-learn").hidden = name !== "learn";
  document.getElementById("tab-pod").hidden = name !== "pod";
  document.getElementById("tab-mix").hidden = name !== "mix";
  if (name !== "tv") video.pause();
  try { localStorage.setItem("stream.tab", name); } catch {}
}

// ---------- Helpers ----------
function setStatus(msg) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("hide", !msg);
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function itemContent(node, icon, name, desc) {
  node.append(el("span", "icon", icon));
  const t = el("span", "txt");
  t.append(el("div", "name", name));
  if (desc) t.append(el("div", "desc", desc));
  node.append(t);
}

// ---------- Player ----------
const ytFrame = document.getElementById("yt-frame");
const ytLink = document.getElementById("yt-link");

function stopPlayer() {
  if (hls) { hls.destroy(); hls = null; }
  video.removeAttribute("src");
  video.load();
  ytFrame.src = "about:blank";
  ytFrame.hidden = true;
  ytLink.hidden = true;
  video.hidden = false;
}

// Official YouTube live channels play in YouTube's own embedded player.
function playYouTube(ch) {
  stopPlayer();
  setStatus("");
  video.hidden = true;
  ytFrame.hidden = false;
  ytFrame.src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(ch.channelId)}&autoplay=1&playsinline=1`;
  ytLink.href = ch.watchUrl || `https://www.youtube.com/channel/${ch.channelId}/live`;
  ytLink.hidden = false;
}

// Try each URL in order until one plays.
function playChannel(ch) {
  currentId = ch.id;
  nowEl.textContent = ch.name;
  document.querySelectorAll("#tv-list .item").forEach((n) =>
    n.classList.toggle("active", n.dataset.id === ch.id)
  );
  if (ch.type === "youtube") return playYouTube(ch);
  tryUrl(ch, 0);
}

function tryUrl(ch, i) {
  if (currentId !== ch.id) return; // user switched channel
  stopPlayer();
  if (i >= ch.urls.length) {
    setStatus("Can't play this channel right now. It may be offline or blocked in your country. Try another one.");
    return;
  }
  setStatus(`Loading ${ch.name}…` + (i > 0 ? ` (backup ${i})` : ""));
  const url = ch.urls[i];
  const next = () => tryUrl(ch, i + 1);
  const onPlaying = () => setStatus("");
  video.addEventListener("playing", onPlaying, { once: true });

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: false });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) { console.warn("Stream failed:", url, data.details); next(); }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => setStatus("Tap ▶ to start")));
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari / iPhone play HLS natively
    video.src = url;
    video.addEventListener("error", next, { once: true });
    video.play().catch(() => setStatus("Tap ▶ to start"));
  } else {
    setStatus("This browser can't play live TV. Try Chrome.");
  }
}

// ---------- Lists ----------
function renderTv(channels) {
  const list = document.getElementById("tv-list");
  list.innerHTML = "";
  channels.forEach((ch) => {
    const li = el("li");
    if (ch.type === "link") {
      const a = el("a", "item");
      a.href = ch.urls[0]; a.target = "_blank"; a.rel = "noopener";
      itemContent(a, "↗", ch.name, ch.desc);
      li.append(a);
    } else {
      const b = el("button", "item");
      b.dataset.id = ch.id;
      itemContent(b, ch.type === "youtube" ? "📺" : "▶", ch.name, ch.desc);
      b.addEventListener("click", () => {
        playChannel(ch);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      li.append(b);
    }
    list.append(li);
  });
}

function renderLearn(items) {
  const list = document.getElementById("learn-list");
  list.innerHTML = "";
  items.forEach((it) => {
    const li = el("li");
    const a = el("a", "item");
    a.href = it.url; a.target = "_blank"; a.rel = "noopener";
    itemContent(a, "🎓", it.name, it.desc);
    li.append(a);
    list.append(li);
  });
}

// "My list" is saved in this browser only (localStorage).
const MY_KEY = "stream.myList.v1";
function loadMine() {
  try { return JSON.parse(localStorage.getItem(MY_KEY)) || []; } catch { return []; }
}
function saveMine(arr) {
  try { localStorage.setItem(MY_KEY, JSON.stringify(arr)); } catch { /* storage blocked */ }
}
function renderMine() {
  const list = document.getElementById("my-list");
  list.innerHTML = "";
  const mine = loadMine();
  if (!mine.length) { list.append(el("li", "hint", "Nothing yet. Add your first video above.")); return; }
  mine.forEach((it, idx) => {
    const li = el("li");
    const wrap = el("div", "item");
    const a = el("a", "txt");
    a.href = it.url; a.target = "_blank"; a.rel = "noopener";
    a.style.color = "inherit"; a.style.textDecoration = "none";
    a.append(el("div", "name", it.name), el("div", "desc", it.url));
    const del = el("button", "del", "✕");
    del.title = "Remove";
    del.addEventListener("click", () => {
      const m = loadMine(); m.splice(idx, 1); saveMine(m); renderMine();
    });
    wrap.append(el("span", "icon", "★"), a, del);
    li.append(wrap);
    list.append(li);
  });
}
document.getElementById("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("add-name").value.trim();
  const url = document.getElementById("add-url").value.trim();
  if (!/^https?:\/\//i.test(url)) return;
  const m = loadMine(); m.push({ name, url }); saveMine(m);
  e.target.reset();
  renderMine();
});

// ---------- Start ----------
fetch("channels.json", { cache: "no-cache" })
  .then((r) => r.json())
  .then((data) => { renderTv(data.tv); renderLearn(data.learning); })
  .catch(() => setStatus("Couldn't load the channel list. Check your internet and refresh."));
renderMine();

// Reopen the last tab you used
try {
  const last = localStorage.getItem("stream.tab");
  if (last === "learn" || last === "pod" || last === "mix") showTab(last);
} catch {}

// Install as an app (PWA) + offline app shell
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

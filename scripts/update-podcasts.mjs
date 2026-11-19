// Fetches the public RSS feeds of the shows in podcasts-config.json
// and writes the latest episodes to podcasts.json.
// Runs on GitHub (see .github/workflows/podcasts.yml). Needs Node 18+ and no extra packages.
//
// Why on GitHub and not in the app? Most podcast feeds don't allow web pages to read them
// directly (a browser rule called CORS), but a server like GitHub's can.

import { readFile, writeFile } from "node:fs/promises";

const UA = "StreamApp-podcast-updater/1.0 (+https://github.com/anishimori123/stream)";
const config = JSON.parse(await readFile(new URL("../podcasts-config.json", import.meta.url), "utf8"));
const MAX = config.maxEpisodesPerShow || 12;

// ---------- tiny XML helpers (feeds are simple enough for this) ----------
const decode = (s = "") =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .trim();
const esc = (t) => t.replace(/[:]/g, "\\:");
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${esc(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc(name)}>`, "i"));
  return m ? decode(m[1]) : "";
}
function attr(xml, name, a) {
  const m = xml.match(new RegExp(`<${esc(name)}\\s[^>]*?\\b${a}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? decode(m[1]) : "";
}
const stripHtml = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function toSeconds(d) {
  if (!d) return 0;
  if (/^\d+$/.test(d)) return +d;
  return d.split(":").map(Number).reduce((acc, n) => acc * 60 + (n || 0), 0);
}

export function parseFeed(xml, max = MAX) {
  const channel = xml.split(/<item[\s>]/i)[0];
  const image = attr(channel, "itunes:image", "href") || tag(tag(channel, "image"), "url");
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const episodes = [];
  for (const it of items) {
    const url = attr(it, "enclosure", "url");
    const type = attr(it, "enclosure", "type");
    if (!url || (type && !/^audio\//i.test(type))) continue; // audio only
    const title = tag(it, "title");
    const pub = tag(it, "pubDate");
    episodes.push({
      id: (tag(it, "guid") || url).slice(0, 300),
      title,
      date: pub ? new Date(pub).toISOString() : null,
      duration: toSeconds(tag(it, "itunes:duration")),
      size: +attr(it, "enclosure", "length") || 0,
      url,
      summary: stripHtml(tag(it, "itunes:summary") || tag(it, "description")).slice(0, 280),
    });
    if (episodes.length >= max) break;
  }
  return { title: tag(channel, "title"), image, episodes };
}

async function findFeed(show) {
  if (show.feed) return show.feed;
  const u = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=10&term=${encodeURIComponent(show.search)}`;
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`podcast search failed (${res.status})`);
  const { results = [] } = await res.json();
  const hit = results.find((r) => r.feedUrl && r.collectionName?.toLowerCase().includes(show.match.toLowerCase()));
  if (!hit) throw new Error(`no show named like "${show.match}" in search results`);
  return hit.feedUrl;
}

// Keep last good data for a show if this run fails, so the app never goes empty.
let previous = { shows: [] };
try { previous = JSON.parse(await readFile(new URL("../podcasts.json", import.meta.url), "utf8")); } catch {}

const out = { updated: new Date().toISOString(), shows: [] };
for (const show of config.shows) {
  try {
    const feed = await findFeed(show);
    const res = await fetch(feed, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`feed download failed (${res.status})`);
    const parsed = parseFeed(await res.text(), show.keepAll ? Infinity : MAX);
    if (!parsed.episodes.length) throw new Error("feed had no audio episodes");
    let episodes = parsed.episodes;
    if (show.keepAll) {
      // Archive mode: keep every episode we've ever seen, even if the feed later drops old ones.
      const old = previous.shows?.find((s) => s.id === show.id)?.episodes || [];
      const byId = new Map(old.map((e) => [e.id, e]));
      for (const e of episodes) byId.set(e.id, e); // newest info wins
      episodes = [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    out.shows.push({ id: show.id, name: show.name, feed, image: parsed.image, keepAll: !!show.keepAll, episodes });
    console.log(`✓ ${show.name}: ${episodes.length} episodes${show.keepAll ? " (archive)" : ""} (${feed})`);
  } catch (err) {
    const old = previous.shows?.find((s) => s.id === show.id);
    if (old) out.shows.push(old);
    console.log(`✗ ${show.name}: ${err.message}${old ? " (kept previous episodes)" : ""}`);
  }
}

// Only rewrite the file if episodes changed (avoids pointless commits).
const strip = (o) => JSON.stringify(o.shows);
if (strip(out) === strip(previous)) {
  console.log("No changes.");
} else {
  await writeFile(new URL("../podcasts.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
  console.log("podcasts.json updated.");
}

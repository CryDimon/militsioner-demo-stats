// Collects one sample of Militsioner demo stats and appends it to data/history.json.
// Runs in GitHub Actions on a schedule (Node 20+, no dependencies).

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";

const DEMO_ID = 4627010; // Militsioner Demo
const GAME_ID = 1373530; // Militsioner
const KEEP_DAYS = 60;
const FILE = "data/history.json";

async function get(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function safe(name, fn) {
  try {
    return await fn();
  } catch (e) {
    console.log(`[${name}] failed: ${e.message}`);
    return null;
  }
}

// Players in the demo right now (official Steam Web API).
const demoPlayers = () =>
  safe("demo", async () => {
    const j = await (await get(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${DEMO_ID}`)).json();
    return j.response && j.response.result === 1 ? j.response.player_count : null;
  });

// Total Steam users logged in (official Steam stats, last point of the 48h series).
const steamTotal = () =>
  safe("steam", async () => {
    const j = await (await get("https://store.steampowered.com/stats/userdata.json")).json();
    const s = j.find((x) => /logged in/i.test(x.label)) || j[0];
    const last = s.data[s.data.length - 1];
    return { t: last[0], users: last[1], series: s.data };
  });

// Position in Steam's own "Top wishlisted" list (first 1000 places).
const wishlistRank = () =>
  safe("rank", async () => {
    for (let start = 0; start < 1000; start += 100) {
      const j = await (
        await get(`https://store.steampowered.com/search/results/?query&start=${start}&count=100&filter=popularwishlist&infinite=1&json=1`)
      ).json();
      const ids = [...(j.results_html || "").matchAll(/data-ds-appid="([\d,]+)"/g)].map((m) => m[1].split(","));
      const i = ids.findIndex((g) => g.includes(String(GAME_ID)));
      if (i >= 0) return start + i + 1;
      if (!ids.length) break;
    }
    return null;
  });

// Steam user reviews of the demo.
const reviews = () =>
  safe("reviews", async () => {
    const j = await (
      await get(`https://store.steampowered.com/appreviews/${DEMO_ID}?json=1&language=all&purchase_type=all&num_per_page=0`)
    ).json();
    const q = j.query_summary;
    return q ? { total: q.total_reviews, pos: q.total_positive, desc: q.review_score_desc } : null;
  });


// Twitch category "Militsioner" (Twitch's public web endpoint, no keys).
const twitch = () =>
  safe("twitch", async () => {
    const j = await (
      await get("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "text/plain" },
        body: JSON.stringify({ query: 'query{game(name:"Militsioner"){followersCount viewersCount broadcastersCount}}' }),
      })
    ).json();
    const g = j.data && j.data.game;
    return g ? { viewers: g.viewersCount || 0, channels: g.broadcastersCount || 0, followers: g.followersCount || 0 } : null;
  });

const [demo, steam, rank, rev, tw] = await Promise.all([
  demoPlayers(),
  steamTotal(),
  wishlistRank(),
  reviews(),
  twitch(),
]);

const row = {
  t: Date.now(),
  demo,
  steam: steam ? steam.users : null,
  rank,
  rev_total: rev ? rev.total : null,
  rev_pos: rev ? rev.pos : null,
  rev_desc: rev ? rev.desc : null,
  tw_viewers: tw ? tw.viewers : null,
  tw_channels: tw ? tw.channels : null,
  tw_followers: tw ? tw.followers : null,
};
console.log(JSON.stringify(row));

await mkdir("data", { recursive: true });
let history = [];
try {
  history = JSON.parse(await readFile(FILE, "utf8"));
} catch {}
history.push(row);

// One-off back-fill: merge data/backfill.json (e.g. SteamDB export) into history, then remove it.
try {
  const extra = JSON.parse(await readFile("data/backfill.json", "utf8"));
  const near = (t) => history.some((r) => r.src !== "steamdb" && Math.abs(r.t - t) < 5 * 60e3);
  const have = new Set(history.map((r) => r.t));
  for (const r of extra) if (!have.has(r.t) && !near(r.t)) history.push(r);
  await unlink("data/backfill.json");
  console.log(`merged back-fill: ${extra.length} rows`);
} catch {}

// Fill missing "steam" values (e.g. back-filled demo samples) from Steam's 48h series.
if (steam && steam.series) {
  const ser = steam.series;
  for (const r of history) {
    if (r.steam != null || r.t < ser[0][0] || r.t > ser[ser.length - 1][0] + 15 * 60e3) continue;
    let best = ser[0];
    for (const p of ser) if (Math.abs(p[0] - r.t) < Math.abs(best[0] - r.t)) best = p;
    r.steam = best[1];
  }
}
history.sort((a, b) => a.t - b.t);
// Survey figures are not published.
for (const r of history) { delete r.sv_n; delete r.sv_avg; }
const cutoff = Date.now() - KEEP_DAYS * 864e5;
history = history.filter((r) => r.t >= cutoff);
await writeFile(FILE, JSON.stringify(history));

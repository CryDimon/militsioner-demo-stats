# Militsioner Demo stats

Public live dashboard for the Militsioner Steam demo (TallBoys, publisher Critical Reflex).
Page: https://crydimon.github.io/militsioner-demo-stats/ — shared with the team, open to anyone with the link.

- Demo app id: `4627010` (Militsioner Demo)
- Main game app id: `1373530` (Militsioner)
- Owner talks Russian; the page itself is in English.

## How it works

```
collect.mjs  ──(GitHub Action loop, every 10 min)──▶  data/*.json  (committed to main by "stats-bot")
index.html   ──(Pages workflow, on change)──────────▶  GitHub Pages
browser      ──fetch──▶  raw.githubusercontent.com/CryDimon/militsioner-demo-stats/main/data/*.json
```

- `.github/workflows/collect.yml` — **one run collects in a loop** (every 10 min for ~5.5 h), then
  re-dispatches itself (`gh workflow run`). GitHub's `schedule` is best-effort and skipped every run
  for hours on this repo, so the hourly cron is only a watchdog. Don't "simplify" this back to a
  plain `*/10` cron. Concurrency group `collect` keeps a single loop alive.
- `.github/workflows/pages.yml` — deploys only `index.html`. Data is NOT copied into Pages; the page
  reads it from raw.githubusercontent.com (CORS `*`, ~5 min CDN cache, cache-busted with `?ts=`).
- `index.html` — single self-contained file, no build step, no dependencies. Hand-written SVG charts
  (line + stacked bar), hover tooltips, light/dark tokens on `:root`, range toggle 24h / 7d / All.
- `collect.mjs` — Node 20, no dependencies. Each source is wrapped in `safe()`; a failing source
  writes `null` and its error lands in `data/live.json → errors`.

## Data files

- `data/history.json` — array of samples, kept 60 days, sorted by `t` (ms, UTC):
  `t, demo, steam, rank, rev_total, rev_pos, rev_desc, tw_viewers, tw_channels, tw_followers, followers`.
  Rows with `src: "steamdb"` are a one-off back-fill of demo players (8–10 Oct) from a SteamDB CSV export;
  their `steam` was filled from Steam's 48h series.
- `data/reviews.json` — every Steam review of the demo, re-fetched each run:
  `{updated, topics[], items: [{t, up, lang, at, fo, deck, tags[]}]}` (`at` = playtime at review, `fo` = playtime forever, minutes).
- `data/reviews-daily.json` — `{updated, days: [[t, up, down]]}`, one row per UTC day; each run merges the
  histogram's last ~30 days in (newer counts win), so older days are kept.
- `data/live.json` — current Twitch streams in the category + per-source errors.
- `data/steamdb-daily.json` — static daily series (followers, Twitch peak viewers) from SteamDB CSV exports.
- `data/launches.json` — static list of other launches the page compares the demo with ("days since launch" chart,
  each one a toggle chip): `[{id, name, label, app_id, launch, default, source, daily_peak: [[t, v]]}]`
  (`launch` = launch day 00:00 UTC in ms, `default` = shown before the viewer toggles). Built from SteamDB CSV exports.
  Now (first 60 days at most; the chart shows the first 30 or as many as the demo has):
  Militsioner Playtest (app `2101830`, public 20 Aug → 18 Sep 2025, on by default);
  No, I'm not a Human demo (app `3640000`, from 8 Jun 2025 — the series starts at its peak, so earlier
  launch days may be missing; the app is no longer served by the Steam store API);
  The Lift Playtest (app `3916290`), two waves: 16 Sep 2025 and 12 Jun 2026.
- `data/backfill.json` (temporary) — if present, `collect.mjs` merges it into history once and deletes it.
  Use this for any future back-fill instead of editing `history.json` by hand (avoids racing the bot).

## Sources

| Field | Source |
|---|---|
| demo players | `api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=4627010` |
| Steam users online | `store.steampowered.com/stats/userdata.json` (48h series, "Steam users logged in") |
| wishlist rank | position in `store.steampowered.com/search/results/?filter=popularwishlist&json=1` (pages of 100, first 1000) |
| review count / score | `api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=…include_reviews` → `summary_filtered` (`rev_pos` = count × percent, rounded) |
| reviews per day | `store.steampowered.com/appreviewhistogram/4627010` → `results.recent` (last ~30 days, UTC) |
| individual reviews | `store.steampowered.com/appreviews/4627010?json=1&…` — **redirects to the store front page since 22 Oct 2026**; still tried each run, `reviews.json` is only rewritten when it answers |
| followers | `steamcommunity.com/games/1373530/memberslistxml/?xml=1` → `<memberCount>` (needs a User-Agent header) |
| Twitch | `gql.twitch.tv/gql` with Twitch's public web Client-ID — unofficial; may break. Official Helix API needs keys the owner would have to create |

All Steam endpoints block browser CORS, which is why collection happens server-side.

Page visitors (header line "N watching now · N page views · N visitors") come from the browser itself via
`abacus.jasoncameron.dev` (free, no account, CORS `*`, 30 req / 10 s per IP), namespace `militsioner-demo-stats`:
`views` (+1 per page load), `people` (+1 once per browser, flag in localStorage), `live-<5-min slot>`
(+1 per visible tab per slot; "watching now" = max of current and previous slot). Only `*.github.io`
counts — local previews only read. Counts are public and can be bumped by anyone, so treat them as rough.

## Rules

- **SteamDB parsing is allowed** (owner's decision, 10 Oct 2026). SteamDB has no API and sits behind
  Cloudflare: plain requests get `403` (checked 10 Oct 2026). Use only requests SteamDB answers normally —
  no Cloudflare/captcha bypass, headless-browser tricks or borrowed cookies. Until a plain endpoint works,
  SteamDB data enters via CSV files the owner exports from the charts' "Download CSV" menu.
- **The player survey (zite.so) is not published.** It was removed on purpose — don't add survey
  numbers back to the page or to `data/`.
- **No review texts or reviewer identities** in `data/` — only numbers, language and topic tags.
- The repo and page are public: anything committed is world-readable, including git history.
- Commits by the owner/Claude must not touch `data/history.json` directly (the bot rewrites it every 10 min).

## Working locally

```bash
node collect.mjs                 # collects one sample into ./data (writes files; don't commit them by hand)
python3 -m http.server 8000      # open http://localhost:8000 — the page still reads live data from GitHub raw
```

To preview the page against local data, temporarily point `DATA_BASE` in `index.html` to `"data/"`.
Check after changes: light + dark theme, 390px width (no horizontal scroll), hover tooltips, empty states.

## Ideas not done yet

- Steamworks exports (wishlist adds per day, demo unique users, median playtime of all players, traffic sources)
  — no free public API; would come as CSV files the owner uploads, merged like the SteamDB back-fill.
- Topic tagging of reviews only covers English and Russian keywords.

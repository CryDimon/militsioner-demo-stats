# Militsioner Demo stats

Live dashboard for the Militsioner Steam demo: https://crydimon.github.io/militsioner-demo-stats/

A GitHub Action collects one sample every ~10 minutes (`collect.mjs` → `data/*.json`) and the page
(`index.html`, published with GitHub Pages) reads the data straight from this repo.

Sources: Steam Web API (demo players), Steam stats (users online), Steam "Top wishlisted" list,
Steam reviews of the demo, Steam community (followers), Twitch category. See `CLAUDE.md` for details.

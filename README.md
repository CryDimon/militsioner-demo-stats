# Militsioner Demo stats

Live dashboard for the Militsioner Steam demo. A GitHub Action collects one sample every ~10 minutes
(`collect.mjs` → `data/history.json`) and publishes `index.html` to GitHub Pages.

Sources: Steam Web API (demo players), Steam stats (users online), Steam "Top wishlisted" list,
Steam reviews of the demo, the player survey dashboard (aggregates only), Twitch category.

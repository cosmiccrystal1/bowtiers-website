- 2026-10-10: Classic Bow retains slug `bow`. site/config.js optionally selects a public feed, browsers refresh every 60s without resetting search/list and retain last data on failure. scripts/publish-rankings.ps1 exports allowlisted public JSON and uploads only that file to R2 using a local AWS profile; scripts/feed-worker.js serves only /tiers.json. LIVE-RANKINGS.md covers optional Windows/Worker/R2 setup. Do not upload secrets or fabricated sample data.

# BowTiers public website

- This is the public repository `cosmiccrystal1/bowtiers-website`, publishing `site/` to GitHub Pages at bowtiers.com (domain registered at Porkbun).
- The private bots repository is `cosmiccrystal1/bowtiers-bots`. Its current local checkout is the sibling `../bowtiers/` directory. Never copy its `.env`, server/role configuration, member snapshots, account links, or audit data here.
- Website code is independent of the private repository. The exporter reads only tier lists, Minecraft player identities and rankings from the separate BowTiers MySQL database using SELECT queries. It must not need a GitHub token for the private bots repository.
- Tier lists: Classic Bow, Streetfight, Totem Race, Iron, Crossbow, Speed Archer and Aerial. No fabricated players.
- Preserve `site/assets/bowtiersLogo.png`, provided by the user. Publish only site/ as the Pages artifact.
- Public data schema version 1 contains only generatedAt, tierLists with slug/name/description/inviteUrl and players with uuid/username/tier. Never serialize private columns even if query results contain them.
- Use `npm run check`, `npm test` and a local browser check for UI changes. Database connection credentials belong in ignored `.env` or GitHub Actions secrets; prefer a database user restricted to SELECT on the three public source tables.
- No subagents unless explicitly requested. Do not expose private repository history in this public repository.

- Overall defaults to a deduplicated Minecraft player roster ranked by summed points with all tier placements. The optional top-level public `players` array exposes only uuid/username, including unranked bt_players identities. Never export account-link or Discord IDs. Points HT1/LT1/HT2/LT2/HT3/LT3/HT4/LT4/HT5/LT5: 40/30/20/15/10/6/4/3/2/1. Ties share competition ranks; search preserves ranks.
- Tier selector images are optional site/assets/<tier-list-slug>.png files; Overall has no icon. Keep the seven lists in the user-requested order.


- User-authorized sample players are local-preview-only: scripts/sample-data.js feeds the preview server without editing site/data or MySQL. Do not publish fabricated rankings. Player profiles use the exported username/placements and Crafty bust images keyed by Minecraft UUID.

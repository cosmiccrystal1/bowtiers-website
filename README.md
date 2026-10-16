# BowTiers website

Follow [LAUNCH.md](LAUNCH.md) for the complete first-publish, GitHub Actions secrets, Porkbun DNS and HTTPS walkthrough.

Public website for **bowtiers.com**, hosted by GitHub Pages from [cosmiccrystal1/bowtiers-website](https://github.com/cosmiccrystal1/bowtiers-website).

The bots live separately in the private `cosmiccrystal1/bowtiers-bots` repository. This repository needs no access to that repository, no Discord bot token, and no Discord server/role IDs. Only `site/` is uploaded as a Pages artifact.

Rankings export through GitHub Actions, triggered every minute by the configured hosted cron service. The workflow publishes public JSON to the separate `rankings-data` branch and verifies that the live feed serves it. GitHub Pages hosts the website; open pages check the data feed every 60 seconds without waiting for another Pages deployment. Follow [LIVE-RANKINGS.md](LIVE-RANKINGS.md) for setup and troubleshooting. No Cloudflare service or Windows publishing task is needed.

## Local use

```powershell
git clone https://github.com/cosmiccrystal1/bowtiers-website.git
Set-Location bowtiers-website
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run preview
```

Open `http://127.0.0.1:4173`. The checked-in starting data lists Classic Bow, Streetfight, Totem Race, Iron, Crossbow, Speed Archer and Aerial with no invented rankings. Your supplied PNG logo is preserved in `site/assets/bowtiersLogo.png`.

To test a live export locally, copy `.env.example` to `.env`, configure a read-only connection to the **new BowTiers database**, and run `npm.cmd run export`. Never commit that `.env`. The bot project owns schema migrations; this exporter creates or updates no database tables.

## GitHub Pages setup

1. In this repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Under **Settings → Secrets and variables → Actions**, add these **repository secrets**: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`. They are not copied over automatically from the old repository or your PC. Prefer a database account with SELECT only on `bt_tier_lists`, `bt_players`, `bt_rankings`, `bt_rank_regions`, `bt_player_regions` and `bt_ranking_exclusions` if Shockbyte allows additional users.
3. Add the repository variable `MYSQL_SSL` as `true` when the endpoint supports TLS, otherwise `false`. For a private CA, adapt the workflow to write the certificate from a secret and set `MYSQL_SSL_CA_FILE` to that temporary file; do not disable certificate verification.
4. First apply the bot repository's database migrations and `db:seed`. Confirm Shockbyte allows GitHub-hosted runner connections. If the host requires fixed source IPs, use an appropriate controlled export runner instead.
5. Run **Export rankings and deploy Pages** from the Actions tab on `main`, selecting **Also deploy website files** for the first launch. Future pushes to `main` affecting site/export files export fresh data and deploy Pages. Manual/hosted-cron dispatches refresh data only unless that checkbox is selected. The hosted job is configured separately; publishing the workflow alone does not create a timer.

The **Refresh public rankings** job checks the code, runs tests, exports from MySQL and publishes/verifies the public feed. It has its own concurrency lock and no Pages environment gate. The separate **Deploy website files** job deploys `site/` on source pushes or explicit manual requests; a waiting Pages job cannot block minute exports. The publisher's built-in `GITHUB_TOKEN` has repository `contents: write` and updates only the reserved `rankings-data` branch. No additional token secret is required. This branch contains only `tiers.json`, starts with an independent root commit and advances without changing `main`. Keep Pages source set to **GitHub Actions**, not this data branch. Missing secrets or export failures preserve the previous feed and stop deployment. A later Pages failure does not undo a verified feed publication.

## Custom domain and the repository rename

`site/CNAME` is `bowtiers.com`. Set **bowtiers.com** as the custom domain in **this repository's** Pages settings. If the original now-private repository still has Pages enabled, disable its Pages deployment/unpublish the old site and remove its custom-domain binding before claiming the same domain here. Custom-domain settings do not migrate just because a repository is renamed or another is created.

Porkbun records remain account-based:

| Type | Host | Value |
| --- | --- | --- |
| A | apex (blank) | `185.199.108.153` |
| A | apex (blank) | `185.199.109.153` |
| A | apex (blank) | `185.199.110.153` |
| A | apex (blank) | `185.199.111.153` |
| CNAME | `www` | `cosmiccrystal1.github.io` |

The CNAME points to the account, not `bowtiers-website.git` or a repository URL. Preserve unrelated email/TXT records. Verify the domain with GitHub's supplied TXT record if needed, then enable **Enforce HTTPS** after GitHub validates DNS and provisions the certificate.

References: [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Porkbun guide](https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages).

## Data boundary

The exporter starts a read-only transaction and selects an allowlist of public fields. Public JSON schema version 1 exposes tier-list names/slugs/descriptions/invite URLs and player Minecraft UUIDs/usernames/tiers, plus an optional NA/EU/null region. It omits staff assignments, Discord user IDs, account links, tickets, audit records, restriction details and credentials. Browser code fetches only the public [rankings feed](https://raw.githubusercontent.com/cosmiccrystal1/bowtiers-website/rankings-data/tiers.json); it never connects directly to MySQL. The publisher refuses extra fields, samples and undated placeholders before making any GitHub write.

Before deploying this exporter, apply bot migration **011-regions-and-ranking-visibility.sql** and extend any table-limited exporter account's SELECT grants to the three new public source tables above. Region selection happens in Discord tier servers via required onboarding or the testing modal. Each tier view uses its own region, while Overall uses the most recent selection across servers. Historical selections with no timestamp leave Overall unknown until a new choice. Individual rows have expanding red NA / green EU / gray unknown stripes; Overall has a Region column. Old feeds without region fields still work.

Active `/restrict` UUID snapshots are excluded from both the roster and every list until expiry; command bans are excluded indefinitely. The exporter queries only UUID/deadline data, never private Discord punishment records. Stored ranks and history remain intact and expired exclusions return on the next export. After publishing the website's feed configuration once, visibility changes wait for a successful export/feed publication and browser refresh. If the new schema/grants are missing, the workflow fails and preserves the prior feed/site.

## Independent updates

Website changes: commit/push to this repository's `main` branch. Bot changes: commit/push to the private bots repository, and promote to its `bot-live` branch when ready. Website deployment does not restart the Discord bots, and bot deployment does not publish website source.

## Ranking views and tier-list images

Overall is the default view. It lists each Minecraft player in `bt_players` once, including players with no published rank, and displays placements across the seven lists. Its count label is **Verified Players**. Overall sums points across the seven lists and sorts highest first: HT1=40, LT1=30, HT2=20, LT2=15, HT3=10, LT3=6, HT4=4, LT4=3, HT5=2, LT5=1. Unranked players have zero points. Ties share competition ranks (1, 1, 3), ordered alphabetically within the tie. Searching preserves the original overall rank. Bow Grandmaster requires first place and **more than 150 points**, the Bow Master threshold; first place alone does not grant it. `?list=bow` (or another list slug) opens that specific list. Header search filters either view immediately.

Upload PNG icons into `site/assets/` with these exact filenames: `bow.png`, `streetfight.png`, `totem-race.png`, `iron.png`, `crossbow.png`, `speed-archer.png`, and `aerial.png`. Transparent square images work best and display at 24 × 24 pixels before each selector label. Missing images are hidden until supplied; Overall has no icon. Commit and publish the images with the website assets.

The public snapshot also includes a top-level `players` array containing only Minecraft UUIDs, usernames and NA/EU/null region. It does not export Discord account links or selection timestamps. Older snapshots without this array still show all players found in published rankings.


## Local sample players and profiles

`npm run preview` now serves ten clearly marked sample players from `scripts/sample-data.js` at the preview data endpoint. Every list contains HT1 through LT5. Samples are outside `site/`, never write the database, and are not included in the Pages artifact. To preview your exported real data instead, use `npm run preview -- --live`. Restart an already-running preview process to activate sample mode; opening index.html directly is not supported because modules and JSON need a local HTTP server.

Click a player in Overall or an individual list to open a keyboard-accessible profile with the latest Minecraft username recorded in the exported database, overall points/rank, and all seven tier placements. Unranked placements show zero points. Hover, tap, or keyboard-focus a tier for its point contribution. Escape, Close, or clicking the backdrop closes the dialog and restores focus.

Skin busts use the documented [Crafty Skin Service](https://crafty.gg/skin-service) URL `https://render.crafty.gg/3d/bust/<uuid>?width=96&height=96`, displayed at 40px beside usernames. Profiles request a larger render. Images lazy-load with an initials fallback on failure. Sample identities use Alex/Steve preview skins; real players use their Minecraft UUID. Skin requests go directly from the visitor's browser to Crafty; no API credentials are needed.

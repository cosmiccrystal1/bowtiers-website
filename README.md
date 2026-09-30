# BowTiers website

Follow [LAUNCH.md](LAUNCH.md) for the complete first-publish, GitHub Actions secrets, Porkbun DNS and HTTPS walkthrough.

Public website for **bowtiers.com**, hosted by GitHub Pages from [cosmiccrystal1/bowtiers-website](https://github.com/cosmiccrystal1/bowtiers-website).

The bots live separately in the private `cosmiccrystal1/bowtiers-bots` repository. This repository needs no access to that repository, no Discord bot token, and no Discord server/role IDs. Only `site/` is uploaded as a Pages artifact.

## Local use

```powershell
git clone https://github.com/cosmiccrystal1/bowtiers-website.git
Set-Location bowtiers-website
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run preview
```

Open `http://127.0.0.1:4173`. The checked-in starting data lists Bow, Streetfight, Totem Race, Iron, Crossbow, Speed Archer and Aerial with no invented rankings. Your supplied PNG logo is preserved in `site/assets/bowtiersLogo.png`.

To test a live export locally, copy `.env.example` to `.env`, configure a read-only connection to the **new BowTiers database**, and run `npm.cmd run export`. Never commit that `.env`. The bot project owns schema migrations; this exporter creates or updates no database tables.

## GitHub Pages setup

1. In this repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Under **Settings → Secrets and variables → Actions**, add these **repository secrets**: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`. They are not copied over automatically from the old repository or your PC. Use a database account with SELECT access only to `bt_tier_lists`, `bt_players` and `bt_rankings` if Shockbyte allows additional users.
3. Add the repository variable `MYSQL_SSL` as `true` when the endpoint supports TLS, otherwise `false`. For a private CA, adapt the workflow to write the certificate from a secret and set `MYSQL_SSL_CA_FILE` to that temporary file; do not disable certificate verification.
4. First apply the bot repository's database migrations and `db:seed`. Confirm Shockbyte allows GitHub-hosted runner connections. If the host requires fixed source IPs, use an appropriate controlled export runner instead.
5. Run **Export rankings and deploy Pages** from the Actions tab. Future pushes to `main` affecting site/export files, manual runs and scheduled runs (approximately every 15 minutes) deploy fresh public data.

The workflow checks the code, runs tests, exports from MySQL and deploys `site/`. Missing secrets or export failures stop deployment, preserving any previous working site. Configure the database before the first deployment; otherwise that first run will fail visibly.

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

The exporter starts a read-only transaction and selects an allowlist of public fields. Public JSON schema version 1 exposes tier-list names/slugs/descriptions/invite URLs and player Minecraft UUIDs/usernames/tiers. It omits staff assignments, Discord user IDs, account links, tickets, audit records and credentials. Browser code fetches only `site/data/tiers.json`; it never connects directly to MySQL.

## Independent updates

Website changes: commit/push to this repository's `main` branch. Bot changes: commit/push to the private bots repository, and promote to its `bot-live` branch when ready. Website deployment does not restart the Discord bots, and bot deployment does not publish website source.

## Ranking views and tier-list images

Overall is the default view. It lists each Minecraft player in `bt_players` once, including players with no published rank, and displays placements across the seven lists. Overall sums points across the seven lists and sorts highest first: HT1=40, LT1=30, HT2=20, LT2=15, HT3=10, LT3=6, HT4=4, LT4=3, HT5=2, LT5=1. Unranked players have zero points. Ties share competition ranks (1, 1, 3), ordered alphabetically within the tie. Searching preserves the original overall rank. `?list=bow` (or another list slug) opens that specific list. Header search filters either view immediately.

Upload PNG icons into `site/assets/` with these exact filenames: `bow.png`, `streetfight.png`, `totem-race.png`, `iron.png`, `crossbow.png`, `speed-archer.png`, and `aerial.png`. Transparent square images work best and display at 24 × 24 pixels before each selector label. Missing images are hidden until supplied; Overall has no icon. Commit and publish the images with the website assets.

The public snapshot also includes a top-level `players` array containing only Minecraft UUIDs and usernames. It does not export Discord account links. Older snapshots without this array still show all players found in published rankings.


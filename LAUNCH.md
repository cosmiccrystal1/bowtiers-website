# Launch bowtiers.com from GitHub Pages

Use the public **cosmiccrystal1/bowtiers-website** repository. The private bots repository is separate. These steps run from your development computer/browser; you do not need to change Windows Task Scheduler or forward ports on the bot host.

## 1. Prepare the database export

The existing workflow needs a successful database export before it publishes. The running bots should already have applied the BowTiers migrations and seeded the seven lists. Use that **BowTiers database**, not Streetfight's original database.

In [the website repository](https://github.com/cosmiccrystal1/bowtiers-website), open **Settings → Secrets and variables → Actions → New repository secret**. Add separately:

| Secret | Value |
| --- | --- |
| MYSQL_HOST | Shockbyte database hostname |
| MYSQL_PORT | Port supplied by Shockbyte (often 3306) |
| MYSQL_DATABASE | Separate BowTiers database name |
| MYSQL_USER | Database username; prefer a SELECT-only account |
| MYSQL_PASSWORD | That database user's password |

Use SELECT permissions on `bt_tier_lists`, `bt_players`, `bt_rankings`, `bt_rank_regions`, `bt_player_regions` and `bt_ranking_exclusions` if your hosting plan allows a separate database user. Apply bot migration **011** before deploying the updated exporter. These values must be GitHub **secrets**, never files in the public repository. Do not add Discord tokens or a token for the private bot repository.

On the **Variables** tab, add `MYSQL_SSL`: `true` if the database endpoint supports verified TLS, otherwise the host's supported setting. If a private CA is required, the workflow needs the CA file configured as described in README.md.

Shockbyte must allow connections from the GitHub Actions runner, not just from your bot PC. If export logs show connection timeout/access denied, verify the database endpoint, credentials and permitted remote connections with Shockbyte. If the host requires a fixed source IP, stop here and use a controlled export runner design; DNS changes cannot fix database access.

## 2. Select Pages source

Open **Settings → Pages → Build and deployment → Source → GitHub Actions**. This project supplies its own deployment workflow; do not select a branch/root folder or create a second starter workflow. See [GitHub publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 3. Publish the prepared website files

The local website assets currently need their own commit/push. In PowerShell on the development computer, run each command separately and stop if it fails:

```powershell
Set-Location C:\Users\thecu\Downloads\codex\bowtiers-website
npm.cmd ci
npm.cmd run check
npm.cmd test
git status
git add .
git diff --cached --stat
git commit -m "Add BowTiers public website and Pages deployment"
git push origin main
```

The existing `.gitignore` excludes `.env`, node_modules and local artifacts. Review the staged filenames; only website files belong here. Do not copy the private bots Git history into this repository. If a push is rejected as non-fast-forward, integrate the remote changes before retrying; do not force push.

## 4. Confirm deployment

Open **Actions → Export rankings and deploy Pages**. Check that installation, tests, Export public rankings and Deploy all succeed. Use **Run workflow → main** to rerun after changing secrets/settings. The default URL is [cosmiccrystal1.github.io/bowtiers-website/](https://cosmiccrystal1.github.io/bowtiers-website/) before assigning a custom domain.

This workflow uploads only `site/`. It runs on relevant pushes, manual requests and a five-minute schedule (GitHub can delay schedules, and deployments take additional time). No Cloudflare service or Windows publishing task is needed. Export failure preserves any prior deployment; the first run cannot produce a live site until export succeeds. An empty leaderboard is expected if there are no recorded rankings.

## 5. Verify and assign the domain on GitHub

Recommended: open your personal GitHub **Settings → Pages → Add a domain**, enter `bowtiers.com`, and follow the supplied TXT verification instructions in Porkbun. Use GitHub's exact host/token, then Verify and keep the record. See [domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

If the old `bowtiers-bots` repository still claims `bowtiers.com`, remove its Pages custom domain/unpublish the old Pages site first. In **bowtiers-website → Settings → Pages → Custom domain**, enter **bowtiers.com** and Save. Do this before pointing web DNS at GitHub. The bundled `site/CNAME` is not sufficient: custom Actions deployments use the repository's Pages domain setting. See [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## 6. Configure Porkbun DNS

Log into Porkbun, open **Domain Management → bowtiers.com → Details → DNS Records → Edit** (or the domain's DNS shortcut). These instructions assume Porkbun is your authoritative DNS provider; if you changed nameservers, make the equivalent edits at that DNS provider.

Add these records, leaving the Host blank for the root domain:

| Type | Host | Answer |
| --- | --- | --- |
| A | blank | 185.199.108.153 |
| A | blank | 185.199.109.153 |
| A | blank | 185.199.110.153 |
| A | blank | 185.199.111.153 |
| CNAME | www | cosmiccrystal1.github.io |

Use Porkbun's default TTL. Replace conflicting parking/forwarding A, ALIAS or CNAME records for the root and www; remove obsolete web AAAA records pointing elsewhere. Keep unrelated MX/email/TXT records and the GitHub verification TXT record. Do not enter https://, a repository name, or `/bowtiers-website` in the CNAME answer.

Porkbun also offers **Quick DNS Config → GitHub**, followed by a www CNAME using your GitHub username. Inspect proposed replacements if you use that shortcut. See [Porkbun's instructions](https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages).

## 7. Enable HTTPS and verify

Return to the website repository's Pages settings and wait for DNS validation/certificate issuance, then enable **Enforce HTTPS**. DNS and certificate availability can take up to 24 hours. Check [bowtiers.com](https://bowtiers.com) and [www.bowtiers.com](https://www.bowtiers.com); www should redirect to the configured apex domain.

Optional Windows checks:

```powershell
Resolve-DnsName bowtiers.com -Type A
Resolve-DnsName www.bowtiers.com -Type CNAME
```

The A results should match the table and www should resolve through cosmiccrystal1.github.io. If a restrictive CAA record already exists, GitHub's certificate authority must be permitted; follow GitHub's custom-domain troubleshooting rather than deleting unrelated DNS records. No Porkbun web hosting purchase is required for GitHub Pages.

Subsequent website updates are ordinary commits/pushes to this repository's `main`; database rankings refresh through Actions. Bot updates still use the private repository's `bot-live` branch independently.

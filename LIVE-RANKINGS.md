# Scheduled rankings updates

## Selected setup: GitHub Actions every five minutes

The selected deployment uses GitHub Actions' built-in schedule, `2-59/5 * * * *`, to export current rankings from MySQL and publish the GitHub Pages website. It requests runs at minutes 2, 7, 12, …, 57 each hour, avoiding common clock-boundary peaks while retaining five-minute intervals. No Cloudflare account, external cron service, Windows publishing task or additional hosting is required. Open browser pages continue checking for updated JSON every 60 seconds.

1. Publish `.github/workflows/pages.yml` and these documentation changes to `main` in `cosmiccrystal1/bowtiers-website`. Scheduled workflows run from the repository's default branch; confirm that it is `main`.
2. In the repository's **Settings → Pages**, keep **Source: GitHub Actions**. Keep the existing `bowtiers.com` custom domain.
3. Under **Settings → Secrets and variables → Actions**, retain the working export secrets: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`. These connect to the Discord/rankings database, not the regional Paper database. Preserve the existing `MYSQL_SSL` Actions variable if configured. Database access should be limited to SELECT on the public source tables where possible.
4. Keep `site/config.js` set to `export const RANKINGS_URL = './data/tiers.json';`. This reads the freshly deployed Pages data rather than an external feed.
5. Open **Actions → Export rankings and deploy Pages → Run workflow**, choose `main`, and run once. Confirm the export and Pages deployment both succeed. Subsequent scheduled runs require no hosting-computer access.
6. Check bowtiers.com's update time after a successful run. A changed rank appears after the next successful scheduled export/deployment and browser poll. GitHub scheduling delays, deployment duration and browser background throttling mean five minutes is the requested schedule, not a guaranteed visibility deadline.

If a Cloudflare publishing task was previously configured, disable that task after confirming the Pages feed works. If it was never configured, skip the optional alternative below entirely.

Reference: [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### If scheduled runs are absent but manual runs succeed

Check the workflow's enabled state, default branch and the workflow file on GitHub rather than only the local checkout. The repository's push-path filter applies only to pushes; it does not prevent scheduled events. A manual run executes one deployment and does not restart a scheduling timer.

On 2026-10-10 at 13:25 UTC, the public GitHub API showed this repository's workflow active on `main`, with the correct five-minute schedule. The latest scheduled run had been created at 06:58 UTC, while a manual run at 13:01 UTC completed successfully. This establishes that no recent scheduled event was created, rather than a scheduled deployment failing. The exact cause is not exposed by the public API. GitHub's status page reported Actions operational, which does not rule out repository-specific schedule delays.

The offset schedule is a mitigation following GitHub's recommendation to avoid busy times, not a guaranteed fix. Publish it to `main` and inspect runs filtered by event **schedule**. If events remain absent, report the repository, workflow path, latest successful manual run and last scheduled event to GitHub Support. If dependable five-minute updates are required, use an external scheduler to trigger the existing `workflow_dispatch` event; it can keep the same MySQL export and Pages deployment without Cloudflare.

## Optional previous alternative: publish every 60 seconds

The following Cloudflare/Windows setup is retained only as an optional alternative. It is not needed for the selected five-minute GitHub Actions schedule.

GitHub Pages continues hosting bowtiers.com. The browser now refreshes rankings every 60 seconds and retains the last successful view if a request fails. By default it still reads `site/data/tiers.json` from Pages. To publish new database changes every minute, complete the optional feed setup below.

GitHub Actions schedules cannot run every minute: the minimum interval is five minutes, and scheduled jobs can be delayed. Do not use a permanently looping Action or rebuild Pages 1,440 times daily. This setup uses your existing Windows bot host to export once per minute, a private Cloudflare R2 bucket to store one public JSON file, and a Worker URL to serve it. No router access, incoming port, dedicated IP, private-repository access, or Porkbun DNS changes are needed.

Cloudflare is an additional service; check its current R2/Workers quotas and billing before enabling it. The Worker and JSON URL are intentionally public. Only the exporter's allowlisted Minecraft identities and rankings are uploaded; never upload `.env`, SQL dumps, Discord account links or bot configuration.

## 1. Create the feed storage and reader

1. In a Cloudflare account, enable **R2 Object Storage** and create a bucket named `bowtiers-rankings`. Keep public bucket access disabled. This does not require moving bowtiers.com's nameservers.
2. Under **Workers & Pages**, create a Worker named `bowtiers-rankings`. Open its code editor and replace the starter code with the complete contents of `scripts/feed-worker.js` from this repository. Deploy it.
3. In that Worker's **Settings → Bindings** (or the Bindings tab), add an **R2 bucket** binding. Variable name must be **`RANKINGS`**; select `bowtiers-rankings`. Save and redeploy if prompted.
4. Enable the Worker's `workers.dev` public route if it is not already enabled. Record its actual URL, for example `https://bowtiers-rankings.YOUR-SUBDOMAIN.workers.dev`. The feed URL is that URL followed by **`/tiers.json`**.
5. Before the first upload, `/tiers.json` returns HTTP 503, `Awaiting rankings`. Other paths return 404. The Worker only reads the exact `tiers.json` object; it cannot serve arbitrary files or accept uploads.
6. In **R2 → Manage R2 API Tokens**, create a token with **Object Read & Write**, scoped only to `bowtiers-rankings`. Record the **Access Key ID**, **Secret Access Key**, and account's **S3 API endpoint** privately. The endpoint resembles `https://ACCOUNT_ID.r2.cloudflarestorage.com`. These are R2 S3 credentials, not your normal Cloudflare API token.

## 2. Prepare the Windows hosting computer

Use the same Windows account that will run the scheduled task. This is a separate checkout from `C:\BowTiersHost`; the bot deployment script does not publish website data.

1. Install Node.js 24+, Git and **AWS CLI v2 for Windows** from the official installers if missing. Restart PowerShell after installation. An AWS account is not needed to use the CLI with R2 credentials.
2. After publishing this website repository's changes, clone it on the hosting computer:

   ```powershell
   git clone https://github.com/cosmiccrystal1/bowtiers-website.git C:\BowTiersWebsite
   Set-Location C:\BowTiersWebsite
   npm.cmd ci
   ```

   If that checkout already exists, use `git pull --ff-only` inside it, then `npm.cmd ci`. Do not copy your private bot checkout into the public website repository.
3. Copy `.env.example` to **`C:\BowTiersWebsite\.env`** and fill in the existing **BowTiers Discord/rankings database** connection values. This is not the Paper regions' `bt_mc_` database. The exporter reads `bt_tier_lists`, `bt_players` and `bt_rankings`. Prefer a MySQL user with **SELECT only** on these tables. Ensure this Windows host may connect to that database. Keep the file ignored and local. Preserve your endpoint's approved TLS configuration; the Paper plugin's `ssl-mode` setting is not a website environment variable.

   ```powershell
   Copy-Item .env.example .env
   notepad.exe .env
   npm.cmd run export
   ```

   The Copy-Item step is only for a new `.env`; do not overwrite an existing configured file. A successful export prints the count of tier lists and produces `site\data\tiers.json` containing only public fields.
4. Store the R2 credentials in a separate AWS profile. Run this interactively and enter the R2 access key and secret when prompted:

   ```powershell
   aws.exe configure --profile bowtiers-rankings
   ```

   Enter **`auto`** as region and **`json`** as output format. The credentials remain in this Windows user's AWS profile. Never put them in a task's arguments, website JavaScript or GitHub commits.
5. Test a complete export/upload using the actual R2 endpoint:

   ```powershell
   Set-Location C:\BowTiersWebsite
   .\scripts\publish-rankings.ps1 -Root C:\BowTiersWebsite -Bucket bowtiers-rankings -Endpoint "https://YOUR_32_CHARACTER_ACCOUNT_ID.r2.cloudflarestorage.com"
   ```

   Replace the placeholder. The script accepts the standard account endpoint, not a bucket URL. It refuses overlapping runs and uploads only after a successful export. Logs are under `C:\BowTiersWebsite\.local\rankings-YYYY-MM-DD.log`.
6. Open the Worker's `/tiers.json` URL. Confirm HTTP 200, a current `generatedAt`, and real rankings. Do not continue to the website switch if the feed is failing.

## 3. Point the GitHub Pages site at the feed

1. On your development device, edit **`site/config.js`** in `bowtiers-website`:

   ```javascript
   export const RANKINGS_URL = 'https://bowtiers-rankings.YOUR-SUBDOMAIN.workers.dev/tiers.json';
   ```

   Substitute the tested public URL. This file must contain no credentials. The included Worker sends the public CORS headers needed by bowtiers.com.
2. Run `npm.cmd run check` and `npm.cmd test`, commit and push the website changes to its normal Pages deployment branch. Wait for the Pages workflow to complete.
3. Reload bowtiers.com. It should show the feed's update time. Change a real rank using `/setrank` and verify it appears after the next export and browser refresh. Your selected list and search text remain intact while the page refreshes.
4. Local previews always use local sample data, even when a remote feed is configured. Use the preview server's existing `--live` option to preview the last local real export.

## 4. Schedule the Windows publication every minute

1. Open **Task Scheduler → Create Task**. Name it **BowTiers - Publish Rankings**.
2. Under **General**, select the Windows account used in step 2. Choose **Run whether user is logged on or not**. Use that account's Windows password when saving, not its PIN. Elevated privileges are normally unnecessary. This user needs access to the checkout, `.env` and its own AWS profile.
3. Under **Triggers → New**, select **On a schedule**, Daily, starting now. Enable **Repeat task every: 1 minute**, **for a duration of: Indefinitely**. Enable the trigger. Optionally add an **At startup** trigger as well.
4. In PowerShell on that hosting computer, find the installed PowerShell program:

   ```powershell
   (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
   (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
   ```

   Choose one path that actually exists. The script supports Windows PowerShell 5.1 and PowerShell 7. Do not assume `C:\Program Files\PowerShell\7\pwsh.exe` is installed.
5. Under **Actions → New → Start a program**, enter:
   - **Program/script:** the existing executable path from step 4.
   - **Add arguments:** `-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\BowTiersWebsite\scripts\publish-rankings.ps1" -Root "C:\BowTiersWebsite" -Bucket "bowtiers-rankings" -Endpoint "https://YOUR_32_CHARACTER_ACCOUNT_ID.r2.cloudflarestorage.com"`
   - **Start in:** `C:\BowTiersWebsite` (no surrounding quotes).

   Replace the endpoint placeholder, and keep the executable path separate from its arguments.
6. Under **Conditions**, allow the task on battery if appropriate and remove idle-only restrictions. Keep the host awake and connected to the internet; sleeping or powered-off computers cannot export rankings.
7. Under **Settings**, enable **Allow task to be run on demand**, **Run task as soon as possible after a scheduled start is missed**, and **If the task is already running: Do not start a new instance**. A two-minute execution limit is reasonable; do not terminate a normal export at exactly 60 seconds.
8. Save, then right-click **Run**. Confirm **Last Run Result 0x0**, inspect the `.local` log, and check the public JSON's `generatedAt` advances on subsequent minutes.

Exports are attempted once per minute; each open browser polls once per minute. Combined publication and polling can take nearly two minutes to become visible, plus network delays. Browser background throttling and host downtime prevent a guaranteed 60-second end-to-end deadline. Export/upload failures retain the previous feed object and retry at the next run.

Later exporter updates require `git pull --ff-only` and `npm.cmd ci` in this separate website checkout; the existing bot updater manages only the bots. Do not commit its locally generated JSON just to publish a ranking update. To disable the feed, disable the scheduled task and restore `RANKINGS_URL` to `./data/tiers.json`, then deploy Pages. The existing Pages export remains the slower fallback.

References: [GitHub schedule minimum and delays](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/), [R2 AWS CLI upload](https://developers.cloudflare.com/r2/get-started/cli/), [R2 Worker bindings/API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [AWS CLI Windows installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

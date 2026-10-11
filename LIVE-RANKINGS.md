# Scheduled rankings updates

Before deploying the current exporter, apply bot migration **011** and give the export account SELECT on `bt_rank_regions`, `bt_player_regions` and `bt_ranking_exclusions` in addition to the original three source tables. These supply public regions and restriction visibility; no Discord account-link access is needed. See README.md for coordinated rollout.

## Successful workflows but an old website timestamp

On 2026-10-11, [run 38110395832](https://github.com/cosmiccrystal1/bowtiers-website/actions/runs/38110395832) exported an artifact dated **2026-10-11T04:04:14.256Z** with 11 public players. At the same time, bowtiers.com's JSON still served **2026-10-10T20:01:15.434Z** with 8 players. This confirms that export succeeded but the live Pages file remained old; it was not merely a stale timestamp in one browser. Repeated successful deployments reused source commit `1632231`. This matches the behavior reported in [actions/deploy-pages issue 383](https://github.com/actions/deploy-pages/issues/383), although GitHub's internal cause is not confirmed.

The prepared fix separates rankings publication from Pages deployment:

1. The existing minute-by-minute dispatcher runs the same `pages.yml` workflow on `main`.
2. The exporter reads a consistent, read-only MySQL snapshot.
3. **Publish and verify live rankings** publishes only the allowlisted public JSON to `rankings-data/tiers.json`. The branch is created automatically with an independent root commit; later exports advance it without changing `main`. The workflow uses its built-in `GITHUB_TOKEN` with `contents: write`, so no new token secret or cron-token permission is needed.
4. That step checks the same public branch URL used by the browser, retries brief propagation delays, and fails if it cannot confirm the expected or a newer valid snapshot. Upload/deployment success alone is no longer treated as proof of feed freshness.
5. Pages still hosts the website. `site/config.js` now points to:

   ```javascript
   export const RANKINGS_URL = 'https://raw.githubusercontent.com/cosmiccrystal1/bowtiers-website/rankings-data/tiers.json';
   ```

Publish the prepared website changes to `main` once, then confirm **Publish and verify live rankings** and **Deploy** both succeed. Reload bowtiers.com with **Ctrl+F5** once to load the changed configuration. Keep the existing cron URL, token, MySQL secrets, Pages source (**GitHub Actions**) and domain/DNS unchanged. Do not create `rankings-data` manually or select it as the Pages publishing source. The workflow removes the old native schedule because the hosted dispatcher is already confirmed working.

Later rankings updates require only export/feed publication and the next browser poll. Each export writes a dated public snapshot commit to the data branch, so its history grows with the configured cadence. A one-minute trigger plus a one-minute browser poll is not a guaranteed one-minute end-to-end deadline; workflow runtime, network propagation and background-tab throttling add delay. Export/publication failures leave the last successful feed available. A later Pages deployment failure does not roll back an already published feed.

## Preventing rankings from reverting during refresh

The browser now requests a fresh cache key on each poll and retains its newest successfully loaded export when a response has an older/equal `generatedAt`, or is the undated checked-in placeholder. Invalid timestamps/data are rejected. This protects an open page during CDN propagation; a genuinely newer database export may still change rankings. No extra scheduler is required.

Exports read all public tables in one read-only consistent snapshot and use the database's UTC timestamp at its creation, rather than the export runner's clock or finish time. See [MySQL consistent snapshots](https://dev.mysql.com/doc/refman/8.4/en/commit.html). The workflow retains its shared concurrency group and explicitly checks out `main`; dispatches for other branches are skipped. Publication is serialized with export/deployment, and branch updates never force-overwrite concurrent commits. These freshness changes do not alter the database schema or cron service credentials.

## Selected setup: hosted cron triggers GitHub every minute

Selected on 2026-10-10 after GitHub's native schedule stopped delivering regular events; minute-by-minute dispatches were confirmed working on 2026-10-11. Existing working jobs need no reconfiguration for the feed fix above. For a new setup, use cron-job.org to call the existing GitHub workflow. GitHub exports from MySQL, publishes the public feed and deploys Pages; the external service only sends the authenticated trigger. Neither the bot hosting computer nor Cloudflare is needed. The following account setup is required only if no hosted job exists yet.

### 1. Create a limited GitHub token

1. Open GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name it `BowTiers website cron`, select resource owner **cosmiccrystal1**, and choose an expiration you will remember to renew.
3. Under **Repository access**, choose **Only select repositories → bowtiers-website**.
4. Under **Repository permissions**, give **Actions: Read and write**. Metadata read access is automatic; no additional permissions are needed for workflow dispatch.
5. Generate the token and copy it privately into the cron service's Authorization header below. Do not paste it into chat, a URL, source code, or a commit. This token allows the service to trigger workflows in the selected repository; it does not need access to bowtiers-bots or your MySQL credentials.

### 2. Create the hosted job

1. Create/sign in to an account at https://console.cron-job.org/ and choose **Create cronjob**.
2. Title: `BowTiers rankings update`.
3. URL (one line):

   ```text
   https://api.github.com/repos/cosmiccrystal1/bowtiers-website/actions/workflows/pages.yml/dispatches
   ```

4. Choose execution **Every minute**. If using custom cron, use `* * * * *`. Keep the job enabled. Five-minute triggering is also compatible if preferred.
5. Open the advanced request settings. Set **Request method: POST**, and add these custom headers, replacing only the token placeholder:

   | Header | Value |
   | --- | --- |
   | Authorization | `Bearer YOUR_FINE_GRAINED_TOKEN` |
   | Accept | `application/vnd.github+json` |
   | Content-Type | `application/json` |
   | User-Agent | `BowTiers-Rankings-Cron` |
   | X-GitHub-Api-Version | `2026-03-10` |

6. Set the **Request body** exactly to:

   ```json
   {"ref":"main"}
   ```

7. Leave HTTP Basic authentication disabled; the Authorization header provides authentication. Enable failure notifications if desired. Save the job and use its test/run function.

### 3. Confirm the trigger, feed and deployment

1. With API version `2026-03-10`, a successful dispatch returns HTTP **200** with a workflow run ID and URL. This confirms the trigger, not the completed export. Older API versions may return **204** with no body.
2. Open https://github.com/cosmiccrystal1/bowtiers-website/actions/workflows/pages.yml and find the new **workflow_dispatch** run (the UI may label it manually triggered, even when cron sent it). It will not have event type `schedule`.
3. Confirm **Export public rankings**, **Publish and verify live rankings**, and **Deploy** finish successfully. The publication step logs the export timestamp/commit and `Live public rankings feed confirmed.` Check the update time on bowtiers.com after the first Pages deployment and reload.
4. Confirm the cron service's execution history advances at one-minute intervals and new GitHub runs appear. Workflow runtime, propagation and the site's 60-second polling add delay; one minute is a trigger interval, not a guaranteed end-to-end deadline.
5. The prepared workflow removes the old native `schedule:` block now that hosted triggering is confirmed. Keep `workflow_dispatch:`, `push:`, all job steps, permissions and concurrency. This avoids duplicate deployments if GitHub's scheduler resumes. Do not disable the whole workflow in the Actions UI, as that would also prevent external dispatches.

The published workflow already supports `workflow_dispatch`; creating a hosted job does not require a code push. The separate feed fix does require publishing the prepared workflow, scripts and `site/config.js` changes once. Keep existing GitHub MySQL secrets unchanged. Do not give database credentials to cron-job.org. The cron token needs only website-repository **Actions: Read and write**; the workflow's built-in token handles data-branch publication.

Troubleshooting:

- **401:** invalid, expired or revoked token; renew it and update the Authorization header.
- **403:** check Actions write permission, selected repository, account access and any rate-limit response.
- **404:** check the owner/repository/workflow filename and token repository access.
- **422:** check JSON body, `ref: main`, and the published `workflow_dispatch` trigger.
- **Successful HTTP response but failed deployment:** open the GitHub run's logs. Cron only knows whether GitHub accepted the trigger, not whether MySQL export or Pages deployment succeeded.
- **Publish and verify live rankings fails:** inspect that step's bounded error. A 403 on GitHub publication means the workflow's `contents: write` permission is unavailable; it is separate from the external cron token. A live-feed confirmation failure means the new file was not observable after the retries; the next dispatch retries, and the step must not be treated as a successful refresh.
- **Workflow green but browser still uses the old Pages data file:** check that the deployed `config.js` points to the raw GitHub feed above, then hard-refresh once. Open the feed and compare its `generatedAt` with the export log. The old `/data/tiers.json` Pages URL is no longer the active feed.
- **Triggers stop later:** inspect cron execution/failure history and job enabled state, plus token expiration. Renew the token before it expires.

References: [cron-job.org custom requests](https://cron-job.org/en/faq/), [GitHub workflow dispatch API and token permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

## Previous setup: GitHub Actions built-in schedule

The previous workflow used `2-59/5 * * * *`, requesting runs at minutes 2, 7, 12, …, 57 each hour. It served rankings from the Pages artifact. This setup is superseded by the confirmed hosted dispatcher and independent feed above. If native scheduling is chosen again later, keep the independent feed publisher and disable the hosted job to avoid duplicate runs. Merely running the workflow manually does not start a scheduling timer.

Reference: [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### If scheduled runs are absent but manual runs succeed

Check the workflow's enabled state, default branch and the workflow file on GitHub rather than only the local checkout. The repository's push-path filter applies only to pushes; it does not prevent scheduled events. A manual run executes one deployment and does not restart a scheduling timer.

On 2026-10-10 at 13:25 UTC, the public GitHub API showed this repository's workflow active on `main`, with the correct five-minute schedule. The latest scheduled run had been created at 06:58 UTC, while a manual run at 13:01 UTC completed successfully. This establishes that no recent scheduled event was created, rather than a scheduled deployment failing. The exact cause is not exposed by the public API. GitHub's status page reported Actions operational, which does not rule out repository-specific schedule delays.

The offset schedule was attempted as a mitigation following GitHub's recommendation to avoid busy times; it did not establish dependable delivery for this repository. The user subsequently selected the hosted dispatcher documented above. If investigating the native scheduler separately, report the repository, workflow path, latest successful manual run and last scheduled event to GitHub Support.

## Optional previous alternative: publish every 60 seconds

The following Cloudflare/Windows setup is retained only as an optional alternative. It is not needed for the selected hosted dispatcher and public GitHub data feed.

GitHub Pages continues hosting bowtiers.com. The browser refreshes rankings every 60 seconds and retains the last successful view if a request fails. The selected setup already publishes through the public GitHub data branch. The optional steps below replace that feed with R2/Workers instead.

GitHub's native schedules have a minimum interval of five minutes and can be delayed; the selected setup uses external dispatches instead. This optional alternative uses your existing Windows bot host to export once per minute, a private Cloudflare R2 bucket to store one public JSON file, and a Worker URL to serve it. No router access, incoming port, dedicated IP, private-repository access, or Porkbun DNS changes are needed.

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
3. Copy `.env.example` to **`C:\BowTiersWebsite\.env`** and fill in the existing **BowTiers Discord/rankings database** connection values. This is not the Paper regions' `bt_mc_` database. After bot migration 011, the exporter reads `bt_tier_lists`, `bt_players`, `bt_rankings`, `bt_rank_regions`, `bt_player_regions` and `bt_ranking_exclusions`. Prefer a MySQL user with **SELECT only** on these tables. Ensure this Windows host may connect to that database. Keep the file ignored and local. Preserve your endpoint's approved TLS configuration; the Paper plugin's `ssl-mode` setting is not a website environment variable.

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

Later exporter updates require `git pull --ff-only` and `npm.cmd ci` in this separate website checkout; the existing bot updater manages only the bots. Do not commit its locally generated JSON to `main` just to publish a ranking update. To return to the selected GitHub feed, confirm hosted dispatches and **Publish and verify live rankings** work, restore the raw GitHub `RANKINGS_URL` shown above, deploy Pages, and then disable the optional Windows publishing task.

References: [GitHub schedule minimum and delays](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/), [R2 AWS CLI upload](https://developers.cloudflare.com/r2/get-started/cli/), [R2 Worker bindings/API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [AWS CLI Windows installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

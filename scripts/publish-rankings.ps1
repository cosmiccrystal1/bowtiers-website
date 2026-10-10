param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')][string]$Bucket,
    [Parameter(Mandatory = $true)][ValidatePattern('^https://[a-f0-9]{32}\.r2\.cloudflarestorage\.com/?$')][string]$Endpoint,
    [ValidatePattern('^[A-Za-z0-9_-]+$')][string]$Profile = 'bowtiers-rankings'
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not (Test-Path -LiteralPath (Join-Path $Root 'scripts\export.js'))) { throw 'Root must be the bowtiers-website checkout.' }
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$aws = (Get-Command aws.exe -ErrorAction Stop).Source
$stateDirectory = Join-Path $Root '.local'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$lock = $null
try { $lock = [IO.File]::Open((Join-Path $stateDirectory 'rankings.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch [IO.IOException] { Write-Output 'Another rankings publication is running; skipped.'; exit 0 }
$transcript = $false
Push-Location $Root
try {
    Start-Transcript -Path (Join-Path $stateDirectory ('rankings-' + (Get-Date -Format 'yyyy-MM-dd') + '.log')) -Append | Out-Null
    $transcript = $true
    & $npm run export
    if ($LASTEXITCODE -ne 0) { throw 'Public rankings export failed; previous remote snapshot retained.' }
    & $aws s3 cp 'site/data/tiers.json' ('s3://' + $Bucket + '/tiers.json') --endpoint-url $Endpoint --profile $Profile --region auto --content-type 'application/json' --cache-control 'no-store, max-age=0' --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw 'Rankings upload failed; check the AWS profile and bucket access.' }
    Write-Output ('Published public rankings at ' + (Get-Date -Format o))
} finally {
    if ($transcript) { Stop-Transcript | Out-Null }
    Pop-Location
    if ($lock) { $lock.Dispose() }
}

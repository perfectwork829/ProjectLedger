#Requires -Version 5.1
<#
.SYNOPSIS
  Back up BenchHub Supabase database dumps and a storage file manifest.

.DESCRIPTION
  Creates timestamped backups under ./backups/:
    - db-full.sql       (schema + data via supabase db dump)
    - db-data-only.sql  (data only, smaller restore file)
    - storage-manifest.json (account-files bucket inventory)
    - storage-manifest.csv  (same data, spreadsheet-friendly)

  Optional: download storage objects into storage-files/ when -DownloadStorage
  is set and SUPABASE_SERVICE_ROLE_KEY is available.

  Prerequisites:
    - Supabase CLI installed (https://supabase.com/docs/guides/cli)
    - Project linked: supabase link --project-ref udxgnisxhcnhzrndnmdc
    - Logged in: supabase login

  Optional env (see .env.backup.example):
    - SUPABASE_PROJECT_REF
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY  (storage manifest + downloads)
    - SUPABASE_STORAGE_BUCKET    (default: account-files)

.EXAMPLE
  .\scripts\backup-supabase.ps1

.EXAMPLE
  .\scripts\backup-supabase.ps1 -DownloadStorage
#>

[CmdletBinding()]
param(
  [string] $OutputRoot = '',
  [switch] $DownloadStorage,
  [string] $Bucket = $env:SUPABASE_STORAGE_BUCKET
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputRoot) {
  $OutputRoot = Join-Path $repoRoot 'backups'
}

if (-not $Bucket) {
  $Bucket = 'account-files'
}

function Write-Step([string] $Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn([string] $Message) {
  Write-Host "!! $Message" -ForegroundColor Yellow
}

function Import-DotEnvFile([string] $Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not $env:$key) {
      Set-Item -Path "Env:$key" -Value $value
    }
  }
}

function Get-SupabaseCliPath {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Supabase CLI not found. Install: npm install -g supabase (or scoop install supabase)"
  }
  return $cmd.Source
}

function Invoke-SupabaseDump([string] $OutFile, [switch] $DataOnly) {
  $args = @('db', 'dump', '-f', $OutFile)
  if ($DataOnly) { $args += '--data-only' }
  & supabase @args
  if ($LASTEXITCODE -ne 0) {
    throw "supabase db dump failed (exit $LASTEXITCODE). Ensure you ran: supabase login && supabase link --project-ref <ref>"
  }
}

function Get-StorageListPage {
  param(
    [string] $BaseUrl,
    [string] $ServiceKey,
    [string] $BucketName,
    [string] $Prefix,
    [int] $Limit = 1000,
    [int] $Offset = 0
  )

  $body = @{
    prefix = $Prefix
    limit  = $Limit
    offset = $Offset
  } | ConvertTo-Json -Compress

  $uri = "$BaseUrl/storage/v1/object/list/$BucketName"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers @{
    Authorization  = "Bearer $ServiceKey"
    apikey         = $ServiceKey
    'Content-Type' = 'application/json'
  } -Body $body
}

function Get-StorageManifestRecursive {
  param(
    [string] $BaseUrl,
    [string] $ServiceKey,
    [string] $BucketName,
    [string] $Prefix = ''
  )

  $entries = @()
  $queue = [System.Collections.Generic.Queue[string]]::new()
  $queue.Enqueue($Prefix)

  while ($queue.Count -gt 0) {
    $currentPrefix = $queue.Dequeue()
    $offset = 0

    do {
      $page = Get-StorageListPage -BaseUrl $BaseUrl -ServiceKey $ServiceKey -BucketName $BucketName -Prefix $currentPrefix -Offset $offset
      if (-not $page) { break }

      foreach ($item in $page) {
        $name = [string]$item.name
        if ([string]::IsNullOrWhiteSpace($name)) { continue }

        $fullPath = if ($currentPrefix) { "$currentPrefix/$name" } else { $name }
        $isFolder = $null -ne $item.id -and [string]$item.id -eq ''

        if ($isFolder) {
          $queue.Enqueue($fullPath)
          continue
        }

        $publicUrl = "$BaseUrl/storage/v1/object/public/$BucketName/$fullPath"
        $entries += [ordered]@{
          bucket     = $BucketName
          path       = $fullPath
          name       = $name
          id         = $item.id
          size       = $item.metadata.size
          mimetype   = $item.metadata.mimetype
          updated_at = $item.updated_at
          public_url = $publicUrl
        }
      }

      $offset += $page.Count
    } while ($page.Count -ge 1000)
  }

  return ,$entries
}

function Export-ManifestCsv([object[]] $Entries, [string] $Path) {
  $rows = foreach ($entry in $Entries) {
    [pscustomobject]@{
      bucket     = $entry.bucket
      path       = $entry.path
      size       = $entry.size
      mimetype   = $entry.mimetype
      updated_at = $entry.updated_at
      public_url = $entry.public_url
    }
  }
  $rows | Export-Csv -Path $Path -NoTypeInformation -Encoding UTF8
}

function Download-StorageObject {
  param(
    [string] $BaseUrl,
    [string] $ServiceKey,
    [string] $BucketName,
    [string] $ObjectPath,
    [string] $DestRoot
  )

  $destFile = Join-Path $DestRoot ($ObjectPath -replace '/', [IO.Path]::DirectorySeparatorChar)
  $destDir = Split-Path $destFile -Parent
  if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  $encodedPath = ($ObjectPath -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
  $uri = "$BaseUrl/storage/v1/object/$BucketName/$encodedPath"

  Invoke-WebRequest -Uri $uri -Headers @{
    Authorization = "Bearer $ServiceKey"
    apikey        = $ServiceKey
  } -OutFile $destFile
}

# --- main ---

Set-Location $repoRoot

Import-DotEnvFile (Join-Path $repoRoot '.env.backup')
Import-DotEnvFile (Join-Path $repoRoot '.env.local')
Import-DotEnvFile (Join-Path $repoRoot '.env')

$null = Get-SupabaseCliPath

$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$backupDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Step "Backup directory: $backupDir"

# Metadata sidecar
$meta = [ordered]@{
  created_at  = (Get-Date).ToString('o')
  project_ref = $env:SUPABASE_PROJECT_REF
  bucket      = $Bucket
  repo        = 'BenchHub / Lovable-FreelancerHub'
}
if (-not $meta.project_ref) {
  $projectRefFile = Join-Path $repoRoot 'supabase\.temp\project-ref'
  if (Test-Path $projectRefFile) {
    $meta.project_ref = (Get-Content $projectRefFile -Raw).Trim()
  }
}
$meta | ConvertTo-Json | Set-Content (Join-Path $backupDir 'backup-meta.json') -Encoding UTF8

Write-Step 'Dumping full database (schema + data)...'
$fullDump = Join-Path $backupDir 'db-full.sql'
Invoke-SupabaseDump -OutFile $fullDump

Write-Step 'Dumping data-only database...'
$dataDump = Join-Path $backupDir 'db-data-only.sql'
Invoke-SupabaseDump -OutFile $dataDump -DataOnly

$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
$baseUrl = $env:SUPABASE_URL
if (-not $baseUrl -and $meta.project_ref) {
  $baseUrl = "https://$($meta.project_ref).supabase.co"
}

if ($serviceKey -and $baseUrl) {
  Write-Step "Building storage manifest for bucket '$Bucket'..."
  try {
    $manifest = Get-StorageManifestRecursive -BaseUrl $baseUrl.TrimEnd('/') -ServiceKey $serviceKey -BucketName $Bucket
    $manifestPath = Join-Path $backupDir 'storage-manifest.json'
    $manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding UTF8
    Export-ManifestCsv -Entries $manifest -Path (Join-Path $backupDir 'storage-manifest.csv')
    Write-Host "    $($manifest.Count) object(s) listed." -ForegroundColor Green

    if ($DownloadStorage -and $manifest.Count -gt 0) {
      Write-Step 'Downloading storage objects...'
      $filesDir = Join-Path $backupDir 'storage-files'
      New-Item -ItemType Directory -Path $filesDir -Force | Out-Null
      $i = 0
      foreach ($entry in $manifest) {
        $i++
        Write-Host "    [$i/$($manifest.Count)] $($entry.path)"
        Download-StorageObject -BaseUrl $baseUrl.TrimEnd('/') -ServiceKey $serviceKey -BucketName $Bucket -ObjectPath $entry.path -DestRoot $filesDir
      }
    }
  }
  catch {
    Write-Warn "Storage manifest failed: $($_.Exception.Message)"
    Write-Warn 'Set SUPABASE_SERVICE_ROLE_KEY in .env.backup (never commit this file).'
  }
}
else {
  Write-Warn 'Skipping storage manifest (need SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL or linked project ref).'
  Write-Warn 'CLI fallback: supabase storage ls --experimental -r account-files > storage-manifest.txt'
}

Write-Step 'Done.'
Write-Host ""
Write-Host "Backup saved to:" -ForegroundColor Green
Write-Host "  $backupDir"
Write-Host ""
Write-Host "Keep backups off-repo (encrypted cloud drive or NAS). Do not commit backups/ to git."

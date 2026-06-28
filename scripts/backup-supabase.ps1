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
    - SUPABASE_DB_PASSWORD in .env.backup (recommended; no Docker required)
      OR Docker Desktop + Supabase CLI linked to cloud project
    - pg_dump on PATH (install PostgreSQL client tools if missing)

  Optional env (see .env.backup.example):
    - SUPABASE_PROJECT_REF
    - SUPABASE_DB_URL            (full URI; alternative to password)
    - SUPABASE_DB_PASSWORD       (builds direct connection URL)
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
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not [Environment]::GetEnvironmentVariable($key)) {
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

function Get-ProjectRef {
  if ($env:SUPABASE_PROJECT_REF) { return $env:SUPABASE_PROJECT_REF.Trim() }
  $projectRefFile = Join-Path $repoRoot 'supabase\.temp\project-ref'
  if (Test-Path $projectRefFile) {
    return (Get-Content $projectRefFile -Raw).Trim()
  }
  return 'udxgnisxhcnhzrndnmdc'
}

function Get-PoolerConnectionTemplate {
  $poolerFile = Join-Path $repoRoot 'supabase\.temp\pooler-url'
  if (Test-Path $poolerFile) {
    $line = (Get-Content $poolerFile -Raw).Trim()
    if ($line) {
      try {
        $uri = [Uri]$line
        $user = 'postgres'
        if ($uri.UserInfo) {
          $user = ($uri.UserInfo -split ':')[0]
        }
        return @{
          Host     = $uri.Host
          Port     = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
          User     = $user
          Database = if ($uri.AbsolutePath.TrimStart('/')) { $uri.AbsolutePath.TrimStart('/') } else { 'postgres' }
          Source   = 'supabase link pooler-url'
        }
      }
      catch {
        Write-Warn "Could not parse supabase/.temp/pooler-url: $($_.Exception.Message)"
      }
    }
  }

  if ($env:SUPABASE_DB_POOLER_HOST) {
    $ref = Get-ProjectRef
    return @{
      Host     = $env:SUPABASE_DB_POOLER_HOST.Trim()
      Port     = if ($env:SUPABASE_DB_PORT) { [int]$env:SUPABASE_DB_PORT } else { 5432 }
      User     = if ($env:SUPABASE_DB_USER) { $env:SUPABASE_DB_USER.Trim() } else { "postgres.$ref" }
      Database = if ($env:SUPABASE_DB_NAME) { $env:SUPABASE_DB_NAME.Trim() } else { 'postgres' }
      Source   = 'SUPABASE_DB_POOLER_HOST'
    }
  }

  return $null
}

function Test-IsDirectSupabaseHost([string] $HostName) {
  return $HostName -match '^db\.[a-z0-9]+\.supabase\.co$'
}

function Get-DatabaseConnection {
  $ref = Get-ProjectRef
  $password = $env:SUPABASE_DB_PASSWORD
  $useDirect = $env:SUPABASE_DB_USE_DIRECT -eq '1' -or $env:SUPABASE_DB_USE_DIRECT -eq 'true'

  if ($env:SUPABASE_DB_URL) {
    $uri = [Uri]$env:SUPABASE_DB_URL
    $user = 'postgres'
    $urlPassword = ''
    if ($uri.UserInfo) {
      $parts = $uri.UserInfo -split ':', 2
      $user = $parts[0]
      if ($parts.Length -gt 1) {
        $urlPassword = [Uri]::UnescapeDataString($parts[1])
      }
    }
    if (-not $password) { $password = $urlPassword }
    if (-not $password) { return $null }

    $connection = @{
      Host     = $uri.Host
      Port     = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
      User     = $user
      Password = $password
      Database = if ($uri.AbsolutePath.TrimStart('/')) { $uri.AbsolutePath.TrimStart('/') } else { 'postgres' }
      Source   = 'SUPABASE_DB_URL'
    }

    if (-not $useDirect -and (Test-IsDirectSupabaseHost $connection.Host)) {
      $pooler = Get-PoolerConnectionTemplate
      if ($pooler) {
        Write-Warn "SUPABASE_DB_URL uses direct host ($($connection.Host)); using pooler $($pooler.Host) instead (IPv4)."
        return @{
          Host     = $pooler.Host
          Port     = $pooler.Port
          User     = $pooler.User
          Password = $password
          Database = $pooler.Database
          Source   = "$($pooler.Source) (auto-upgraded from direct URL)"
        }
      }
      Write-Warn "Direct host $($connection.Host) is IPv6-only on many networks. Set SUPABASE_DB_POOLER_HOST or use Session pooler URI."
    }

    return $connection
  }

  if (-not $password) { return $null }

  if (-not $useDirect) {
    $pooler = Get-PoolerConnectionTemplate
    if ($pooler) {
      return @{
        Host     = $pooler.Host
        Port     = $pooler.Port
        User     = $pooler.User
        Password = $password
        Database = $pooler.Database
        Source   = $pooler.Source
      }
    }
  }

  return @{
    Host     = "db.$ref.supabase.co"
    Port     = 5432
    User     = 'postgres'
    Password = $password
    Database = 'postgres'
    Source   = 'direct'
  }
}

function Find-PgDump {
  $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $roots = @(
    'C:\Program Files\PostgreSQL',
    'C:\Program Files (x86)\PostgreSQL'
  )
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $match = Get-ChildItem -Path $root -Recurse -Filter 'pg_dump.exe' -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($match) { return $match.FullName }
  }

  return $null
}

function Test-DockerAvailable {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) { return $false }
  try {
    & docker info 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
  }
  catch {
    return $false
  }
}

function Invoke-PgDatabaseDump {
  param(
    [hashtable] $Connection,
    [string] $OutFile,
    [switch] $DataOnly
  )

  $pgDump = Find-PgDump
  if (-not $pgDump) {
    throw @(
      'pg_dump not found. Install PostgreSQL client tools, then retry:'
      '  winget install PostgreSQL.PostgreSQL.17'
      '  (or) scoop install postgresql'
      'Then open a new terminal and run: npm run backup:supabase'
    ) -join "`n"
  }

  Write-Host "    Using pg_dump at $pgDump" -ForegroundColor DarkGray
  if ($Connection.Source) {
    Write-Host "    Connection: $($Connection.User)@$($Connection.Host):$($Connection.Port) ($($Connection.Source))" -ForegroundColor DarkGray
  }

  $prevPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $Connection.Password

  try {
    $args = @(
      '--host', $Connection.Host,
      '--port', [string]$Connection.Port,
      '--username', $Connection.User,
      '--dbname', $Connection.Database,
      '--file', $OutFile,
      '--no-owner',
      '--no-acl',
      '--format', 'plain',
      '--encoding', 'UTF8'
    )

    if ($DataOnly) {
      $args += @('--data-only', '--schema=public', '--schema=auth', '--schema=storage')
    }
    else {
      $args += @('--schema=public', '--schema=auth', '--schema=storage')
    }

    & $pgDump @args
    if ($LASTEXITCODE -ne 0) {
      $hint = 'Check SUPABASE_DB_PASSWORD in .env.backup (Dashboard - Settings - Database - Database password).'
      if ($Connection.Source -eq 'direct') {
        $hint += ' Direct host db.*.supabase.co is IPv6-only on many networks; set SUPABASE_DB_POOLER_HOST or run supabase link so pooler-url is available.'
      }
      throw "pg_dump failed (exit $LASTEXITCODE). $hint"
    }
  }
  finally {
    if ($null -eq $prevPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
      $env:PGPASSWORD = $prevPassword
    }
  }
}

function Invoke-SupabaseCliDump {
  param(
    [string] $OutFile,
    [switch] $DataOnly,
    [string] $DbUrl
  )

  $args = @('db', 'dump', '-f', $OutFile)
  if ($DataOnly) { $args += '--data-only' }
  if ($DbUrl) {
    $args += @('--db-url', $DbUrl)
  }

  & supabase @args
  if ($LASTEXITCODE -ne 0) {
    throw "supabase db dump failed (exit $LASTEXITCODE)."
  }
}

function Invoke-DatabaseDump {
  param(
    [string] $OutFile,
    [switch] $DataOnly
  )

  $connection = Get-DatabaseConnection
  if ($connection) {
    Invoke-PgDatabaseDump -Connection $connection -OutFile $OutFile -DataOnly:$DataOnly
    return
  }

  if (-not (Test-DockerAvailable)) {
    throw @(
      'Database backup requires credentials or Docker.'
      ''
      'Quick fix (no Docker):'
      '  1. copy .env.backup.example .env.backup'
      '  2. Set SUPABASE_DB_PASSWORD (Dashboard - Settings - Database - Database password)'
      '  3. Install pg_dump: winget install PostgreSQL.PostgreSQL.17'
      '  4. npm run backup:supabase'
      ''
      'Alternative: start Docker Desktop and run supabase login; supabase link --project-ref udxgnisxhcnhzrndnmdc'
    ) -join "`n"
  }

  $null = Get-SupabaseCliPath
  Write-Host '    Using Supabase CLI + Docker (linked project).' -ForegroundColor DarkGray
  Invoke-SupabaseCliDump -OutFile $OutFile -DataOnly:$DataOnly
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
Invoke-DatabaseDump -OutFile $fullDump

Write-Step 'Dumping data-only database...'
$dataDump = Join-Path $backupDir 'db-data-only.sql'
Invoke-DatabaseDump -OutFile $dataDump -DataOnly

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

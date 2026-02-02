param(
  [switch]$SkipWinUnpacked,
  [switch]$StrictWinUnpacked,
  [switch]$NoBump,
  [switch]$Sign,
  [string]$TimeStampServer = 'http://timestamp.digicert.com',
  [string]$Rfc3161TimeStampServer = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'

# Clean up any persisted npm_config_* env vars from previous sessions.
foreach ($k in @('npm_config_arch','npm_config_disturl','npm_config_runtime','npm_config_target')) {
  try {
    if (Test-Path ("Env:" + $k)) { Remove-Item ("Env:" + $k) -ErrorAction SilentlyContinue }
  } catch {}
}

# Run from repo root
Set-Location -Path (Join-Path $PSScriptRoot '..')

# Ensure license verification public key is present at build time.
# This is a PUBLIC key (safe to embed) and is required for production activation via signed license files.
if (-not $env:VITE_AZRAR_LICENSE_PUBLIC_KEY -or -not $env:VITE_AZRAR_LICENSE_PUBLIC_KEY.Trim()) {
  try {
    $pubPath = Join-Path (Get-Location) 'secrets\azrar-license-public.key.json'
    if (Test-Path $pubPath) {
      $pub = (Get-Content -Raw -Path $pubPath | ConvertFrom-Json)
      if ($pub -and $pub.publicKeyB64 -and ($pub.publicKeyB64.ToString().Trim())) {
        $env:VITE_AZRAR_LICENSE_PUBLIC_KEY = $pub.publicKeyB64.ToString().Trim()
        Write-Host 'Loaded VITE_AZRAR_LICENSE_PUBLIC_KEY from secrets\azrar-license-public.key.json'
      }
    }
  } catch {
    # ignore
  }
}

# Also write a packaged asset file so the app can fetch the public key via IPC as a fallback.
# This file contains ONLY the PUBLIC verification key (safe to ship).
try {
  if ($env:VITE_AZRAR_LICENSE_PUBLIC_KEY -and $env:VITE_AZRAR_LICENSE_PUBLIC_KEY.Trim()) {
    $assetDir = Join-Path (Get-Location) 'electron\assets'
    if (-not (Test-Path $assetDir)) {
      New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
    }
    $assetPath = Join-Path $assetDir 'azrar-license-public.key.json'
    $obj = @{ publicKeyB64 = $env:VITE_AZRAR_LICENSE_PUBLIC_KEY.Trim(); note = 'Public key for AZRAR license verification (safe to embed)' }
    ($obj | ConvertTo-Json -Compress) | Set-Content -Path $assetPath -Encoding UTF8
    Write-Host 'Wrote electron\assets\azrar-license-public.key.json (public key asset)'
  }
} catch {
  # ignore
}

# Auto-bump version on each dist build so every installer has a new version.
# Allow opting out (for reproducible builds) via -NoBump or DESKTOP_NO_BUMP=1.
$envNoBump = ($env:DESKTOP_NO_BUMP -eq '1' -or $env:DESKTOP_NO_BUMP -eq 'true' -or $env:DESKTOP_NO_BUMP -eq 'TRUE')
if (-not $NoBump -and -not $envNoBump) {
  npm run desktop:version:bump
  if ($LASTEXITCODE -ne 0) {
    throw ('desktop:version:bump failed with exit code ' + $LASTEXITCODE)
  }
} else {
  Write-Host 'Skipping desktop version bump (-NoBump / DESKTOP_NO_BUMP).'
}

./scripts/generate-icon.ps1
npm run desktop:build

# Preflight: better-sqlite3 is a native module and MUST have a compiled .node binding available
# at build time so it can be packaged into app.asar.unpacked.
$betterSqlite3Dir = Join-Path (Get-Location) 'node_modules\better-sqlite3'
if (Test-Path $betterSqlite3Dir) {
  $nativeBinaries = @(Get-ChildItem -Path $betterSqlite3Dir -Recurse -Filter '*.node' -ErrorAction SilentlyContinue)
  if ($nativeBinaries.Count -lt 1) {
    throw @(
      'better-sqlite3 native binding (*.node) was not found in node_modules.'
      'The installer would crash at runtime with: "Could not locate the bindings file".'
      ''
      'Fix:'
      '1) Install Visual Studio Build Tools 2022 (v17.x) with "Desktop development with C++" workload.'
      '   Note: Visual Studio 2026 (v18.x) is not currently detected/used by node-gyp in this environment.'
      '2) Rebuild the module, then re-run this dist script.'
      ''
      'Suggested commands (PowerShell):'
      '  npm config set msvs_version 2022'
      '  $env:npm_config_runtime = "electron"'
      '  $env:npm_config_target = "39.2.7"'
      '  $env:npm_config_disturl = "https://electronjs.org/headers"'
      '  npm rebuild better-sqlite3'
    ) -join "`n"
  }

  # Extra preflight: ensure the addon loads in the Electron runtime (ABI must match).
  $electronCmd = Join-Path (Get-Location) 'node_modules\.bin\electron.cmd'
  $checkScript = Join-Path (Get-Location) 'scripts\check-better-sqlite3-electron.cjs'
  if ((Test-Path $electronCmd) -and (Test-Path $checkScript)) {
    & $electronCmd $checkScript
    if ($LASTEXITCODE -ne 0) {
      throw @(
        'better-sqlite3 native binding exists, but it does NOT load in the Electron runtime.'
        'This usually means it was built for plain Node.js (ABI mismatch), e.g. NODE_MODULE_VERSION 137 vs 140.'
        ''
        'Fix (recommended): install Visual Studio Build Tools 2022 (v17.x) + C++ workload, then rebuild for Electron:'
        '  npm config set msvs_version 2022'
        '  $env:npm_config_runtime = "electron"'
        '  $env:npm_config_target = "39.2.7"'
        '  $env:npm_config_disturl = "https://electronjs.org/headers"'
        '  npm rebuild better-sqlite3'
        ''
        'Then run the dist build again.'
      ) -join "`n"
    }
  }
}

# IMPORTANT: when version bump runs in an npm pre-script, $env:npm_package_version can be stale.
# Always read the current version from package.json.
try {
  $ver = (Get-Content -Raw -Path ./package.json | ConvertFrom-Json).version
} catch {
  $ver = $env:npm_package_version
}
if (-not $ver -or -not $ver.Trim()) {
  $ver = 'unknown'
}

$stage = Join-Path (Get-Location) 'release2_build_stage'
$final = Join-Path (Get-Location) 'release2_build'

function Remove-DirBestEffort(
  [Parameter(Mandatory=$true)][string]$Path,
  [int]$Retries = 4,
  [int]$DelayMs = 350
) {
  if (-not (Test-Path $Path)) { return $true }

  $lastErr = $null
  for ($i = 1; $i -le $Retries; $i++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    } catch {
      $lastErr = $_

      # Fallback: rmdir is sometimes more tolerant of transient enumeration issues.
      try {
        & cmd.exe /c ('rmdir /s /q "' + $Path + '"') | Out-Null
      } catch {
        # ignore
      }

      # If the path is already gone, treat as success.
      if (-not (Test-Path $Path)) { return $true }

      Start-Sleep -Milliseconds $DelayMs
    }

    if (-not (Test-Path $Path)) { return $true }
  }

  return $false
}

if (Test-Path $stage) {
  $null = Remove-DirBestEffort -Path $stage
}

$ebArgs = @(
  '--win',
  '--x64',
  '--config=electron-builder.config.cjs',
  '--config.directories.output=release2_build_stage'
)

if ($Sign) {
  # Override signing settings only for signed builds.
  # The certificate is provided via environment variables (CSC_LINK/CSC_KEY_PASSWORD) or cert store (CSC_NAME).
  $ebArgs += ('--config.win.signAndEditExecutable=true')
  $ebArgs += ('--config.win.timeStampServer=' + $TimeStampServer)
  $ebArgs += ('--config.win.rfc3161TimeStampServer=' + $Rfc3161TimeStampServer)
}

# electron-builder currently emits some non-actionable warnings in our setup:
# - Node DeprecationWarning DEP0190 (from downstream deps)
# - "cannot find path for dependency @napi-rs/canvas-..." (optional/platform deps pulled by pdfjs-dist)
# We keep output clean by suppressing deprecation warnings and filtering only these known noisy lines.
$prevNodeOptions = $env:NODE_OPTIONS
try {
  if (-not $env:NODE_OPTIONS -or -not $env:NODE_OPTIONS.Trim()) {
    $env:NODE_OPTIONS = '--no-deprecation'
  } elseif ($env:NODE_OPTIONS -notmatch '(?i)(^|\s)--no-deprecation(\s|$)') {
    $env:NODE_OPTIONS = ($env:NODE_OPTIONS.Trim() + ' --no-deprecation')
  }

  $noise = '(?i)(\bDEP0190\b|cannot find path for dependency.*@napi-rs/canvas-)'
  npx --no-install electron-builder @ebArgs 2>&1 | ForEach-Object {
    if ($_ -notmatch $noise) { $_ }
  }
} finally {
  $env:NODE_OPTIONS = $prevNodeOptions
}
if ($LASTEXITCODE -ne 0) {
  throw ('electron-builder failed with exit code ' + $LASTEXITCODE)
}

New-Item -ItemType Directory -Force -Path $final | Out-Null

foreach ($f in @('latest.yml','builder-debug.yml','builder-effective-config.yaml')) {
  $src = Join-Path $stage $f
  if (Test-Path $src) {
    Copy-Item -Force $src -Destination (Join-Path $final $f)
  }
}

$exe = ('AZRAR Setup ' + $ver + '.exe')
$map = ($exe + '.blockmap')

# Ensure the actual files we ship match what latest.yml points to (some environments keep spaces,
# others replace them). We'll read the expected filename from latest.yml.
$expectedExeName = $exe
try {
  $latestPath = Join-Path $stage 'latest.yml'
  if (Test-Path $latestPath) {
    $line = (Get-Content -Path $latestPath | Where-Object { $_ -match '^path:\s*' } | Select-Object -First 1)
    if ($line) {
      $p = ($line -replace '^path:\s*', '').Trim()
      if ($p) { $expectedExeName = $p }
    }
  }
} catch {
  # ignore
}
$expectedMapName = ($expectedExeName + '.blockmap')

function Resolve-StageFile([string]$preferredName, [string[]]$fallbackNames) {
  $candidates = @($preferredName) + $fallbackNames
  foreach ($name in $candidates) {
    $p = Join-Path $stage $name
    if (Test-Path $p) { return $p }
  }
  return $null
}

$srcExe = Resolve-StageFile -preferredName $expectedExeName -fallbackNames @($exe, ($exe -replace ' ', '-'))
$srcMap = Resolve-StageFile -preferredName $expectedMapName -fallbackNames @($map, ($map -replace ' ', '-'))

if ($srcExe) {
  Copy-Item -Force $srcExe -Destination (Join-Path $final $expectedExeName)
} else {
  Write-Warning ('Installer EXE not found in stage. Expected: ' + $expectedExeName)
}

if ($srcMap) {
  Copy-Item -Force $srcMap -Destination (Join-Path $final $expectedMapName)
} else {
  Write-Warning ('Installer blockmap not found in stage. Expected: ' + $expectedMapName)
}

$srcWU = Join-Path $stage 'win-unpacked'
if (-not $SkipWinUnpacked -and (Test-Path $srcWU)) {
  $dstWU = Join-Path $final 'win-unpacked'
  $canReplace = $true
  # Prefer a clean destination, but do not hard-fail on locks unless StrictWinUnpacked was requested.
  if (Test-Path $dstWU) {
    try {
      $removed = Remove-DirBestEffort -Path $dstWU
      if (-not $removed) {
        throw ('Failed to remove directory after retries: ' + $dstWU)
      }
    } catch {
      $canReplace = $false
      $msg = ('Cannot replace release2_build\\win-unpacked (it may be in use). Will update in-place. Details: ' + $_.Exception.Message)
      if ($StrictWinUnpacked) {
        throw $msg
      }
      Write-Warning ($msg -replace 'Will update in-place', 'Will skip copying win-unpacked')
    }
  }
  if (-not $canReplace) {
    Write-Warning 'Skipping win-unpacked copy due to file lock. Installer and update files were still generated.'
  } else {
    New-Item -ItemType Directory -Force -Path $dstWU | Out-Null

    $null = (& robocopy $srcWU $dstWU /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD resources)
    # robocopy exit codes: 0-7 success (including "mismatch" and "extra"); 8+ indicates a failure.
    if ($LASTEXITCODE -ge 8) {
      throw ('robocopy (root) failed with exit code ' + $LASTEXITCODE)
    }

    $srcRes = Join-Path $srcWU 'resources'
    $dstRes = Join-Path $dstWU 'resources'
    if (Test-Path $srcRes) {
      New-Item -ItemType Directory -Force -Path $dstRes | Out-Null

      $null = (& robocopy $srcRes $dstRes /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP)
      if ($LASTEXITCODE -ge 8) {
        Write-Host 'resources copy had errors (likely app.asar lock); retrying without app.asar'
        $null = (& robocopy $srcRes $dstRes /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF app.asar)
        if ($LASTEXITCODE -ge 8) {
          throw ('robocopy (resources) failed with exit code ' + $LASTEXITCODE)
        }
      }
    }
  }
}

$keepNames = @($expectedExeName,$expectedMapName,'win-unpacked','latest.yml','builder-effective-config.yaml','builder-debug.yml','.icon-ico')
Get-ChildItem -Path $final -Force | ForEach-Object {
  if ($keepNames -notcontains $_.Name) {
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
  }
}

Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue

# Archive artifacts (keep last 5 builds as reference)
try {
  $archiveRoot = Join-Path (Get-Location) 'release2_build_archive'
  New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $safeVer = ($ver -replace '[^0-9A-Za-z\.-]', '_')
  if (-not $safeVer -or -not $safeVer.Trim()) { $safeVer = 'unknown' }
  $archiveName = ('v' + $safeVer + '_' + $stamp)
  $archivePath = Join-Path $archiveRoot $archiveName
  New-Item -ItemType Directory -Force -Path $archivePath | Out-Null

  $null = (& robocopy $final $archivePath /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP)
  if ($LASTEXITCODE -ge 8) {
    throw ('robocopy (archive) failed with exit code ' + $LASTEXITCODE)
  }

  $dirs = @(Get-ChildItem -Path $archiveRoot -Directory -Force | Sort-Object LastWriteTime -Descending)
  if ($dirs.Count -gt 5) {
    $toRemove = $dirs | Select-Object -Skip 5
    foreach ($d in $toRemove) {
      Remove-Item -Recurse -Force $d.FullName -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Warning ('Archive step failed (non-fatal): ' + $_.Exception.Message)
}

Write-Host ('Built desktop artifacts in release2_build (version ' + $ver + ').')

param(
  [switch]$SkipWinUnpacked,
  [switch]$StrictWinUnpacked,
  [switch]$NoBump,
  [switch]$Sign,
  [ValidateSet('dev','prod')]
  [string]$SigningProfile,
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

function Normalize-SigningProfile([string]$p) {
  $v = ([string]$p).Trim().ToLowerInvariant()
  if (-not $v) { return $null }
  if ($v -in @('dev','development','internal','self','selfsigned','self-signed')) { return 'dev' }
  if ($v -in @('prod','production','trusted','ca','ov','ev')) { return 'prod' }
  return $null
}

if (-not $SigningProfile -or -not $SigningProfile.Trim()) {
  $fromEnv = Normalize-SigningProfile $env:AZRAR_SIGNING_PROFILE
  if ($fromEnv) {
    $SigningProfile = $fromEnv
  } elseif ($Sign) {
    # Default to dev when building signed artifacts unless explicitly told otherwise.
    $SigningProfile = 'dev'
  }
}

if ($SigningProfile -and $SigningProfile.Trim()) {
  $env:AZRAR_SIGNING_PROFILE = $SigningProfile
  Write-Host ("Signing profile: " + $SigningProfile + " (AZRAR_SIGNING_PROFILE)")
}

if ($Sign) {
  $hasPfx = ($env:CSC_LINK -and $env:CSC_LINK.Trim())
  $hasStore = ($env:CSC_NAME -and $env:CSC_NAME.Trim())
  $hasThumb = ($env:CSC_THUMBPRINT -and $env:CSC_THUMBPRINT.Trim())
  if (-not $hasPfx -and -not $hasStore -and -not $hasThumb) {
    if ($SigningProfile -eq 'dev') {
      Write-Host 'Signed build requested with dev profile, but no certificate was provided.'
      Write-Host 'Generating a self-signed code-signing certificate (dev/internal) and exporting to a temporary PFX...'

      $subject = 'CN=AZRAR Dev Code Signing'
      $cert = $null
      try {
        $cert = Get-ChildItem -Path 'Cert:\CurrentUser\My' -ErrorAction SilentlyContinue |
          Where-Object { $_.Subject -eq $subject -and $_.HasPrivateKey } |
          Sort-Object NotAfter -Descending |
          Select-Object -First 1
      } catch {}

      if (-not $cert) {
        try {
          $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $subject -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm 'SHA256' -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(5)
        } catch {
          throw "Failed to create self-signed code-signing certificate. Error: $($_.Exception.Message)"
        }
      }

      $pfxPath = Join-Path $env:TEMP 'azrar-dev-codesign.pfx'
      $pwdPlain = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
      $pwd = ConvertTo-SecureString -String $pwdPlain -AsPlainText -Force
      try {
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null
      } catch {
        throw "Failed to export dev code-signing certificate to PFX. Error: $($_.Exception.Message)"
      }

      $env:CSC_LINK = $pfxPath
      $env:CSC_KEY_PASSWORD = $pwdPlain
      $hasPfx = $true
      Write-Host ("Dev signing certificate exported: " + $pfxPath)
      Write-Host 'Note: This is self-signed for internal/dev use. Windows may not trust it unless installed to Trusted Publishers/Root.'
    } else {
      throw @(
        'Signed build requested (-Sign) but no certificate was provided.'
        'Provide either:'
        '  - CSC_LINK + CSC_KEY_PASSWORD (PFX file), OR'
        '  - CSC_THUMBPRINT (certificate thumbprint from Windows Certificate Store), OR'
        '  - CSC_NAME (certificate name/subject match in Windows Certificate Store).'
        ''
        'Examples (PowerShell):'
        '  $env:CSC_LINK = "C:\\Certificates\\AZRAR\\azrar-cert.pfx"'
        '  $env:CSC_KEY_PASSWORD = "<pfx-password>"'
        '  # or'
        '  $env:CSC_THUMBPRINT = "<THUMBPRINT>"'
        '  # or'
        '  $env:CSC_NAME = "AZRAR"'
        '  $env:AZRAR_SIGNING_PROFILE = "dev"   # self-signed (internal)'
        '  # or'
        '  $env:AZRAR_SIGNING_PROFILE = "prod"  # OV/EV CA (official release)'
      ) -join "`n"
    }
  }
  if ($hasPfx) {
    $pfxPath = $env:CSC_LINK.Trim()
    if (-not (Test-Path $pfxPath)) {
      throw "CSC_LINK points to a missing file: $pfxPath"
    }
    if (-not ($env:CSC_KEY_PASSWORD -and $env:CSC_KEY_PASSWORD.Trim())) {
      throw 'CSC_KEY_PASSWORD is required when using CSC_LINK (PFX).'
    }
  }
  if ($hasThumb) {
    $thumb = ($env:CSC_THUMBPRINT -replace '\s', '').ToUpperInvariant()
    $cert = $null
    try { $cert = Get-Item "Cert:\\CurrentUser\\My\\$thumb" -ErrorAction SilentlyContinue } catch {}
    if (-not $cert) {
      try { $cert = Get-Item "Cert:\\LocalMachine\\My\\$thumb" -ErrorAction SilentlyContinue } catch {}
    }
    if (-not $cert) {
      throw "CSC_THUMBPRINT was provided but certificate was not found in store: $thumb"
    }
  }

  if (-not $hasPfx -and -not $hasThumb -and $hasStore) {
    $resolved = Find-CodeSigningCertThumbprintByName $env:CSC_NAME
    if (-not $resolved) {
      throw "CSC_NAME was provided but no matching code-signing certificate with private key was found in the Windows Certificate Store: $($env:CSC_NAME)"
    }
  }
}

function Find-CodeSigningCertThumbprintByName([string]$name) {
  $n = ([string]$name).Trim()
  if (-not $n) { return $null }

  $stores = @('Cert:\\CurrentUser\\My', 'Cert:\\LocalMachine\\My')
  $candidates = @()

  foreach ($store in $stores) {
    try {
      $items = @(Get-ChildItem -Path $store -ErrorAction SilentlyContinue)
      foreach ($c in $items) {
        if (-not $c) { continue }
        $subject = [string]$c.Subject
        $friendly = ''
        try { $friendly = [string]$c.FriendlyName } catch {}

        $matches = ($subject -like "*$n*" -or $friendly -like "*$n*")
        if (-not $matches) { continue }

        $ekuOk = $false
        try {
          if ($c.EnhancedKeyUsageList -and ($c.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3')) {
            $ekuOk = $true
          }
        } catch {}
        if (-not $ekuOk) { continue }

        if (-not $c.HasPrivateKey) { continue }
        $candidates += $c
      }
    } catch {
      # ignore
    }
  }

  if (-not $candidates -or $candidates.Count -lt 1) { return $null }

  $best = $candidates | Sort-Object NotAfter -Descending | Select-Object -First 1
  if (-not $best -or -not $best.Thumbprint) { return $null }
  return (($best.Thumbprint -replace '\s', '').ToUpperInvariant())
}

# Obfuscate/minify Electron entrypoints for distribution builds by default.
# To disable (debugging / bisecting build issues): set AZRAR_OBFUSCATE_ELECTRON=0.
if (-not (Test-Path Env:AZRAR_OBFUSCATE_ELECTRON) -or -not $env:AZRAR_OBFUSCATE_ELECTRON) {
  $env:AZRAR_OBFUSCATE_ELECTRON = '1'
}

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

$stageName = ('release2_build_stage_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '_' + ([System.Guid]::NewGuid().ToString('N').Substring(0, 8)))
$stage = Join-Path (Get-Location) $stageName
$final = Join-Path (Get-Location) 'release2_build'

function Stop-LockingProcesses {
  $names = @('AZRAR','electron','electron-builder','app-builder','app-builder-bin')
  foreach ($n in $names) {
    try {
      Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
        try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {}
      }
    } catch {
      # ignore
    }
  }
}

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

function Copy-WinUnpackedTree([string]$SourceRoot, [string]$DestRoot) {
  New-Item -ItemType Directory -Force -Path $DestRoot | Out-Null

  $null = (& robocopy $SourceRoot $DestRoot /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD resources)
  if ($LASTEXITCODE -ge 8) {
    throw ('robocopy (root) failed with exit code ' + $LASTEXITCODE)
  }

  $srcRes = Join-Path $SourceRoot 'resources'
  $dstRes = Join-Path $DestRoot 'resources'
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

if (Test-Path $stage) {
  Stop-LockingProcesses
  $null = Remove-DirBestEffort -Path $stage
}

$ebArgs = @(
  '--win',
  '--x64',
  '--config=electron-builder.config.cjs',
  ('--config.directories.output=' + $stageName)
)

if ($Sign) {
  # Override signing settings only for signed builds.
  # The certificate is provided via environment variables (CSC_LINK/CSC_KEY_PASSWORD) or cert store (CSC_NAME).
  # NOTE: We do NOT enable electron-builder signing here.
  # On many Windows setups, electron-builder's winCodeSign download/extract can fail due to symlink privileges.
  # Instead, we sign the FINAL NSIS installer EXE after build using Windows SDK signtool (scripts/code-sign-installer.ps1).
}

# electron-builder currently emits some non-actionable warnings in our setup:
# - Node DeprecationWarning DEP0190 (from downstream deps)
# - "cannot find path for dependency @napi-rs/canvas-..." (optional/platform deps pulled by pdfjs-dist)
# We keep output clean by suppressing deprecation warnings and filtering only these known noisy lines.
$prevNodeOptions = $env:NODE_OPTIONS
$prevCscLink = $null
$prevCscKeyPassword = $null
$prevCscName = $null
$hadCscLink = $false
$hadCscKeyPassword = $false
$hadCscName = $false
try {
  if (-not $env:NODE_OPTIONS -or -not $env:NODE_OPTIONS.Trim()) {
    $env:NODE_OPTIONS = '--no-deprecation'
  } elseif ($env:NODE_OPTIONS -notmatch '(?i)(^|\s)--no-deprecation(\s|$)') {
    $env:NODE_OPTIONS = ($env:NODE_OPTIONS.Trim() + ' --no-deprecation')
  }

  # IMPORTANT: electron-builder will attempt code signing automatically if CSC_* env vars are present.
  # On some Windows setups, its winCodeSign download/extract step fails due to missing symlink privileges.
  # For our dev self-signed flow, we build WITHOUT electron-builder signing and sign the final installer after build.
  if ($Sign) {
    $hadCscLink = (Test-Path Env:CSC_LINK)
    $hadCscKeyPassword = (Test-Path Env:CSC_KEY_PASSWORD)
    $hadCscName = (Test-Path Env:CSC_NAME)
    if ($hadCscLink) { $prevCscLink = $env:CSC_LINK }
    if ($hadCscKeyPassword) { $prevCscKeyPassword = $env:CSC_KEY_PASSWORD }
    if ($hadCscName) { $prevCscName = $env:CSC_NAME }

    if ($hadCscLink) { Remove-Item Env:CSC_LINK -ErrorAction SilentlyContinue }
    if ($hadCscKeyPassword) { Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue }
    if ($hadCscName) { Remove-Item Env:CSC_NAME -ErrorAction SilentlyContinue }
  }

  $noise = '(?i)(\bDEP0190\b|cannot find path for dependency.*@napi-rs/canvas-)'
  npx --no-install electron-builder @ebArgs 2>&1 | ForEach-Object {
    if ($_ -notmatch $noise) { $_ }
  }
} finally {
  if ($Sign) {
    if ($hadCscLink) { $env:CSC_LINK = $prevCscLink }
    if ($hadCscKeyPassword) { $env:CSC_KEY_PASSWORD = $prevCscKeyPassword }
    if ($hadCscName) { $env:CSC_NAME = $prevCscName }
  }
  $env:NODE_OPTIONS = $prevNodeOptions
}
if ($LASTEXITCODE -ne 0) {
  throw ('electron-builder failed with exit code ' + $LASTEXITCODE)
}

New-Item -ItemType Directory -Force -Path $final | Out-Null

# Avoid keeping stale metadata from previous builds (stage-based builds may not emit these files).
foreach ($stale in @('latest.yml','builder-debug.yml','builder-effective-config.yaml')) {
  $p = Join-Path $final $stale
  if (Test-Path $p) {
    Remove-Item -Force $p -ErrorAction SilentlyContinue
  }
}

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
  $finalExePath = (Join-Path $final $expectedExeName)
  Copy-Item -Force $srcExe -Destination $finalExePath
} else {
  Write-Warning ('Installer EXE not found in stage. Expected: ' + $expectedExeName)
}

if ($srcMap) {
  Copy-Item -Force $srcMap -Destination (Join-Path $final $expectedMapName)
} else {
  Write-Warning ('Installer blockmap not found in stage. Expected: ' + $expectedMapName)
}

$srcWU = Join-Path $stage 'win-unpacked'
$winUnpackedKeepExtras = @()
if (-not $SkipWinUnpacked -and (Test-Path $srcWU)) {
  $dstWU = Join-Path $final 'win-unpacked'
  $canReplace = $true
  # Prefer a clean destination, but do not hard-fail on locks unless StrictWinUnpacked was requested.
  if (Test-Path $dstWU) {
    Stop-LockingProcesses
    try {
      $removed = Remove-DirBestEffort -Path $dstWU -Retries 8 -DelayMs 450
      if (-not $removed) {
        throw ('Failed to remove directory after retries: ' + $dstWU)
      }
    } catch {
      $canReplace = $false
      $msg = ('Cannot replace release2_build\\win-unpacked (it may be in use). Will update in-place. Details: ' + $_.Exception.Message)
      if ($StrictWinUnpacked) {
        throw $msg
      }
      Write-Warning ($msg -replace 'Will update in-place', 'Will copy to a stamped folder beside win-unpacked')
    }
  }
  if (-not $canReplace) {
    $stampForDir = Get-Date -Format 'yyyyMMdd_HHmmss'
    $altWU = Join-Path $final ('win-unpacked_' + $stampForDir)
    try {
      Copy-WinUnpackedTree -SourceRoot $srcWU -DestRoot $altWU
      $winUnpackedKeepExtras += (Split-Path $altWU -Leaf)
      $hint = @(
        $altWU
        ''
        'release2_build\win-unpacked is still locked (often AZRAR.exe or Explorer preview). Close the app and rebuild to refresh the default folder, or run AZRAR.exe from the path above.'
      ) -join "`r`n"
      Set-Content -LiteralPath (Join-Path $final 'WIN_UNPACKED_LATEST.txt') -Encoding utf8 -Value $hint
      $winUnpackedKeepExtras += 'WIN_UNPACKED_LATEST.txt'
      Write-Host ('Fresh win-unpacked for this build: ' + $altWU)
    } catch {
      Write-Warning ('Stamped win-unpacked copy failed: ' + $_.Exception.Message)
      Write-Warning 'Skipping win-unpacked copy due to file lock. Installer and update files were still generated.'
    }
  } else {
    try {
      Copy-WinUnpackedTree -SourceRoot $srcWU -DestRoot $dstWU
      Remove-Item -LiteralPath (Join-Path $final 'WIN_UNPACKED_LATEST.txt') -Force -ErrorAction SilentlyContinue
    } catch {
      throw
    }
  }
}

$keepNames = @($expectedExeName,$expectedMapName,'win-unpacked','.icon-ico') + $winUnpackedKeepExtras
foreach ($meta in @('latest.yml','builder-effective-config.yaml','builder-debug.yml')) {
  if (Test-Path (Join-Path $final $meta)) {
    $keepNames += $meta
  }
}
Get-ChildItem -Path $final -Force | ForEach-Object {
  if ($keepNames -notcontains $_.Name) {
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
  }
}

# Cleanup stage directory after successful build (best effort).
try {
  Stop-LockingProcesses
  $null = Remove-DirBestEffort -Path $stage -Retries 6 -DelayMs 400
} catch {
  Write-Warning ('Failed to cleanup build stage folder (non-fatal): ' + $stage)
}

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

if ($Sign -and $finalExePath -and (Test-Path $finalExePath)) {
  try {
    Write-Host ''
    Write-Host 'Signing final installer (post-build)...'
    $signScript = Join-Path $PSScriptRoot 'code-sign-installer.ps1'

    if ($env:CSC_LINK -and $env:CSC_LINK.Trim()) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $signScript -InstallerPath $finalExePath -PfxPath $env:CSC_LINK -PfxPasswordEnvVar 'CSC_KEY_PASSWORD' -TimestampUrl $Rfc3161TimeStampServer -SigningProfile $SigningProfile
    } elseif ($env:CSC_THUMBPRINT -and $env:CSC_THUMBPRINT.Trim()) {
      $thumb = ($env:CSC_THUMBPRINT -replace '\s', '').ToUpperInvariant()
      & powershell -NoProfile -ExecutionPolicy Bypass -File $signScript -InstallerPath $finalExePath -CertThumbprint $thumb -TimestampUrl $Rfc3161TimeStampServer -SigningProfile $SigningProfile
    } elseif ($env:CSC_NAME -and $env:CSC_NAME.Trim()) {
      $thumb = Find-CodeSigningCertThumbprintByName $env:CSC_NAME
      if ($thumb) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $signScript -InstallerPath $finalExePath -CertThumbprint $thumb -TimestampUrl $Rfc3161TimeStampServer -SigningProfile $SigningProfile
      } else {
        Write-Warning 'CSC_NAME is set but no matching code-signing certificate with private key was found in the Windows Certificate Store. Use CSC_THUMBPRINT or CSC_LINK/CSC_KEY_PASSWORD.'
      }
    } else {
      Write-Warning 'Signed build requested but no CSC_LINK/CSC_NAME found at signing time (unexpected).'
    }

    Write-Host ''
    Write-Host 'Authenticode signature status (final installer):'
    $sig = Get-AuthenticodeSignature -FilePath $finalExePath
    $sig | Format-List

    if ($SigningProfile -eq 'prod' -and $sig.Status -ne 'Valid') {
      Write-Warning 'Production signing profile requested, but installer signature is not Valid. Check certificate and timestamp settings.'
    }
  } catch {
    Write-Warning ('Failed to read Authenticode signature (non-fatal): ' + $_.Exception.Message)
  }
}

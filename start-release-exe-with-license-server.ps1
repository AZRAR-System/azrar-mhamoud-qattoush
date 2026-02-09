param(
  [string]$ExePath = "",
  [string]$LicenseHost = "127.0.0.1",
  [int]$LicensePort = 5056,
  [string]$AdminToken = "dev-admin-token"
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Stop-ListeningPort([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { return }
  $pidToKill = $conn.OwningProcess
  if (-not $pidToKill) { return }
  Write-Host "[startup] freeing port $Port (pid=$pidToKill)" -ForegroundColor DarkYellow
  try { Stop-Process -Id $pidToKill -Force -ErrorAction Stop } catch { }
}

function Wait-HttpOk([string]$Url, [int]$TimeoutMs, [System.Diagnostics.Process]$WatchProcess) {
  $start = Get-Date
  while ($true) {
    if ($WatchProcess) { $WatchProcess.Refresh() }
    if ($WatchProcess -and $WatchProcess.HasExited) {
      throw "Process exited before server became ready (pid=$($WatchProcess.Id))."
    }

    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        return
      }
    } catch { }

    $elapsed = (Get-Date) - $start
    if ($elapsed.TotalMilliseconds -ge $TimeoutMs) {
      throw "Timed out waiting for: $Url"
    }
    Start-Sleep -Milliseconds 500
  }
}

$root = (Resolve-Path $PSScriptRoot).Path

if (-not $ExePath) {
  $candidate = Join-Path $root 'release2_build\win-unpacked\AZRAR.exe'
  if (Test-Path $candidate) {
    $ExePath = $candidate
  }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
  throw "ExePath not found. Provide -ExePath, e.g. -ExePath .\release2_build\win-unpacked\AZRAR.exe"
}

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR Desktop (EXE) + License Server" -ForegroundColor Cyan
Write-Host "EXE: $ExePath" -ForegroundColor DarkGray
Write-Host "License: http://$LicenseHost`:$LicensePort" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor DarkCyan

Stop-ListeningPort -Port $LicensePort

$privateKeyFile = Join-Path $root 'secrets\azrar-license-private.key.json'
if (-not (Test-Path $privateKeyFile)) {
  Write-Host "[license-server] generating dev keys..." -ForegroundColor DarkGray
  node (Join-Path $root 'scripts\generate-license-keys.mjs')
}

$env:AZRAR_LICENSE_HOST = $LicenseHost
$env:AZRAR_LICENSE_PORT = "$LicensePort"
$env:AZRAR_LICENSE_ADMIN_TOKEN = $AdminToken
$env:AZRAR_LICENSE_PRIVATE_KEY_FILE = $privateKeyFile

$licenseProc = $null
try {
  $logDir = Join-Path $root 'tmp'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $licenseOutLog = Join-Path $logDir 'license-server.autostart.exe.out.log'
  $licenseErrLog = Join-Path $logDir 'license-server.autostart.exe.err.log'
  if (Test-Path $licenseOutLog) { Remove-Item $licenseOutLog -Force -ErrorAction SilentlyContinue }
  if (Test-Path $licenseErrLog) { Remove-Item $licenseErrLog -Force -ErrorAction SilentlyContinue }

  $licenseScript = Join-Path $root 'server\license-server.mjs'
  $licenseArg = '"' + $licenseScript + '"'
  $licenseProc = Start-Process -FilePath 'node' -ArgumentList $licenseArg -WorkingDirectory $root -PassThru -RedirectStandardOutput $licenseOutLog -RedirectStandardError $licenseErrLog -WindowStyle Minimized

  Wait-HttpOk -Url "http://$LicenseHost`:$LicensePort/" -TimeoutMs 30000 -WatchProcess $licenseProc

  Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path -Parent $ExePath) | Out-Null
  Write-Host "[startup] app started. Close the app then stop this script to stop the license server." -ForegroundColor DarkGray

  Wait-Process -Id $licenseProc.Id
} finally {
  if ($licenseProc -and -not $licenseProc.HasExited) {
    try { Stop-Process -Id $licenseProc.Id -Force -ErrorAction SilentlyContinue } catch { }
  }
}

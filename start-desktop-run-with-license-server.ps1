param(
  [string]$LicenseHost = "127.0.0.1",
  [int]$LicensePort = 5056,
  [string]$AdminToken = "dev-admin-token"
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR Real Estate Management System" -ForegroundColor Cyan
Write-Host "Starting Desktop (built) + License Server..." -ForegroundColor Cyan
Write-Host "Desktop: Electron (desktop:run)" -ForegroundColor DarkGray
Write-Host "License: http://$LicenseHost`:$LicensePort" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor DarkCyan

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

Stop-ListeningPort -Port $LicensePort

$licenseProc = $null
try {
  $root = (Resolve-Path $PSScriptRoot).Path
  $privateKeyFile = Join-Path $root 'secrets\azrar-license-private.key.json'

  if (-not (Test-Path $privateKeyFile)) {
    Write-Host "[license-server] generating dev keys..." -ForegroundColor DarkGray
    node (Join-Path $root 'scripts\generate-license-keys.mjs')
  }

  $env:AZRAR_LICENSE_HOST = $LicenseHost
  $env:AZRAR_LICENSE_PORT = "$LicensePort"
  $env:AZRAR_LICENSE_ADMIN_TOKEN = $AdminToken
  $env:AZRAR_LICENSE_PRIVATE_KEY_FILE = $privateKeyFile

  Write-Host "[license-server] starting on http://$LicenseHost`:$LicensePort" -ForegroundColor DarkGray

  $logDir = Join-Path $root 'tmp'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $licenseOutLog = Join-Path $logDir 'license-server.autostart.run.out.log'
  $licenseErrLog = Join-Path $logDir 'license-server.autostart.run.err.log'
  if (Test-Path $licenseOutLog) { Remove-Item $licenseOutLog -Force -ErrorAction SilentlyContinue }
  if (Test-Path $licenseErrLog) { Remove-Item $licenseErrLog -Force -ErrorAction SilentlyContinue }

  $licenseScript = Join-Path $root 'server\license-server.mjs'
  $licenseArg = '"' + $licenseScript + '"'
  $licenseProc = Start-Process -FilePath 'node' -ArgumentList $licenseArg -WorkingDirectory $root -PassThru -RedirectStandardOutput $licenseOutLog -RedirectStandardError $licenseErrLog -WindowStyle Minimized

  try {
    Wait-HttpOk -Url "http://$LicenseHost`:$LicensePort/" -TimeoutMs 30000 -WatchProcess $licenseProc
  } catch {
    if ($licenseProc) { $licenseProc.Refresh() }
    if ($licenseProc -and $licenseProc.HasExited) {
      $outTail = if (Test-Path $licenseOutLog) { (Get-Content -Path $licenseOutLog -Tail 60 -ErrorAction SilentlyContinue) -join "`n" } else { "" }
      $errTail = if (Test-Path $licenseErrLog) { (Get-Content -Path $licenseErrLog -Tail 60 -ErrorAction SilentlyContinue) -join "`n" } else { "" }
      if ($outTail -or $errTail) {
        throw ("$($_.Exception.Message)`n--- license stdout (tail) ---`n$outTail`n--- license stderr (tail) ---`n$errTail")
      }
    }
    throw
  }

  npm run desktop:run
} finally {
  if ($licenseProc -and -not $licenseProc.HasExited) {
    try { Stop-Process -Id $licenseProc.Id -Force -ErrorAction SilentlyContinue } catch { }
  }
}

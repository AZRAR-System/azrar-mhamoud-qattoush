param(
  [string]$BaseUrl = $(if ($env:AZRAR_LICENSE_SERVER_URL) { $env:AZRAR_LICENSE_SERVER_URL } else { 'http://127.0.0.1:5056' }),
  [string]$AdminToken = $(if ($env:AZRAR_LICENSE_ADMIN_TOKEN) { $env:AZRAR_LICENSE_ADMIN_TOKEN } else { 'dev-admin-token' }),
  [ValidateSet('menu','issue','activate','setStatus','status')][string]$Cmd = 'menu',

  # Common
  [string]$LicenseKey = '',
  [string]$DeviceId = '',

  # issue
  [int]$MaxActivations = 1,
  [string]$ExpiresAt = '',
  [string]$FeaturesJson = '',

  # setStatus
  [ValidateSet('active','suspended','revoked')][string]$Status = 'active',
  [string]$Note = '',

  # activate
  [string]$OutFile = 'tmp\signed-license.json'
)

$ErrorActionPreference = 'Stop'

function Normalize-BaseUrl([string]$u) {
  $raw = if ($null -eq $u) { '' } else { [string]$u }
  $raw = $raw.Trim()
  if (-not $raw) { return '' }
  return $raw.TrimEnd('/')
}

function Ensure-Dir([string]$filePath) {
  $dir = Split-Path -Parent $filePath
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

function Parse-Features([string]$json) {
  $txt = if ($null -eq $json) { '' } else { [string]$json }
  $txt = $txt.Trim()
  if (-not $txt) { return $null }
  try {
    $obj = $txt | ConvertFrom-Json -ErrorAction Stop
    if ($obj -is [System.Collections.IDictionary]) { return $obj }
    if ($obj -is [pscustomobject]) {
      $h = @{}
      $obj.PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value }
      return $h
    }
    throw 'features must be a JSON object like {"pro":true}'
  } catch {
    throw "Invalid FeaturesJson: $($_.Exception.Message)"
  }
}

function Invoke-LicenseApi([
  Parameter(Mandatory=$true)][ValidateSet('GET','POST')][string]$Method,
  [Parameter(Mandatory=$true)][string]$Path,
  [hashtable]$Headers = @{},
  $BodyObj = $null
) {
  $base = Normalize-BaseUrl $BaseUrl
  if (-not $base) { throw 'BaseUrl is empty.' }

  $uri = $base + $Path

  if ($Method -eq 'GET') {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $Headers -TimeoutSec 30
  }

  $bodyJson = $null
  if ($null -ne $BodyObj) {
    $bodyJson = $BodyObj | ConvertTo-Json -Depth 20
  }

  return Invoke-RestMethod -Method Post -Uri $uri -Headers $Headers -ContentType 'application/json' -Body $bodyJson -TimeoutSec 30
}

function Cmd-Issue {
  $headers = @{ 'X-Admin-Token' = $AdminToken }
  $body = @{ maxActivations = $MaxActivations }

  $exp = if ($null -eq $ExpiresAt) { '' } else { [string]$ExpiresAt }
  if ($exp.Trim()) { $body.expiresAt = $exp.Trim() }

  $features = Parse-Features $FeaturesJson
  if ($features) { $body.features = $features }

  $res = Invoke-LicenseApi -Method POST -Path '/api/license/admin/issue' -Headers $headers -BodyObj $body
  if (-not $res.ok) { throw "Issue failed: $($res.error)" }

  Write-Host "LICENSE_KEY=$($res.licenseKey)"
  Write-Host "status=$($res.record.status) maxActivations=$($res.record.maxActivations) expiresAt=$($res.record.expiresAt)"
}

function Cmd-SetStatus {
  if (-not $LicenseKey.Trim()) { throw 'LicenseKey is required.' }

  $headers = @{ 'X-Admin-Token' = $AdminToken }
  $body = @{ licenseKey = $LicenseKey.Trim(); status = $Status.Trim() }
  $noteVal = if ($null -eq $Note) { '' } else { [string]$Note }
  if ($noteVal.Trim()) { $body.note = $noteVal.Trim() }

  $res = Invoke-LicenseApi -Method POST -Path '/api/license/admin/setStatus' -Headers $headers -BodyObj $body
  if (-not $res.ok) { throw "setStatus failed: $($res.error)" }

  Write-Host 'OK'
  Write-Host "licenseKey=$($res.record.licenseKey)"
  Write-Host "status=$($res.record.status)"
  Write-Host "statusUpdatedAt=$($res.record.statusUpdatedAt)"
  if ($res.record.statusNote) { Write-Host "statusNote=$($res.record.statusNote)" }
}

function Cmd-Activate {
  if (-not $LicenseKey.Trim()) { throw 'LicenseKey is required.' }
  if (-not $DeviceId.Trim()) { throw 'DeviceId is required (from the client device fingerprint screen).' }

  $body = @{ licenseKey = $LicenseKey.Trim(); deviceId = $DeviceId.Trim() }
  $res = Invoke-LicenseApi -Method POST -Path '/api/license/activate' -BodyObj $body
  if (-not $res.ok) { throw "Activate failed: $($res.error)" }

  $payload = @{ signedLicense = $res.signedLicense } | ConvertTo-Json -Depth 20

  $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $absOut = if ([System.IO.Path]::IsPathRooted($OutFile)) { $OutFile } else { Join-Path $root $OutFile }
  Ensure-Dir $absOut

  Set-Content -Path $absOut -Value $payload -Encoding UTF8

  Write-Host "Wrote signed license file: $absOut"
  Write-Host "Use it in the app via: 'Load license file'"
}

function Cmd-Status {
  if (-not $LicenseKey.Trim()) { throw 'LicenseKey is required.' }
  if (-not $DeviceId.Trim()) { throw 'DeviceId is required to check status.' }

  $body = @{ licenseKey = $LicenseKey.Trim(); deviceId = $DeviceId.Trim() }
  $res = Invoke-LicenseApi -Method POST -Path '/api/license/status' -BodyObj $body
  $res | ConvertTo-Json -Depth 20
}

function Show-Menu {
  Write-Host ''
  Write-Host 'AZRAR License Admin (Server-linked)'
  Write-Host "BaseUrl: $(Normalize-BaseUrl $BaseUrl)"
  Write-Host ''
  Write-Host '1) Issue License Key'
  Write-Host '2) Generate Offline Activation File (licenseKey + deviceId)'
  Write-Host '3) Change License Status (active/suspended/revoked)'
  Write-Host '4) Check License Status (requires deviceId)'
  Write-Host '5) Exit'
  Write-Host ''

  $choice = Read-Host 'Select an option (1-5)'

  switch ($choice) {
    '1' {
      $ma = Read-Host 'MaxActivations (default 1)'
      if ($ma.Trim()) { $script:MaxActivations = [int]$ma }

      $exp = Read-Host 'ExpiresAt (ISO optional, e.g. 2026-12-31T23:59:59Z)'
      $script:ExpiresAt = $exp

      $fj = Read-Host 'Features JSON (optional, e.g. {"pro": true})'
      $script:FeaturesJson = $fj

      Cmd-Issue
    }
    '2' {
      $lk = Read-Host 'LicenseKey (e.g. LIC-...)'
      $did = Read-Host 'DeviceId (fingerprint) (e.g. fp2:...)'
      $out = Read-Host "OutFile (default $OutFile)"

      $script:LicenseKey = $lk
      $script:DeviceId = $did
      if ($out.Trim()) { $script:OutFile = $out.Trim() }

      Cmd-Activate
    }
    '3' {
      $lk = Read-Host 'LicenseKey (e.g. LIC-...)'
      $st = Read-Host 'Status (active|suspended|revoked)'
      $nt = Read-Host 'Note (optional)'

      $script:LicenseKey = $lk
      $script:Status = $st
      $script:Note = $nt

      Cmd-SetStatus
    }
    '4' {
      $lk = Read-Host 'LicenseKey (e.g. LIC-...)'
      $did = Read-Host 'DeviceId (fingerprint) (e.g. fp2:...)'

      $script:LicenseKey = $lk
      $script:DeviceId = $did

      Cmd-Status
    }
    default {
      return
    }
  }
}

try {
  switch ($Cmd) {
    'issue' { Cmd-Issue }
    'activate' { Cmd-Activate }
    'setStatus' { Cmd-SetStatus }
    'status' { Cmd-Status }
    default { Show-Menu }
  }
} catch {
  Write-Host ('ERROR: ' + $_.Exception.Message)
  exit 1
}

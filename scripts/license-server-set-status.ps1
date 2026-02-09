param(
  [string]$BaseUrl = "http://127.0.0.1:5056",
  [string]$AdminToken = "dev-admin-token",
  [Parameter(Mandatory=$true)][string]$LicenseKey,
  [Parameter(Mandatory=$true)][ValidateSet('active','suspended','revoked')][string]$Status,
  [string]$Note = ""
)

$ErrorActionPreference = 'Stop'

$headers = @{ 'X-Admin-Token' = $AdminToken }
$body = @{ 
  licenseKey = $LicenseKey.Trim()
  status = $Status.Trim()
}
if ($Note.Trim()) { $body.note = $Note.Trim() }

$uri = ($BaseUrl.TrimEnd('/') + '/api/license/admin/setStatus')
$res = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)

if (-not $res.ok) {
  throw "setStatus failed: $($res.error)"
}

Write-Host "OK"
Write-Host "licenseKey=$($res.record.licenseKey)"
Write-Host "status=$($res.record.status)"
Write-Host "statusUpdatedAt=$($res.record.statusUpdatedAt)"
if ($res.record.statusNote) { Write-Host "statusNote=$($res.record.statusNote)" }

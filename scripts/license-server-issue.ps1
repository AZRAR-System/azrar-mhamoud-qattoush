param(
  [string]$BaseUrl = "http://127.0.0.1:5056",
  [string]$AdminToken = "dev-admin-token",
  [int]$MaxActivations = 1,
  [string]$ExpiresAt = "",
  [hashtable]$Features = @{}
)

$ErrorActionPreference = 'Stop'

$headers = @{ 'X-Admin-Token' = $AdminToken }
$body = @{
  maxActivations = $MaxActivations
}
if ($ExpiresAt.Trim()) { $body.expiresAt = $ExpiresAt.Trim() }
if ($Features.Count -gt 0) { $body.features = $Features }

$uri = ($BaseUrl.TrimEnd('/') + '/api/license/admin/issue')
$res = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)

if (-not $res.ok) {
  throw "Issue failed: $($res.error)"
}

Write-Host "LICENSE_KEY=$($res.licenseKey)"
Write-Host "Record status=$($res.record.status) maxActivations=$($res.record.maxActivations) expiresAt=$($res.record.expiresAt)"

param(
  [string]$BaseUrl = "http://127.0.0.1:5056",
  [Parameter(Mandatory=$true)][string]$LicenseKey,
  [Parameter(Mandatory=$true)][string]$DeviceId,
  [string]$OutFile = "tmp\\signed-license.json"
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$uri = ($BaseUrl.TrimEnd('/') + '/api/license/activate')
$body = @{ licenseKey = $LicenseKey.Trim(); deviceId = $DeviceId.Trim() } | ConvertTo-Json -Depth 10

$res = Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $body
if (-not $res.ok) {
  throw "Activate failed: $($res.error)"
}

# Save exactly what client expects: signedLicense object.
$payload = @{ signedLicense = $res.signedLicense } | ConvertTo-Json -Depth 20

$absOut = if ([System.IO.Path]::IsPathRooted($OutFile)) { $OutFile } else { Join-Path $root $OutFile }
$dir = Split-Path -Parent $absOut
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

Set-Content -Path $absOut -Value $payload -Encoding UTF8

Write-Host "Wrote signed license file: $absOut"
Write-Host "Use it in the app via: تحميل ملف التفعيل"

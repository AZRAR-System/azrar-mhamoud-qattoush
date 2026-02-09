param(
  [string]$LicenseServerUrl = "http://127.0.0.1:5056"
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$env:AZRAR_LICENSE_SERVER_URL = $LicenseServerUrl

# Dev convenience: provide public key via env so the app can verify signatures.
$pubFile = Join-Path $root 'electron\assets\azrar-license-public.key.json'
if (Test-Path $pubFile) {
  try {
    $pubJson = Get-Content -Raw -Encoding UTF8 $pubFile | ConvertFrom-Json
    if ($pubJson -and $pubJson.publicKeyB64) {
      $env:AZRAR_LICENSE_PUBLIC_KEY_B64 = [string]$pubJson.publicKeyB64
      Write-Host "[desktop:dev] AZRAR_LICENSE_PUBLIC_KEY_B64 loaded from $pubFile"
    }
  } catch {
    Write-Host "[desktop:dev] failed to load public key from $pubFile"
  }
}

Write-Host "[desktop:dev] AZRAR_LICENSE_SERVER_URL=$LicenseServerUrl"

npm run desktop:dev

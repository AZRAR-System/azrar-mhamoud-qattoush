param(
  [Parameter(Mandatory = $false)]
  [string]$Subject = 'CN=AZRAR Development, O=AZRAR',

  [Parameter(Mandatory = $false)]
  [string]$FriendlyName = 'AZRAR Development Code Signing Certificate',

  [Parameter(Mandatory = $false)]
  [int]$YearsValid = 3,

  [Parameter(Mandatory = $false)]
  [string]$OutputDir = (Join-Path $env:USERPROFILE 'AZRAR-Certificates'),

  [Parameter(Mandatory = $false)]
  [string]$PfxName = 'azrar-dev-codesign.pfx',

  [Parameter(Mandatory = $false)]
  [string]$CerName = 'azrar-dev-codesign.cer',

  [Parameter(Mandatory = $false)]
  [string]$PfxPassword,

  [Parameter(Mandatory = $false)]
  [string]$PfxPasswordEnvVar = 'AZRAR_DEV_PFX_PASSWORD',

  [Parameter(Mandatory = $false)]
  [switch]$TrustCurrentUser,

  [Parameter(Mandatory = $false)]
  [switch]$TrustLocalMachine,

  [Parameter(Mandatory = $false)]
  [switch]$KeepInStore
)

$ErrorActionPreference = 'Stop'

function Ensure-Dir([string]$p) {
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

if ($YearsValid -lt 1 -or $YearsValid -gt 25) {
  throw 'YearsValid must be between 1 and 25.'
}

if ($TrustCurrentUser -and $TrustLocalMachine) {
  throw 'Choose only one: -TrustCurrentUser or -TrustLocalMachine.'
}

Ensure-Dir $OutputDir

$pfxPath = Join-Path $OutputDir $PfxName
$cerPath = Join-Path $OutputDir $CerName

Write-Host 'Creating a self-signed Code Signing certificate (DEV/INTERNAL ONLY)...'
Write-Host "Subject: $Subject"
Write-Host "FriendlyName: $FriendlyName"

$notAfter = (Get-Date).AddYears($YearsValid)

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -KeyUsage DigitalSignature `
  -FriendlyName $FriendlyName `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter $notAfter `
  -TextExtension @(
    '2.5.29.37={text}1.3.6.1.5.5.7.3.3',
    '2.5.29.19={text}'
  )

if (-not $cert -or -not $cert.Thumbprint) {
  throw 'Failed to create certificate.'
}

$thumb = ($cert.Thumbprint -replace '\s', '').ToUpperInvariant()
Write-Host "Thumbprint: $thumb"
Write-Host "Valid until: $($cert.NotAfter)"

Write-Host ''
Write-Host 'Exporting CER (public) and PFX (private)...'
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

$securePass = $null
if ($PfxPassword -and $PfxPassword.Trim().Length -gt 0) {
  $securePass = ConvertTo-SecureString -String $PfxPassword -AsPlainText -Force
} else {
  $envPass = $null
  if ($PfxPasswordEnvVar -and $PfxPasswordEnvVar.Trim().Length -gt 0) {
    $envPass = [System.Environment]::GetEnvironmentVariable($PfxPasswordEnvVar)
  }
  if ($envPass -and $envPass.Trim().Length -gt 0) {
    $securePass = ConvertTo-SecureString -String $envPass -AsPlainText -Force
  } else {
    $securePass = Read-Host 'Enter a password to protect the PFX' -AsSecureString
  }
}

Export-PfxCertificate -Cert ("Cert:\CurrentUser\My\$thumb") -FilePath $pfxPath -Password $securePass | Out-Null

Write-Host "CER: $cerPath"
Write-Host "PFX: $pfxPath"

if ($TrustCurrentUser -or $TrustLocalMachine) {
  $scope = if ($TrustLocalMachine) { 'LocalMachine' } else { 'CurrentUser' }
  Write-Host ''
  Write-Host "Trusting the certificate for $scope (to reduce 'Unknown Publisher' warnings on that machine)..."

  $rootStore = "Cert:\$scope\Root"
  $pubStore = "Cert:\$scope\TrustedPublisher"

  try {
    Import-Certificate -FilePath $cerPath -CertStoreLocation $rootStore | Out-Null
    Import-Certificate -FilePath $cerPath -CertStoreLocation $pubStore | Out-Null
    Write-Host 'Trusted successfully.'
  } catch {
    Write-Warning "Failed to trust certificate in $scope stores. If using LocalMachine, run PowerShell as Administrator. Details: $($_.Exception.Message)"
  }
}

if (-not $KeepInStore) {
  try {
    Remove-Item -Path ("Cert:\CurrentUser\My\$thumb") -Force -ErrorAction SilentlyContinue
  } catch {
    Write-Warning "Failed to remove cert from store (safe to ignore): $($_.Exception.Message)"
  }
}

Write-Host ''
Write-Host 'Next steps (local session):'
Write-Host "  `\$env:CSC_LINK = '$pfxPath'"
Write-Host "  `\$env:CSC_KEY_PASSWORD = '<PFX password>'"
Write-Host ''
Write-Host 'To build a signed desktop installer (will sign outputs via electron-builder):'
Write-Host '  npm run desktop:dist:signed'
Write-Host ''
Write-Host 'Or to sign the installer only (post-build):'
Write-Host "  npm run desktop:dist"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/code-sign-installer.ps1 -PfxPath '$pfxPath'"
Write-Host ''
Write-Host 'Note: Self-signed certificates are NOT trusted for public distribution. Use an OV/EV certificate from a CA for production.'

param(
  [Parameter(Mandatory = $true)]
  [string]$CertThumbprint,

  [Parameter(Mandatory = $false)]
  [ValidateSet('CurrentUser','LocalMachine')]
  [string]$Scope = 'CurrentUser'
)

$ErrorActionPreference = 'Stop'

function Get-CertByThumbprint([string]$thumb) {
  $t = ($thumb -replace '\s', '').ToUpperInvariant()
  $cert = $null
  try { $cert = Get-Item "Cert:\CurrentUser\My\$t" -ErrorAction SilentlyContinue } catch {}
  if (-not $cert) {
    try { $cert = Get-Item "Cert:\LocalMachine\My\$t" -ErrorAction SilentlyContinue } catch {}
  }
  return $cert
}

$cert = Get-CertByThumbprint $CertThumbprint
if (-not $cert) { throw "Certificate not found in store (CurrentUser\\My or LocalMachine\\My): $CertThumbprint" }

$subject = [string]$cert.Subject
$issuer = [string]$cert.Issuer
$thumb = ($cert.Thumbprint -replace '\s', '').ToUpperInvariant()

Write-Host "Found certificate:"
Write-Host "  Subject: $subject"
Write-Host "  Issuer : $issuer"
Write-Host "  Thumb  : $thumb"
Write-Host "  Expires: $($cert.NotAfter)"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outDir = Join-Path $repoRoot 'release2_build'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$exportDir = Join-Path $outDir 'certs'
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

$cerPath = Join-Path $exportDir ("codesign_{0}.cer" -f ($thumb.Substring(0,12)))
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "Exported public certificate (no private key): $cerPath"

$rootStore = "Cert:\$Scope\Root"
$publisherStore = "Cert:\$Scope\TrustedPublisher"

Write-Host "Installing trust to: $Scope"
Write-Host "  - Trusted Root Certification Authorities (Root)"
Write-Host "  - Trusted Publishers"

Import-Certificate -FilePath $cerPath -CertStoreLocation $rootStore | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation $publisherStore | Out-Null

Write-Host ''
Write-Host 'Done.'
Write-Host 'If the installer is already signed, re-check in Explorer: Properties -> Digital Signatures.'
Write-Host 'For organization-wide deployment, distribute the .cer via Group Policy (GPO) to Root + Trusted Publishers.'

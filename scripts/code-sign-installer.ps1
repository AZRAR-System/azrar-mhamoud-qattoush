param(
  [Parameter(Mandatory = $false)]
  [string]$InstallerPath,

  [Parameter(Mandatory = $false)]
  [string]$PfxPath,

  [Parameter(Mandatory = $false)]
  [string]$PfxPassword,

  [Parameter(Mandatory = $false)]
  [string]$PfxPasswordEnvVar = 'CSC_KEY_PASSWORD',

  [Parameter(Mandatory = $false)]
  [string]$CertThumbprint,

  [Parameter(Mandatory = $false)]
  [string]$TimestampUrl = 'http://timestamp.digicert.com',

  [Parameter(Mandatory = $false)]
  [string]$Description = 'AZRAR Real Estate Management System',

  [Parameter(Mandatory = $false)]
  [string]$DescriptionUrl,

  [Parameter(Mandatory = $false)]
  [switch]$NoTimestamp,

  [Parameter(Mandatory = $false)]
  [switch]$NoCleanup
)

$ErrorActionPreference = 'Stop'

function Get-LatestSignToolPath {
  $kitsRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  if (-not (Test-Path $kitsRoot)) { return $null }

  $paths = Get-ChildItem $kitsRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Select-Object -ExpandProperty FullName

  if (-not $paths -or $paths.Count -eq 0) { return $null }

  # Prefer the highest SDK version folder.
  $best = $paths | Sort-Object {
    $m = [regex]::Match($_, 'bin\\(?<v>\d+\.\d+\.\d+\.\d+)\\x64\\signtool\.exe$')
    if ($m.Success) { [version]$m.Groups['v'].Value } else { [version]'0.0.0.0' }
  } -Descending | Select-Object -First 1

  return $best
}

function Resolve-InstallerPath([string]$maybe) {
  if ($maybe -and (Test-Path $maybe)) { return (Resolve-Path $maybe).Path }

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $outDir = Join-Path $repoRoot 'release2_build'
  if (-not (Test-Path $outDir)) { throw "release2_build not found at: $outDir" }

  $candidate = Get-ChildItem $outDir -Filter '*.exe' -File |
    Where-Object { $_.Name -match '^AZRAR Setup .*\.exe$' -and $_.Name -notmatch '\.blockmap' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $candidate) { throw "No installer .exe found in: $outDir" }
  return $candidate.FullName
}

function Print-FileHash([string]$path) {
  Write-Host ''
  Write-Host 'SHA256:'
  Get-FileHash -Algorithm SHA256 -Path $path | Format-List
}

$signtool = Get-LatestSignToolPath
if (-not $signtool) {
  throw "signtool.exe not found. Install Windows 10/11 SDK (Signing Tools), or add signtool to PATH."
}

$InstallerPath = Resolve-InstallerPath $InstallerPath
if (-not (Test-Path $InstallerPath)) { throw "Installer not found: $InstallerPath" }

Write-Host "Using signtool: $signtool"
Write-Host "Target installer: $InstallerPath"

# If already signed, show status.
$pre = Get-AuthenticodeSignature -FilePath $InstallerPath
if ($pre -and $pre.SignerCertificate) {
  Write-Host "Already has signature status: $($pre.Status)"
  Write-Host "Signer: $($pre.SignerCertificate.Subject)"
}

# Prepare certificate: either use thumbprint from store, or import from PFX.
$importedCert = $null
$cert = $null

if ($CertThumbprint) {
  $thumb = ($CertThumbprint -replace '\s', '').ToUpperInvariant()
  $cert = Get-Item "Cert:\CurrentUser\My\$thumb" -ErrorAction SilentlyContinue
  if (-not $cert) { $cert = Get-Item "Cert:\LocalMachine\My\$thumb" -ErrorAction SilentlyContinue }
  if (-not $cert) { throw "Certificate not found in store for thumbprint: $thumb" }
} else {
  if (-not $PfxPath) {
    throw 'Provide -PfxPath (recommended) or -CertThumbprint.'
  }
  if (-not (Test-Path $PfxPath)) {
    throw "PFX not found: $PfxPath"
  }

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
      $securePass = Read-Host 'Enter PFX password' -AsSecureString
    }
  }
  $importedCert = Import-PfxCertificate -FilePath $PfxPath -CertStoreLocation Cert:\CurrentUser\My -Password $securePass

  # Pick a code-signing cert from the import result (can be a collection).
  $cert = @($importedCert) |
    Where-Object { $_ -and $_.EnhancedKeyUsageList -and ($_.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3') } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

  if (-not $cert) {
    # Fallback: use the first imported cert.
    $cert = @($importedCert) | Select-Object -First 1
  }

  if (-not $cert) { throw 'Failed to import certificate from PFX.' }
}

$thumbprint = ($cert.Thumbprint -replace '\s', '').ToUpperInvariant()
Write-Host "Signing certificate: $($cert.Subject)"
Write-Host "Thumbprint: $thumbprint"
Write-Host "Valid until: $($cert.NotAfter)"

# Build signtool args.
$args = @('sign', '/v', '/fd', 'SHA256', '/sha1', $thumbprint, '/d', $Description)
if ($DescriptionUrl) { $args += @('/du', $DescriptionUrl) }
if (-not $NoTimestamp) {
  if (-not $TimestampUrl) { throw 'TimestampUrl is empty. Provide -TimestampUrl or use -NoTimestamp.' }
  $args += @('/tr', $TimestampUrl, '/td', 'SHA256')
}
$args += @($InstallerPath)

Write-Host ''
Write-Host 'Signing (final EXE only)...'
& $signtool @args

Write-Host ''
Write-Host 'Verifying signature...'
& $signtool verify /pa /v $InstallerPath

Write-Host ''
Write-Host 'Authenticode status:'
$post = Get-AuthenticodeSignature -FilePath $InstallerPath
$post | Format-List

Print-FileHash $InstallerPath

if (-not $NoCleanup -and $importedCert) {
  try {
    Write-Host ''
    Write-Host 'Cleaning up imported certificate from CurrentUser\My...'
    Remove-Item -Path ("Cert:\CurrentUser\My\$thumbprint") -Force -ErrorAction SilentlyContinue
  } catch {
    Write-Warning "Cleanup failed: $($_.Exception.Message)"
  }
}

Write-Host ''
Write-Host 'Done. Do NOT modify the installer after signing.'

param(
  [string]$HostAddr = "127.0.0.1",
  [int]$Port = 5056,
  [string]$AdminToken = "dev-admin-token"
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$privateKeyFile = Join-Path $root 'secrets\azrar-license-private.key.json'

if (-not (Test-Path $privateKeyFile)) {
  Write-Host "[license-server] generating dev keys..."
  node (Join-Path $root 'scripts\generate-license-keys.mjs')
}

$env:AZRAR_LICENSE_HOST = $HostAddr
$env:AZRAR_LICENSE_PORT = "$Port"
$env:AZRAR_LICENSE_ADMIN_TOKEN = $AdminToken
$env:AZRAR_LICENSE_PRIVATE_KEY_FILE = $privateKeyFile

Write-Host "[license-server] starting on http://$HostAddr`:$Port"
Write-Host "[license-server] admin token: $AdminToken"
Write-Host "[license-server] private key file: $privateKeyFile"

node (Join-Path $root 'server\license-server.mjs')

$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')

$shortcutPath = Join-Path $desktopDir 'AZRAR Desktop.lnk'
$targetExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

$startScript = Join-Path $projectRoot 'start-desktop.ps1'
if (-not (Test-Path $startScript)) {
  throw "start-desktop.ps1 not found: $startScript"
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = $targetExe
$sc.Arguments = $arguments
$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = 'Run AZRAR Desktop (Vite + Electron)'
$sc.Save()

Write-Host "Created shortcut: $shortcutPath" -ForegroundColor Green
Write-Host "Tip: Double-click 'AZRAR Desktop' on your Desktop." -ForegroundColor Cyan

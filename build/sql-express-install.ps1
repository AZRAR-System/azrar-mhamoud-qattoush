#Requires -Version 5.1
<#
  Optional SQL Server 2022 Express for AZRAR (elevated; invoked from NSIS).
  Flow: download Microsoft bootstrapper -> download media -> setup.exe + ConfigurationFile.ini
  Instance AZRARSQL, mixed auth, TCP 1433, DB AZRAR, login azrar_app. Credentials -> ProgramData.
#>
$ErrorActionPreference = 'Stop'

function Write-Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'o'), $m
  Write-Host $line
  Add-Content -Path $script:LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Host 'AZRAR SQL bootstrap: 64-bit Windows required. Skipping.'
  exit 0
}

$isAdmin =
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error 'This script must run as Administrator.'
  exit 1
}

$ProgramDataAzrar = Join-Path $env:ProgramData 'AZRAR'
$null = New-Item -ItemType Directory -Path $ProgramDataAzrar -Force -ErrorAction SilentlyContinue
$script:LogFile = Join-Path $ProgramDataAzrar 'sql-express-install.log'
$CredPath = Join-Path $ProgramDataAzrar 'sql-local-credentials.json'

$InstanceName = 'AZRARSQL'
$DbName = 'AZRAR'
$AppLogin = 'azrar_app'
$TcpPort = 1433

function New-SqlPassword {
  $g = [guid]::NewGuid().ToString('N')
  return ($g.Substring(0, 10) + 'Aa1!')
}

$saPwd = New-SqlPassword
$appPwd = New-SqlPassword

function Test-InstanceExists([string]$name) {
  $svc = "MSSQL`$$name"
  return [bool](Get-Service -Name $svc -ErrorAction SilentlyContinue)
}

function Find-SqlCmd {
  foreach ($r in @("${env:ProgramFiles}\Microsoft SQL Server", "${env:ProgramFiles(x86)}\Microsoft SQL Server")) {
    if (-not (Test-Path $r)) { continue }
    $hit = Get-ChildItem -Path $r -Recurse -Filter 'SQLCMD.EXE' -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if ($hit) { return $hit }
  }
  return $null
}

function Invoke-SqlCmdBatch([string]$sqlcmdExe, [string]$server, [string]$user, [string]$pass, [string]$sql) {
  $tmp = [System.IO.Path]::GetTempFileName() + '.sql'
  try {
    Set-Content -Path $tmp -Value $sql -Encoding UTF8
    $arg =
      if ($user -eq '-E') {
        @('-S', $server, '-E', '-b', '-i', $tmp)
      }
      else {
        @('-S', $server, '-U', $user, '-P', $pass, '-b', '-i', $tmp)
      }
    $p = Start-Process -FilePath $sqlcmdExe -ArgumentList $arg -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -ne 0) { throw "sqlcmd failed (exit $($p.ExitCode))" }
  }
  finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Wait-SqlService([string]$name, [int]$maxSec = 120) {
  $svc = "MSSQL`$$name"
  $dead = (Get-Date).AddSeconds($maxSec)
  while ((Get-Date) -lt $dead) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s -and $s.Status -eq 'Running') { return }
    Start-Sleep -Seconds 2
  }
  throw "Service $svc did not become Running within ${maxSec}s."
}

try {
  Write-Log 'AZRAR SQL bootstrap starting'

  if (-not (Test-InstanceExists $InstanceName)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $downloadUrl = 'https://go.microsoft.com/fwlink/?linkid=2216019'
    $bootstrapper = Join-Path $env:TEMP 'SQL2022-SSEI-Expr.exe'
    Write-Log 'Downloading SQL Server 2022 Express bootstrapper...'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $bootstrapper -UseBasicParsing

    $mediaPath = Join-Path $env:TEMP 'AZRAR_SQL2022_MEDIA'
    if (Test-Path $mediaPath) { Remove-Item -LiteralPath $mediaPath -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $mediaPath -Force | Out-Null

    Write-Log 'Downloading SQL Server media (may take several minutes)...'
    $dl = Start-Process -FilePath $bootstrapper -ArgumentList @(
      '/ACTION=Download',
      "/MEDIAPATH=$mediaPath",
      '/MEDIATYPE=Core',
      '/QUIET',
      '/IACCEPTSQLSERVERLICENSETERMS'
    ) -Wait -PassThru -NoNewWindow

    if ($dl.ExitCode -ne 0 -and $dl.ExitCode -ne 3010) {
      Write-Log "Download with MEDIATYPE=Core failed ($($dl.ExitCode)); retrying without MEDIATYPE..."
      $dl = Start-Process -FilePath $bootstrapper -ArgumentList @(
        '/ACTION=Download',
        "/MEDIAPATH=$mediaPath",
        '/QUIET',
        '/IACCEPTSQLSERVERLICENSETERMS'
      ) -Wait -PassThru -NoNewWindow
    }

    if ($dl.ExitCode -ne 0 -and $dl.ExitCode -ne 3010) {
      throw "SQL media download failed (exit $($dl.ExitCode)). See $LogFile"
    }

    $setupExe = Get-ChildItem -Path $mediaPath -Filter 'setup.exe' -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not $setupExe) {
      throw "setup.exe not found under $mediaPath. Check firewall/proxy and retry."
    }

    $iniPath = Join-Path $env:TEMP 'azrar-sql-configuration.ini'
    $saEsc = $saPwd -replace '"', '""'
    @"
; SQL Server — generated by AZRAR installer
[OPTIONS]
ACTION="Install"
FEATURES="SQLEngine"
INSTANCENAME="$InstanceName"
SECURITYMODE="SQL"
SAPWD="$saEsc"
TCPENABLED="1"
NPENABLED="1"
SQLSYSADMINACCOUNTS="BUILTIN\Administrators"
IACCEPTSQLSERVERLICENSETERMS="True"
QUIET="True"
UPDATEENABLED="False"
USESQLRECOMMENDEDMEMORYLIMITS="True"
"@ | Set-Content -Path $iniPath -Encoding Unicode

    Write-Log "Running setup: $setupExe /ConfigurationFile=..."
    $ins = Start-Process -FilePath $setupExe -ArgumentList @("/ConfigurationFile=$iniPath") -Wait -PassThru -NoNewWindow
    if ($ins.ExitCode -ne 0 -and $ins.ExitCode -ne 3010) {
      throw "SQL Server setup failed (exit $($ins.ExitCode)). Logs: $env:ProgramFiles\Microsoft SQL Server\120\Setup Bootstrap\Log or similar."
    }
    if ($ins.ExitCode -eq 3010) {
      Write-Log 'Setup requested a reboot (exit 3010). Continuing if services are up...'
    }
  }
  else {
    Write-Log "Instance $InstanceName already present — will use Windows auth (sqlcmd -E) for provisioning if possible."
  }

  Wait-SqlService -name $InstanceName

  $regRoot = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
  $instId = $null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $instId = (Get-ItemProperty -Path $regRoot -Name $InstanceName -ErrorAction Stop).$InstanceName
      if ($instId) { break }
    }
    catch {}
    Start-Sleep -Seconds 2
  }
  if (-not $instId) { throw 'Could not read SQL instance id from registry.' }
  $tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instId\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
  if (Test-Path $tcpKey) {
    Set-ItemProperty -Path $tcpKey -Name 'TcpPort' -Value $TcpPort -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $tcpKey -Name 'TcpDynamicPorts' -Value '' -ErrorAction SilentlyContinue
    Write-Log "TCP port set to $TcpPort"
    Restart-Service -Name "MSSQL`$$InstanceName" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 4
  }

  try {
    New-NetFirewallRule -DisplayName 'AZRAR SQL Server (TCP 1433)' -Direction Inbound -Protocol TCP -LocalPort $TcpPort -Action Allow -ErrorAction Stop | Out-Null
    Write-Log 'Firewall rule added for SQL port 1433.'
  }
  catch {
    Write-Log "Firewall SQL: $($_.Exception.Message)"
  }

  try {
    netsh advfirewall firewall add rule `
        name="AZRAR License Server" `
        dir=in `
        action=allow `
        protocol=TCP `
        localport=5056 `
        description="AZRAR Real Estate License Server"
    Write-Log 'Firewall rule added for License Server port 5056.'
  }
  catch {
    Write-Log "Firewall License Server: $($_.Exception.Message)"
  }

  $sqlcmd = Find-SqlCmd
  if (-not $sqlcmd) { throw 'sqlcmd.exe not found. Reboot and run the installer again, or install SQL Server Command Line Utilities.' }

  $serverConn = "127.0.0.1,$TcpPort"
  $serverNamed = "localhost\$InstanceName"
  $sqlBatch = @"
IF DB_ID(N'$DbName') IS NULL CREATE DATABASE [$DbName];
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$AppLogin')
  CREATE LOGIN [$AppLogin] WITH PASSWORD = N'$($appPwd.Replace("'","''"))', CHECK_POLICY = ON;
GO
USE [$DbName];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$AppLogin')
  CREATE USER [$AppLogin] FOR LOGIN [$AppLogin];
ALTER ROLE db_owner ADD MEMBER [$AppLogin];
GO
"@
  Write-Log 'Creating database and login...'
  try {
    Invoke-SqlCmdBatch -sqlcmdExe $sqlcmd -server $serverConn -user 'sa' -pass $saPwd -sql $sqlBatch
  }
  catch {
    Write-Log "SA connection failed ($($_.Exception.Message)); trying integrated security on $serverNamed ..."
    Invoke-SqlCmdBatch -sqlcmdExe $sqlcmd -server $serverNamed -user '-E' -pass '' -sql $sqlBatch
  }

  $cred = [ordered]@{
    server       = '127.0.0.1'
    port         = $TcpPort
    database     = $DbName
    authMode     = 'sql'
    user         = $AppLogin
    password     = $appPwd
    instanceName = $InstanceName
    installedAt  = (Get-Date).ToString('o')
    logFile      = $LogFile
  }
  Set-Content -Path $CredPath -Value ($cred | ConvertTo-Json -Depth 6) -Encoding UTF8
  Write-Log "Saved: $CredPath"

  # حفظ ملف نصي للمرجع السهل
  $txtPath = Join-Path $ProgramDataAzrar 'database-info.txt'
  $txtContent = @"
=== بيانات قاعدة بيانات AZRAR ===

الخادم: $env:COMPUTERNAME\$InstanceName
عنوان الاتصال: 127.0.0.1,$TcpPort
قاعدة البيانات: $DbName
المستخدم: $AppLogin
كلمة المرور: $appPwd
البورت: $TcpPort
تاريخ التثبيت: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

ملاحظة: يمكنك استخدام هذه المعلومات للاتصال بقاعدة البيانات مباشرة عبر SSMS أو أي عميل SQL آخر.
"@
  $txtContent | Out-File -FilePath $txtPath -Encoding UTF8
  Write-Log "Saved reference file: $txtPath"

  Write-Log 'Done.'
  exit 0
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  $_ | Out-String | Add-Content -Path $LogFile -Encoding UTF8
  try {
    Set-Content -Path (Join-Path $ProgramDataAzrar 'SQL-SETUP-ERROR.txt') -Value ($_ | Out-String) -Encoding UTF8
  }
  catch {}
  exit 1
}

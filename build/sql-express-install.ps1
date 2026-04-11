#Requires -Version 5.1
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

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error 'This script must run as Administrator.'
    exit 1
}

$ProgramDataAzrar = Join-Path $env:ProgramData 'AZRAR'
$null = New-Item -ItemType Directory -Path $ProgramDataAzrar -Force -ErrorAction SilentlyContinue
$script:LogFile = Join-Path $ProgramDataAzrar 'sql-express-install.log'
$CredPath = Join-Path $ProgramDataAzrar 'sql-local-credentials.json'

$InstanceName = "MSSQLSERVER"
$DbName = 'AZRAR'
$AppLogin = 'azrar_app'
$TcpPort = 1433

function New-SqlPassword {
    $g = [guid]::NewGuid().ToString('N')
    return ($g.Substring(0, 10) + 'Aa1!')
}

$appPwd = New-SqlPassword

function Test-InstanceExists([string]$name) {
    return [bool](Get-Service -Name $name -ErrorAction SilentlyContinue)
}

function Find-SqlCmd {
    foreach ($r in @("${env:ProgramFiles}\Microsoft SQL Server", "${env:ProgramFiles(x86)}\Microsoft SQL Server")) {
        if (-not (Test-Path $r)) { continue }
        $hit = Get-ChildItem -Path $r -Recurse -Filter 'SQLCMD.EXE' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if ($hit) { return $hit }
    }
    return $null
}

function Invoke-SqlCmdBatch([string]$sqlcmdExe, [string]$server, [string]$user, [string]$pass, [string]$sql) {
    $tmp = [System.IO.Path]::GetTempFileName() + '.sql'
    try {
        Set-Content -Path $tmp -Value $sql -Encoding UTF8
        $arg = if ($user -eq '-E') { @('-S', $server, '-E', '-C', '-b', '-i', $tmp) } else { @('-S', $server, '-U', $user, '-P', $pass, '-C', '-b', '-i', $tmp) }
        $p = Start-Process -FilePath $sqlcmdExe -ArgumentList $arg -Wait -PassThru -NoNewWindow
        if ($p.ExitCode -ne 0) { throw "sqlcmd failed (exit $($p.ExitCode))" }
    }
    finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

try {
    Write-Log "AZRAR SQL adoption starting (Target: $InstanceName)"

    if (-not (Test-InstanceExists $InstanceName)) {
        throw "Target instance $InstanceName not found on this machine."
    }

    $svc = Get-Service -Name $InstanceName
    if ($svc.Status -ne 'Running') {
        Write-Log "Starting $InstanceName service..."
        Start-Service -Name $InstanceName
    }

    # Connectivity Check & Configuration
    $regRoot = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
    $instId = (Get-ItemProperty -Path $regRoot -Name $InstanceName -ErrorAction SilentlyContinue).$InstanceName
    if ($instId) {
        $tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instId\MSSQLServer\SuperSocketNetLib\Tcp\IPAll"
        if (Test-Path $tcpKey) {
            Set-ItemProperty -Path $tcpKey -Name 'TcpPort' -Value $TcpPort -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $tcpKey -Name 'TcpDynamicPorts' -Value '' -ErrorAction SilentlyContinue
            Write-Log "TCP port verified/set to $TcpPort"
        }
    }

    # Firewall
    try {
        netsh advfirewall firewall add rule name="AZRAR SQL Server (TCP 1433)" dir=in action=allow protocol=TCP localport=$TcpPort description="SQL Server for AZRAR Real Estate System" profile=any
        Write-Log "Firewall rule configured for SQL port $TcpPort."
    } catch { }

    $sqlcmd = Find-SqlCmd
    if (-not $sqlcmd) { throw 'sqlcmd.exe not found.' }

    # Use '.' for local connection during provisioning to avoid SSPI context errors on networking
    $serverConn = "."
    $sqlBatch = @(
        "IF DB_ID(N'$DbName') IS NULL CREATE DATABASE [$DbName];",
        "GO",
        "IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$AppLogin')",
        "  CREATE LOGIN [$AppLogin] WITH PASSWORD = N'$($appPwd.Replace("'","''"))', CHECK_POLICY = ON;",
        "GO",
        "USE [$DbName];",
        "IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$AppLogin')",
        "  CREATE USER [$AppLogin] FOR LOGIN [$AppLogin];",
        "ALTER ROLE db_owner ADD MEMBER [$AppLogin];",
        "GO"
    ) -join "`r`n"

    Write-Log 'Creating database and login...'
    try {
        # Try dynamic password if we managed to reset SA in previous turns, 
        # but most likely we need Integrated Security since it's an existing instance.
        Invoke-SqlCmdBatch -sqlcmdExe $sqlcmd -server $serverConn -user '-E' -pass '' -sql $sqlBatch
    }
    catch {
        Write-Log "Integrated security failed: $($_.Exception.Message). Ensure current user is sysadmin."
        throw "Provisioning failed."
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
    }
    Set-Content -Path $CredPath -Value ($cred | ConvertTo-Json) -Encoding ASCII
    Write-Log "Saved: $CredPath"

    Write-Log 'Done.'
    exit 0
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}

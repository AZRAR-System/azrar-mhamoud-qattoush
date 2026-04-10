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

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
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
        $hit = Get-ChildItem -Path $r -Recurse -Filter 'SQLCMD.EXE' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if ($hit) { return $hit }
    }
    return $null
}

function Invoke-SqlCmdBatch([string]$sqlcmdExe, [string]$server, [string]$user, [string]$pass, [string]$sql) {
    $tmp = [System.IO.Path]::GetTempFileName() + '.sql'
    try {
        Set-Content -Path $tmp -Value $sql -Encoding UTF8
        $arg = if ($user -eq '-E') { @('-S', $server, '-E', '-b', '-i', $tmp) } else { @('-S', $server, '-U', $user, '-P', $pass, '-b', '-i', $tmp) }
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
        $dl = Start-Process -FilePath $bootstrapper -ArgumentList @('-ACTION=Download', "-MEDIAPATH=$mediaPath", '-MEDIATYPE=Core', '-QUIET') -Wait -PassThru -NoNewWindow

        if ($dl.ExitCode -ne 0 -and $dl.ExitCode -ne 3010) {
            Write-Log "Download with MEDIATYPE=Core failed ($($dl.ExitCode)); retrying without MEDIATYPE..."
            $dl = Start-Process -FilePath $bootstrapper -ArgumentList @('-ACTION=Download', "-MEDIAPATH=$mediaPath", '-QUIET') -Wait -PassThru -NoNewWindow
        }

        if ($dl.ExitCode -ne 0 -and $dl.ExitCode -ne 3010) { throw "SQL media download failed (exit $($dl.ExitCode))." }

        $setupExe = Get-ChildItem -Path $mediaPath -Filter 'setup.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

        if (-not $setupExe) {
            Write-Log 'setup.exe not found directly. Checking for compressed media EXE...'
            $compressedExe = Get-ChildItem -Path $mediaPath -Filter '*.exe' | Select-Object -First 1
            if ($compressedExe) {
                Write-Log "Found compressed media: $($compressedExe.Name). Extracting to subfolder..."
                $extractPath = Join-Path $mediaPath 'extracted'
                # Ensure extractPath exists
                $null = New-Item -ItemType Directory -Path $extractPath -Force -ErrorAction SilentlyContinue
                
                # Run the self-extracting EXE
                # /Q for quiet, /X: for extract path (colon is required for some extractors)
                $proc = Start-Process -FilePath $compressedExe.FullName -ArgumentList @('/Q', "/X:$extractPath") -Wait -PassThru -NoNewWindow
                if ($proc.ExitCode -ne 0) { throw "Extraction of $($compressedExe.Name) failed (exit $($proc.ExitCode))." }
                
                # Search again in the extracted folder
                $setupExe = Get-ChildItem -Path $extractPath -Filter 'setup.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
            }
        }

        if (-not $setupExe) { throw "setup.exe not found under $mediaPath even after extraction attempt." }

        $iniPath = Join-Path $env:TEMP 'azrar-sql-configuration.ini'
        $saEsc = $saPwd -replace '"', '""'
        $iniLines = @(
            '; SQL Server - generated by AZRAR installer',
            '[OPTIONS]',
            'ACTION="Install"',
            'FEATURES="SQLEngine"',
            'INSTANCENAME="' + $InstanceName + '"',
            'SECURITYMODE="SQL"',
            'SAPWD="' + $saEsc + '"',
            'TCPENABLED="1"',
            'NPENABLED="1"',
            'SQLSYSAdminAccounts="BUILTIN\Administrators"',
            'IACCEPTSQLSERVERLICENSETERMS="True"',
            'QUIET="True"',
            'MEDIALAYOUT="Core"',
            'UPDATEENABLED="False"',
            'USESQLRECOMMENDEDMEMORYLIMITS="True"'
        )
        Set-Content -Path $iniPath -Value ($iniLines -join "`r`n") -Encoding Unicode

        Write-Log "Running setup: $setupExe -ConfigurationFile=..."
        # Use Hyphen prefix (-) instead of Slash (/) to avoid PowerShell argument mangling (// error)
        # MEDIALAYOUT is now specified inside the INI file for maximum reliability
        $ins = Start-Process -FilePath $setupExe -ArgumentList "-ConfigurationFile=`"$iniPath`"" -Wait -PassThru -NoNewWindow
        
        if ($ins.ExitCode -ne 0 -and $ins.ExitCode -ne 3010) { throw "SQL Server setup failed (exit $($ins.ExitCode))." }
    }
    else {
        Write-Log "Instance $InstanceName already present."
    }

    Wait-SqlService -name $InstanceName

    $regRoot = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
    $instId = (Get-ItemProperty -Path $regRoot -Name $InstanceName -ErrorAction SilentlyContinue).$InstanceName
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
        New-NetFirewallRule -DisplayName "AZRAR SQL Server (TCP 1433)" -Direction Inbound -Protocol TCP -LocalPort $TcpPort -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
        netsh advfirewall firewall add rule name="AZRAR SQL Server (TCP 1433)" dir=in action=allow protocol=TCP localport=$TcpPort description="SQL Server for AZRAR Real Estate System" profile=any
        Write-Log "Firewall rule configured for SQL port $TcpPort (TCP)."
    }
    catch {
        Write-Log "Firewall SQL Warning: $($_.Exception.Message)."
    }

    try {
        netsh advfirewall firewall add rule name="AZRAR License Server" dir=in action=allow protocol=TCP localport=5056 description="AZRAR Real Estate License Server"
        Write-Log 'Firewall rule added for License Server port 5056.'
    }
    catch {
        Write-Log "Firewall License Server: $($_.Exception.Message)"
    }

    $sqlcmd = Find-SqlCmd
    if (-not $sqlcmd) { throw 'sqlcmd.exe not found.' }

    $serverConn = "127.0.0.1,$TcpPort"
    $serverNamed = "localhost\$InstanceName"
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
        Invoke-SqlCmdBatch -sqlcmdExe $sqlcmd -server $serverConn -user 'sa' -pass $saPwd -sql $sqlBatch
    }
    catch {
        Write-Log "SA connection failed ($($_.Exception.Message)); trying integrated security..."
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
    $json = $cred | ConvertTo-Json -Depth 6
    Set-Content -Path $CredPath -Value $json -Encoding UTF8
    Write-Log "Saved: $CredPath"

    $txtPath = Join-Path $ProgramDataAzrar 'database-info.txt'
    $txtLines = @(
        "=== AZRAR DATABASE INFO ===",
        "",
        "Server: $env:COMPUTERNAME\$InstanceName",
        "Connection: 127.0.0.1,$TcpPort",
        "Database: $DbName",
        "User: $AppLogin",
        "Password: $appPwd",
        "Port: $TcpPort",
        "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
        "",
        "Note: You can use this info to connect via SSMS."
    )
    Set-Content -Path $txtPath -Value ($txtLines -join "`r`n") -Encoding UTF8
    Write-Log "Saved reference file: $txtPath"

    Write-Log 'Done.'
    exit 0
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    $errStr = $_ | Out-String
    Add-Content -Path $script:LogFile -Value $errStr -Encoding UTF8
    exit 1
}

; build/installer.nsh — optional SQL Server Express (see build/sql-express-install.ps1)
!include "LogicLib.nsh"

!macro customInstall
  ${IfNot} ${Silent}
    ; English prompt (NSIS: use $PROGRAMDATA, not %ProgramData%)
    MessageBox MB_YESNO|MB_ICONQUESTION "Install Microsoft SQL Server 2022 Express for AZRAR?$\r$\n$\r$\n- Requires Internet (large download)$\r$\n- Instance AZRARSQL, TCP 1433, database AZRAR$\r$\n- After success: ProgramData\AZRAR\sql-local-credentials.json$\r$\n$\r$\nContinue?" IDYES azrarRunSql IDNO azrarSkipSql
    azrarRunSql:
      ; Script is shipped next to AZRAR.exe via extraFiles
      ExecWait '"powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\sql-express-install.ps1"' $0
      IntCmp $0 0 azrarSqlOk azrarSqlErr azrarSqlErr
      azrarSqlErr:
        MessageBox MB_OK|MB_ICONEXCLAMATION "SQL Server optional setup exited with code $0.$\r$\nSee ProgramData\AZRAR\sql-express-install.log"
      azrarSqlOk:
    azrarSkipSql:
  ${EndIf}
!macroend

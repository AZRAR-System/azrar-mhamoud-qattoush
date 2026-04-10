; build/installer.nsh — optional SQL Server Express (see build/sql-express-install.ps1)
!include "LogicLib.nsh"

!macro customInstall
  ${IfNot} ${Silent}
    ; English prompt (NSIS: use $PROGRAMDATA, not %ProgramData%)
    MessageBox MB_YESNO|MB_ICONQUESTION "هل ترغب في تثبيت Microsoft SQL Server 2022 Express لنظام أزرار؟$\r$\n$\r$\n- يتطلب اتصالاً بالإنترنت (حجم كبير)$\r$\n- سيتم إعداد قاعدة البيانات لتمويل المزامنة الشبكية$\r$\n- سيتم حفظ بيانات الاتصال في ProgramData\AZRAR$\r$\n$\r$\nاستمرار؟" IDYES azrarRunSql IDNO azrarSkipSql
    azrarRunSql:
      ; Script is shipped next to AZRAR.exe via extraFiles
      ExecWait '"powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\sql-express-install.ps1"' $0
      IntCmp $0 0 azrarSqlOk azrarSqlErr azrarSqlErr
      azrarSqlErr:
        MessageBox MB_OK|MB_ICONEXCLAMATION "حدث خطأ أثناء إعداد SQL Server (رمز الخطأ: $0).$\r$\nيمكنك مراجعة السجل في ProgramData\AZRAR\sql-express-install.log"
      azrarSqlOk:
    azrarSkipSql:
  ${EndIf}
!macroend

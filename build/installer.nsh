; build/installer.nsh — تهيئة برمجيات الإعداد الملحقة (Microsoft SQL Server)
!include "LogicLib.nsh"

!macro customInstall
  ; يتم تنفيذ إعداد محرك قواعد البيانات الآن من داخل التطبيق عبر "دليل الإعداد الذكي"
  ; لضمان تجربة مستخدم أفضل وتجنب أخطاء التثبيت الصامتة.
!macroend

# Code Signing — Internal Trust (Windows)

هذا الدليل يشرح كيف تجعل مُثبّت AZRAR الموقّع بشهادة **dev/self-signed** يظهر كـ **Trusted publisher** داخل الشركة.

> مهم: هذا مخصص للاستخدام الداخلي. للإصدارات العامة خارج الشركة يُفضّل شهادة Code Signing رسمية (OV/EV) بسلسلة موثوقة عالميًا.

## متى تحتاج هذا؟
- عند توقيع المُثبّت بشهادة self-signed (AZRAR_SIGNING_PROFILE=dev).
- ستلاحظ أن الملف “Signed” لكن قد يظهر للمستخدمين `Unknown publisher` ما لم تكن الشهادة موثوقة على أجهزتهم.

## 1) استخراج ملف الشهادة (.cer)
السكربت سيقوم تلقائيًا بتصدير الشهادة العامة (بدون private key) إلى:
- `release2_build/certs/`

## 2) تثبيت الثقة لجهاز واحد (سريع)
### للمستخدم الحالي (غالبًا بدون Admin)
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-codesign-trust.ps1 -CertThumbprint "<THUMBPRINT>" -Scope CurrentUser`

### لكل الجهاز (يتطلب Admin)
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-codesign-trust.ps1 -CertThumbprint "<THUMBPRINT>" -Scope LocalMachine`

هذا يثبت الشهادة في:
- Trusted Root Certification Authorities
- Trusted Publishers

## 3) نشر الثقة على كل أجهزة الشركة (موصى به) عبر GPO
فكرة النشر: ضع ملف `.cer` في مشاركة شبكة (Share) ثم أنشئ GPO يضيفه إلى مخازن الشهادات.

### الخيار A: GPO (Computer Configuration) — LocalMachine
- ضع ملف الشهادة مثلًا في: `\\server\share\azrar\codesign_dev.cer`
- افتح Group Policy Management
- أنشئ/عدّل GPO واذهب إلى:
  - `Computer Configuration` → `Policies` → `Windows Settings` → `Security Settings` → `Public Key Policies`
- أضف الشهادة إلى:
  - `Trusted Root Certification Authorities`
  - `Trusted Publishers`

### الخيار B: GPO Startup Script (بديل بسيط)
أضف Startup Script (PowerShell) يقوم ب:
- `certutil -addstore -f Root "\\server\share\azrar\codesign_dev.cer"`
- `certutil -addstore -f TrustedPublisher "\\server\share\azrar\codesign_dev.cer"`

## 4) التحقق
على جهاز العميل:
- افتح خصائص ملف المُثبّت → تبويب `Digital Signatures`
- يجب أن يظهر `Valid` وPublisher معروف.

## ملاحظة عن اختيار الشهادة
لإظهار الشهادات المتاحة (Code Signing + private key):
- `Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My | Where-Object { $_.HasPrivateKey -and $_.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3' } | Select-Object Subject,Thumbprint,NotAfter`

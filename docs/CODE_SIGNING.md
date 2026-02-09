# 🔐 دليل التوقيع الرقمي لتطبيق AZRAR

## نظرة عامة
التوقيع الرقمي ضروري لـ:
- تجنب تحذيرات Windows SmartScreen
- بناء الثقة مع المستخدمين
- التحقق من أصالة التطبيق
- السماح بالتحديثات التلقائية الآمنة

---

## 🎯 المتطلبات

### 1. الحصول على شهادة توقيع الكود (Code Signing Certificate)

#### الخيار أ: شهادة EV (موصى به للإنتاج)
- **المزودون:**
  - DigiCert: https://www.digicert.com/code-signing
  - Sectigo: https://sectigo.com/ssl-certificates-tls/code-signing
  - GlobalSign: https://www.globalsign.com/en/code-signing-certificate
  
- **التكلفة:** $200-$500 سنوياً
- **المزايا:** 
  - لا تحذيرات SmartScreen فوراً
  - مستوى ثقة عالي
  - مطلوبة للتطبيقات الكبيرة

#### الخيار ب: شهادة OV (للمشاريع الصغيرة)
- **التكلفة:** $100-$300 سنوياً
- **العيوب:** تحتاج وقت لبناء السمعة مع SmartScreen

#### الخيار ج: شهادة Self-Signed (للتطوير فقط)
- **مجانية** ولكن غير موثوقة للإنتاج
- مفيدة للاختبارات الداخلية فقط

---

## 🛠️ خطوات التكوين

## 🧭 فصل واضح بين Self-signed و Trusted-signed

نستخدم نفس أمر البناء للتوقيع:

- `npm run desktop:dist:signed`

والفصل بين **التوقيع الداخلي (Self-signed)** و **التوقيع الرسمي (OV/EV من CA)** يتم عبر متغير بيئة واحد:

- `AZRAR_SIGNING_PROFILE=dev`
  - للتطوير الداخلي/التجارب.
  - مناسب لشهادة self-signed.
- `AZRAR_SIGNING_PROFILE=prod`
  - للنسخة الرسمية للبيع للعملاء (شهادة OV/EV من CA).
  - يفعّل تلقائيًا `verifyUpdateCodeSignature` في إعدادات البناء.

> في كلا المسارين، التوقيع يعتمد على `CSC_LINK/CSC_KEY_PASSWORD` (ملف PFX) أو `CSC_NAME` (شهادة من Windows Certificate Store).

### الخطوة 1: حفظ الشهادة

```powershell
# إنشاء مجلد آمن للشهادات (خارج Git)
New-Item -ItemType Directory -Path "C:\Certificates\AZRAR" -Force

# نقل ملف الشهادة
Move-Item "path\to\your-certificate.pfx" "C:\Certificates\AZRAR\azrar-cert.pfx"

# تأمين المجلد (اختياري)
$acl = Get-Acl "C:\Certificates\AZRAR"
$acl.SetAccessRuleProtection($true, $false)
Set-Acl "C:\Certificates\AZRAR" $acl
```

### الخطوة 2: تكوين متغيرات البيئة

#### أ. للاستخدام المحلي (Development)

```powershell
# في PowerShell (جلسة واحدة)
$env:CSC_LINK = "C:\Certificates\AZRAR\azrar-cert.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"

# أو بشكل دائم (User Environment Variables)
[System.Environment]::SetEnvironmentVariable('CSC_LINK', 'C:\Certificates\AZRAR\azrar-cert.pfx', 'User')
[System.Environment]::SetEnvironmentVariable('CSC_KEY_PASSWORD', 'your-password', 'User')
```

#### ب. للاستخدام في CI/CD (GitHub Actions)

```yaml
# في GitHub Repository Settings > Secrets and variables > Actions
# أضف:
# CSC_LINK: [محتوى ملف .pfx مشفر base64]
# CSC_KEY_PASSWORD: [كلمة مرور الشهادة]
```

### الخطوة 3: تحديث electron-builder.config.js

```javascript
// إلغاء التعليق على هذه الأسطر في electron-builder.config.js
win: {
  signAndEditExecutable: true,
  signingHashAlgorithms: ['sha256'],
  rfc3161TimeStampServer: 'http://timestamp.digicert.com',
  certificateFile: process.env.CSC_LINK,
  certificatePassword: process.env.CSC_KEY_PASSWORD,
  verifyUpdateCodeSignature: true
}
```

---

## 🚀 البناء مع التوقيع

### بناء محلي:

```powershell
# تأكد من وجود متغيرات البيئة
Write-Host "CSC_LINK: $env:CSC_LINK"
Write-Host "CSC_KEY_PASSWORD: $(if($env:CSC_KEY_PASSWORD){'Set'}else{'Not Set'})"

# اختر بروفايل التوقيع
$env:AZRAR_SIGNING_PROFILE = "dev"  # self-signed (internal)
# أو للنسخة الرسمية:
# $env:AZRAR_SIGNING_PROFILE = "prod" # OV/EV CA (official)

# بناء التطبيق
npm run desktop:dist:signed
```

### بناء عبر CI/CD:

```yaml
# في .github/workflows/build.yml
- name: Build with signing
  run: npm run desktop:dist:signed
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

---

## ✅ التحقق من التوقيع

### في Windows:

```powershell
# التحقق من التوقيع
Get-AuthenticodeSignature "C:\path\to\AZRAR Setup.exe" | Format-List

# يجب أن يظهر:
# Status: Valid
# SignerCertificate: CN=Your Company Name
```

### عبر واجهة Windows:

1. انقر بزر الماوس الأيمن على الملف التنفيذي
2. اختر "Properties" (الخصائص)
3. اذهب إلى تبويب "Digital Signatures" (التوقيعات الرقمية)
4. يجب أن ترى التوقيع صالحاً

---

## 🔧 استكشاف الأخطاء

### خطأ: "Private key is not found"

```powershell
# تأكد من صحة المسار والملف
Test-Path $env:CSC_LINK
# يجب أن يعيد: True

# تأكد من أن الملف .pfx صالح
certutil -dump $env:CSC_LINK
```

### خطأ: "Invalid password"

```powershell
# جرب تصدير الشهادة بكلمة مرور جديدة
# في Certificate Manager (certmgr.msc):
# 1. افتح شهادتك
# 2. اختر Export
# 3. حدد "Yes, export the private key"
# 4. اختر كلمة مرور جديدة
```

### خطأ: "TimeStamp server unavailable"

```javascript
// جرب خوادم timestamp بديلة:
rfc3161TimeStampServer: 'http://timestamp.comodoca.com/rfc3161'
// أو
rfc3161TimeStampServer: 'http://timestamp.sectigo.com'
```

---

## 📦 إنشاء شهادة Self-Signed للتطوير

يمكنك استخدام سكربت جاهز داخل المشروع لإنشاء شهادة Code Signing للتجارب الداخلية وتصديرها كملف `.pfx`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-dev-code-sign-cert.ps1 -TrustCurrentUser
```

إذا كنت تريد تشغيله بدون إدخال تفاعلي لكلمة مرور الـ PFX (مثلاً لأتمتة محلية أو CI)، لديك خياران:

```powershell
# خيار 1: تمرير كلمة المرور مباشرة (Dev فقط)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-dev-code-sign-cert.ps1 -TrustCurrentUser -PfxPassword "YourDevPassword"

# خيار 2: عبر متغير بيئة (أكثر نظافة)
$env:AZRAR_DEV_PFX_PASSWORD = "YourDevPassword"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-dev-code-sign-cert.ps1 -TrustCurrentUser
```

سيقوم السكربت بإخراج مسار ملف الـ PFX وملف الـ CER، ثم يمكنك توقيع المُثبّت عبر `scripts/code-sign-installer.ps1` أو عبر `npm run desktop:dist:signed`.

---

بديل يدوي (بدون السكربت):

```powershell
# إنشاء شهادة للتطوير فقط
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=AZRAR Development, O=AZRAR, C=US" `
  -KeyUsage DigitalSignature `
  -FriendlyName "AZRAR Development Certificate" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

# تصدير إلى ملف PFX
$pwd = ConvertTo-SecureString -String "DevPassword123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "azrar-dev-cert.pfx" -Password $pwd

# ملاحظة: هذه الشهادة غير موثوقة وستظهر تحذيرات أمنية
```

---

## 🔒 أفضل الممارسات

### 1. أمان الشهادة
- ❌ **لا تحفظ الشهادة في Git**
- ✅ استخدم مدير أسرار آمن (Azure Key Vault, AWS Secrets Manager)
- ✅ قم بتدوير كلمات المرور بانتظام
- ✅ احتفظ بنسخة احتياطية مشفرة

### 2. CI/CD
- ✅ استخدم GitHub Secrets لتخزين بيانات الشهادة
- ✅ قيّد الوصول إلى workflows
- ✅ مراجعة سجلات البناء بانتظام

### 3. التجديد
- ⚠️ راقب تاريخ انتهاء الشهادة
- ✅ جدد قبل 30 يوم على الأقل من الانتهاء
- ✅ اختبر الشهادة الجديدة في بيئة التطوير أولاً

---

## 📝 ملاحظات مهمة

### Windows SmartScreen
- حتى مع التوقيع، قد تحتاج التطبيقات الجديدة وقتاً لبناء "السمعة"
- شهادات EV تتجاوز هذه المشكلة
- كلما زاد عدد المستخدمين الذين يثبتون التطبيق، قلت التحذيرات

### التكلفة
- استثمار سنوي ضروري للشهادة
- أسعار المؤسسات (EV) أعلى لكن توفر ثقة فورية
- يمكن البدء بشهادة OV وترقيتها لاحقاً

### البدائل
- إذا كانت التكلفة عائقاً، فكّر في:
  - استخدام Microsoft Store (يوقع تلقائياً)
  - نشر عبر منصات موثوقة
  - استهداف مستخدمين تقنيين يفهمون التحذيرات

---

## 🔗 مصادر إضافية

- [Electron Builder - Code Signing](https://www.electron.build/code-signing)
- [Microsoft Docs - Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [DigiCert Knowledge Base](https://knowledge.digicert.com/solution/SO5437.html)

---

## 📞 الدعم

للحصول على المساعدة:
1. راجع [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. افتح issue في GitHub
3. راجع وثائق مزود الشهادة

---

**تاريخ آخر تحديث:** يناير 2026  
**الإصدار:** 1.0

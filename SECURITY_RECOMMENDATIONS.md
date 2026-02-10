# 🔐 توصيات الأمان - AZRAR Desktop

<div dir="rtl">

## 📋 ملخص التحديثات الأمنية (فبراير 2026)

تم تطبيق التحسينات الأمنية التالية على النظام:

---

## ✅ الإصلاحات المطبقة

### 1. إزالة كلمة المرور الافتراضية المضمنة (حرجة)
**الملف:** `electron/ipc.ts`

**المشكلة السابقة:**
- كانت هناك كلمة مرور افتراضية مضمنة في الكود (`7Bibi@_@_0788`)
- هذا يشكل خطراً أمنياً كبيراً لأن أي شخص لديه الوصول للكود يمكنه الوصول للنظام

**الحل:**
- تم استبدال كلمة المرور الافتراضية بمولد كلمات مرور عشوائية آمنة
- يُنشئ النظام الآن كلمة مرور عشوائية من 24 بايت مشفرة بـ Base64
- **هام:** يجب تعيين بيانات الاعتماد عبر متغيرات البيئة:
  ```bash
  AZRAR_LICENSE_ADMIN_UI_USERNAME=your_username
  AZRAR_LICENSE_ADMIN_UI_PASSWORD=your_secure_password
  ```

---

### 2. إضافة Rate Limiting للخوادم (عالية)
**الملفات:** 
- `server/license-server.mjs`
- `server/marquee-server.js`

**المشكلة السابقة:**
- لم تكن هناك حماية من هجمات Brute Force
- لم تكن هناك حماية من هجمات DDoS

**الحل:**
- تم إضافة نظام Rate Limiting متكامل
- الحدود الافتراضية:
  - License Server: 60 طلب/دقيقة للعمليات العادية، 30 طلب/دقيقة للعمليات الإدارية
  - Marquee Server: 100 طلب/دقيقة للقراءة، 20 طلب/دقيقة للكتابة
- يتم إرجاع HTTP 429 عند تجاوز الحد مع `Retry-After` header

---

### 3. تحسين سياسة CORS (متوسطة)
**الملفات:**
- `server/license-server.mjs`
- `server/marquee-server.js`

**المشكلة السابقة:**
- كانت `Access-Control-Allow-Origin` معينة على `*` دائماً
- هذا يسمح لأي موقع بالوصول للـ API

**الحل:**
- تم إضافة دعم لتخصيص CORS عبر متغيرات البيئة:
  ```bash
  # License Server
  AZRAR_LICENSE_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
  
  # Marquee Server
  MARQUEE_CORS_ORIGIN=https://yourdomain.com
  ```
- الافتراضي لا يزال `*` للتوافق مع الأنظمة الحالية

---

### 4. توسيع قائمة الملفات الخطرة (منخفضة)
**الملف:** `electron/ipc.ts`

**المشكلة السابقة:**
- قائمة امتدادات الملفات الخطرة كانت غير شاملة

**الحل:**
تم إضافة الامتدادات التالية للحماية:
- `.pif`, `.gadget` (Windows executables)
- `.psd1` (PowerShell data files)
- `.vbe`, `.ws`, `.wsf`, `.wsc`, `.wsh` (Windows script hosts)
- `.class` (Java compiled)
- `.htm`, `.html`, `.mht`, `.mhtml` (يمكن أن تحتوي على سكربتات خبيثة)
- `.inf`, `.ins`, `.isp` (Windows installation files)
- `.scf`, `.desktop` (Shortcuts)
- `.docm`, `.xlsm`, `.pptm`, `.dotm`, `.xltm`, `.potm`, `.ppam`, `.xlam` (Office macros)
- `.application`, `.chm`, `.hlp`, `.lib`, `.dll`, `.sys`, `.drv`, `.ocx` (System files)

---

## 🔒 توصيات إضافية للإنتاج

### 1. تأمين قاعدة البيانات
```bash
# تفعيل تشفير SQLCipher
AZRAR_DB_ENCRYPTION=sqlcipher
```

### 2. تعيين بيانات الاعتماد بشكل صحيح
```bash
# Admin UI credentials
AZRAR_LICENSE_ADMIN_UI_USERNAME=your_secure_username
AZRAR_LICENSE_ADMIN_UI_PASSWORD=a_very_long_and_complex_password_here

# License Server Admin Token (للـ API)
AZRAR_LICENSE_ADMIN_TOKEN=your_secure_api_token_here
```

### 3. تفعيل HTTPS في الإنتاج
- استخدم reverse proxy مثل Nginx أو Caddy لإنهاء SSL
- لا تشغل الخوادم مباشرة على الإنترنت

### 4. تقييد الوصول الشبكي
```bash
# تقييد الاستماع على localhost فقط (أكثر أماناً)
AZRAR_LICENSE_HOST=127.0.0.1
MARQUEE_HOST=127.0.0.1
```

### 5. مراقبة السجلات
- راقب سجلات الطلبات المرفوضة بسبب Rate Limiting
- راقب محاولات تسجيل الدخول الفاشلة

---

## 📊 جدول ملخص الأمان

| المكون | الحالة | الخطورة السابقة | ملاحظات |
|--------|--------|-----------------|---------|
| كلمة المرور الافتراضية | ✅ تم الإصلاح | حرجة | تستخدم الآن كلمات مرور عشوائية |
| Rate Limiting | ✅ تم الإضافة | عالية | حماية من Brute Force |
| CORS Policy | ✅ تم التحسين | متوسطة | قابلة للتخصيص |
| امتدادات الملفات الخطرة | ✅ تم التوسيع | منخفضة | قائمة شاملة الآن |
| SQL Injection | ✅ آمن | - | استخدام Prepared Statements |
| XSS | ✅ آمن | - | استخدام DOMPurify |
| Path Traversal | ✅ آمن | - | استخدام ensureInsideRoot |
| CSP | ✅ آمن | - | سياسة صارمة في الإنتاج |

---

## 📞 الإبلاغ عن ثغرات أمنية

إذا اكتشفت ثغرة أمنية، يرجى:
1. **لا تبلّغ علناً**
2. استخدم GitHub Security Advisory
3. أو تواصل مع فريق الأمان مباشرة

---

**آخر تحديث:** فبراير 2026  
**الإصدار:** 3.2.x

</div>

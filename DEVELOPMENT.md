# 👨‍💻 دليل المطورين - AZRAR Desktop

<div dir="rtl">

مرحباً بك في فريق تطوير AZRAR! هذا الدليل يحتوي على كل ما تحتاجه للبدء في التطوير.

> للخطوات العملية اليومية (تشغيل/تشخيص/إصلاح Native/تنظيف آمن) استخدم المرجع الموحد:
> - [docs/DEV_RUNBOOK.md](./docs/DEV_RUNBOOK.md)

---

## 📋 جدول المحتويات

1. [إعداد البيئة](#إعداد-البيئة)
2. [بنية المشروع](#بنية-المشروع)
3. [سير العمل](#سير-العمل)
4. [معايير الكود](#معايير-الكود)
5. [الاختبارات](#الاختبارات)
6. [البناء والنشر](#البناء-والنشر)
7. [استكشاف الأخطاء](#استكشاف-الأخطاء)
8. [الموارد](#الموارد)

---

## 🚀 إعداد البيئة

### المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:

| الأداة | الإصدار المطلوب | رابط التحميل |
|--------|------------------|---------------|
| Node.js | يُفضّل 22.x (LTS) (و 24.x مقبول) | [nodejs.org](https://nodejs.org/) |
| npm | ≥ 9.0.0 | يأتي مع Node.js |
| Git | Latest | [git-scm.com](https://git-scm.com/) |
| Visual Studio Code | Latest | [code.visualstudio.com](https://code.visualstudio.com/) |

### التثبيت الأولي

```bash
# 1. استنساخ المشروع
git clone https://github.com/AZRAR-System/azrar-mhamoud-qattoush.git
cd azrar-mhamoud-qattoush

# 2. تثبيت التبعيات
npm install

# 3. تشغيل في وضع التطوير
npm run desktop:dev
```

> ملاحظة: وضع سطح المكتب يستخدم `vite --mode desktop` ويقرأ إعداداته من `.env.desktop`.

---

## 🧹 تنظيف ملفات التطوير (آمن)

بدلاً من حذف مجلدات مثل `node_modules/` يدويًا، استخدم التنظيف المعتمد على git:

- دليل: [docs/LOCAL_CLEANUP_SAFE.md](./docs/LOCAL_CLEANUP_SAFE.md)
- سكربت: `scripts/clean-local.ps1`

### إعدادات Visual Studio Code

#### الإضافات الموصى بها:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "GitHub.copilot",
    "eamodio.gitlens"
  ]
}
```

#### إعدادات المشروع (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## 🏗️ بنية المشروع

### نظرة عامة

```
azrar-desktop/
├── 📂 src/                      # كود React (Renderer Process)
│   ├── components/             # مكونات قابلة لإعادة الاستخدام
│   │   ├── ui/                # مكونات UI أساسية
│   │   ├── forms/             # نماذج ومدخلات
│   │   └── layout/            # مكونات التخطيط
│   ├── pages/                 # صفحات التطبيق
│   ├── hooks/                 # React Hooks مخصصة
│   ├── utils/                 # دوال مساعدة
│   ├── contexts/              # React Contexts
│   ├── services/              # خدمات API
│   └── styles/                # ملفات CSS

├── 📂 electron/                # كود Electron (Main Process)
│   ├── main.ts               # نقطة الدخول الرئيسية
│   ├── preload.ts            # Preload script
│   ├── ipc/                  # معالجات IPC
│   │   ├── database.ts      # عمليات قاعدة البيانات
│   │   ├── files.ts         # معالجة الملفات
│   │   └── system.ts        # عمليات النظام
│   ├── logger.ts             # نظام السجلات
│   └── updater.ts            # نظام التحديثات

├── 📂 build/                   # ملفات البناء
│   ├── icon.png              # أيقونة التطبيق
│   ├── icon.ico              # أيقونة Windows
│   └── installer.nsh         # سكريبت NSIS

├── 📂 scripts/                 # سكريبتات الأتمتة
│   ├── desktop-dist.ps1      # سكريبت البناء
│   ├── bump-desktop-version.mjs
│   └── watch-desktop-dist.mjs

├── 📂 tests/                   # الاختبارات
│   ├── unit/                 # اختبارات الوحدات
│   ├── integration/          # اختبارات التكامل
│   └── e2e/                  # اختبارات End-to-End

├── 📂 docs/                    # التوثيق
│   ├── API.md               # توثيق API
│   ├── ARCHITECTURE.md      # معمارية التطبيق
│   └── CODE_SIGNING.md      # التوقيع الرقمي

└── 📂 release2_build/          # مخرجات البناء
```

### التفاصيل الهامة

#### 1. **Renderer Process (src/)**

المسؤول عن واجهة المستخدم:

```typescript
// src/components/Button.tsx
import React from 'react';

export const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      {children}
    </button>
  );
};
```

#### 2. **Main Process (electron/)**

المسؤول عن العمليات الخلفية:

```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import logger from './logger';

app.whenReady().then(() => {
  logger.logAppStart();
  createMainWindow();
});
```

#### 3. **IPC Communication**

الاتصال بين العمليات:

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
});

// src/services/database.ts
const result = await window.electron.invoke('database:query', sql);
```

---

## 🔄 سير العمل

### Git Workflow

نستخدم **Git Flow**:

```bash
main          # الإنتاج (Production)
  ↓
develop       # التطوير (Development)
  ↓
feature/*     # المميزات الجديدة
hotfix/*      # إصلاحات عاجلة
release/*     # الإصدارات
```

### إنشاء Feature جديدة

```bash
# 1. تحديث develop
git checkout develop
git pull origin develop

# 2. إنشاء branch جديد
git checkout -b feature/add-payment-system

# 3. العمل على التغييرات
# ... code ...

# 4. Commit التغييرات
git add .
git commit -m "feat: add payment system integration"

# 5. Push
git push origin feature/add-payment-system

# 6. فتح Pull Request على GitHub
```

### Commit Messages

نستخدم **Conventional Commits**:

```bash
feat: إضافة مميزة جديدة
fix: إصلاح خطأ
docs: تحديث التوثيق
style: تنسيق الكود
refactor: إعادة هيكلة
test: إضافة اختبارات
chore: مهام صيانة
```

أمثلة:

```bash
feat(ui): add dark mode toggle
fix(database): resolve memory leak in queries
docs(api): update authentication endpoints
test(auth): add login form validation tests
```

---

## 📏 معايير الكود

### TypeScript/JavaScript

```typescript
// ✅ جيد
interface User {
  id: number;
  name: string;
  email: string;
}

const createUser = async (data: User): Promise<User> => {
  // Implementation
  return user;
};

// ❌ سيء
function createUser(data) {
  // No types, no async/await
  return user;
}
```

### React Components

```tsx
// ✅ جيد - Functional Component مع TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button 
      onClick={onClick}
      className={`btn btn-${variant}`}
    >
      {label}
    </button>
  );
};

// ❌ سيء - بدون types
export const Button = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### Naming Conventions

| النوع | النمط | مثال |
|-------|-------|-------|
| Components | PascalCase | `UserProfile`, `DataTable` |
| Functions | camelCase | `fetchUserData`, `calculateTotal` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Files | kebab-case | `user-profile.tsx`, `data-table.tsx` |
| Interfaces | PascalCase + I | `IUser`, `IApiResponse` |
| Types | PascalCase | `UserRole`, `ApiError` |

### ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
```

---

## 🧪 الاختبارات

### تشغيل الاختبارات

```bash
# جميع الاختبارات
npm test

# اختبار ملف محدد
npm test -- UserProfile.test.tsx

# مع التغطية
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### كتابة الاختبارات

#### Unit Test مثال:

```typescript
// src/utils/formatCurrency.test.ts
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  test('should format number to SAR currency', () => {
    expect(formatCurrency(1000)).toBe('1,000 ر.س');
  });

  test('should handle zero', () => {
    expect(formatCurrency(0)).toBe('0 ر.س');
  });

  test('should handle decimals', () => {
    expect(formatCurrency(1000.50)).toBe('1,000.50 ر.س');
  });
});
```

#### Component Test مثال:

```typescript
// src/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  test('should render with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  test('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button label="Click" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔨 البناء والنشر

### البناء المحلي

```bash
# بناء كامل
npm run desktop:dist

# بناء سريع (بدون win-unpacked)
npm run desktop:dist:skipWU

# بناء مع التوقيع
npm run desktop:dist:signed
```

### البناء عبر CI/CD

يتم البناء تلقائياً عند:
- Push إلى `main` أو `develop`
- إنشاء Tag بصيغة `v*.*.*`
- فتح Pull Request

راجع `.github/workflows/build.yml` للتفاصيل.

### إنشاء Release

```bash
# 1. تحديث رقم الإصدار
npm run desktop:version:bump

# 2. Commit التغييرات
git add package.json
git commit -m "chore: bump version to 2.0.110"

# 3. إنشاء Tag
git tag v2.0.110

# 4. Push
git push origin develop
git push origin v2.0.110

# GitHub Actions سيبني وينشر الإصدار تلقائياً
```

---

## 🐛 استكشاف الأخطاء

### مشاكل شائعة

#### 1. خطأ في npm install

```bash
# حذف node_modules وإعادة التثبيت
rm -rf node_modules package-lock.json
npm install
```

#### 2. خطأ في Electron

```bash
# إعادة بناء native modules
npm run electron:rebuild
```

#### 3. مشاكل في TypeScript

```bash
# إعادة بناء types
npm run electron:build
```

### السجلات (Logs)

```bash
# موقع السجلات
%APPDATA%\azrar-desktop\logs\

# عرض السجل الحالي
npm run logs:view
```

### Debugging

#### في VS Code:

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["electron/main.js"],
      "outputCapture": "std"
    }
  ]
}
```

---

## 📚 الموارد

### التوثيق الرسمي

- [Electron Docs](https://www.electronjs.org/docs/latest/)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Vite Docs](https://vitejs.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

### أدوات مفيدة

- **Electron Fiddle:** تجربة كود Electron
- **React DevTools:** فحص مكونات React
- **Redux DevTools:** إذا كنت تستخدم Redux

### المجتمع

- **GitHub Discussions:** [الرابط]
- **Discord Server:** [الرابط]
- **Stack Overflow:** Tag `azrar-desktop`

---

## 🤝 المساهمة

### قبل فتح PR:

- ✅ تأكد من نجاح جميع الاختبارات
- ✅ اتبع معايير الكود
- ✅ أضف/حدّث الاختبارات
- ✅ حدّث التوثيق إن لزم
- ✅ اتبع نمط Commit Messages

### مراجعة الكود

كل PR يحتاج:
- موافقة من مطور واحد على الأقل
- نجاح جميع الفحوصات التلقائية
- لا تعارضات مع develop

---

## 📞 الحصول على المساعدة

إذا واجهت مشكلة:

1. **ابحث في الوثائق**
2. **تحقق من Issues الموجودة**
3. **اسأل في Discord**
4. **افتح Issue جديدة**

---

## 📝 ملاحظات نهائية

- **الكود النظيف:** اكتب كود يمكن للآخرين فهمه
- **التوثيق:** وثّق القرارات المعقدة
- **الاختبارات:** اختبر كل شيء
- **الأمان:** فكر في الأمان دائماً
- **الأداء:** راقب الأداء

---

**حظاً موفقاً في التطوير! 🚀**

**آخر تحديث:** 6 يناير 2026  
**المحافظ:** فريق تطوير AZRAR

</div>

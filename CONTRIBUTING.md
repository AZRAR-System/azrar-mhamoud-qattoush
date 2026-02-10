# 🤝 دليل المساهمة - AZRAR Desktop

<div dir="rtl">

شكراً لاهتمامك بالمساهمة في AZRAR! نرحب بجميع أنواع المساهمات.

---

## 📋 جدول المحتويات

1. [مدونة السلوك](#مدونة-السلوك)
2. [كيف أساهم؟](#كيف-أساهم)
3. [الإبلاغ عن الأخطاء](#الإبلاغ-عن-الأخطاء)
4. [اقتراح مميزات](#اقتراح-مميزات)
5. [Pull Requests](#pull-requests)
6. [معايير الكود](#معايير-الكود)
7. [عملية المراجعة](#عملية-المراجعة)

---

## 📜 مدونة السلوك

### تعهدنا

نحن كمساهمين ومشرفين نتعهد بجعل المساهمة في مشروعنا تجربة خالية من التحرش للجميع.

### معاييرنا

**سلوكيات مقبولة ✅**
- استخدام لغة ترحيبية وشاملة
- احترام وجهات النظر المختلفة
- قبول النقد البناء بلطف
- التركيز على ما هو أفضل للمجتمع

**سلوكيات غير مقبولة ❌**
- استخدام لغة أو صور جنسية
- التحرش أو التعليقات المسيئة
- الإساءة الشخصية أو السياسية
- نشر معلومات خاصة للآخرين

---

## 🚀 كيف أساهم؟

### للمطورين الجدد

إذا كانت هذه أول مساهمة لك:

1. **Fork المشروع**
   ```bash
   # انقر على زر Fork في GitHub
   ```

2. **استنسخ Fork الخاص بك**
   ```bash
  git clone https://github.com/qatash/azrar-mhamoud-qattoush.git
  cd azrar-mhamoud-qattoush
   ```

3. **أضف upstream**
   ```bash
  git remote add upstream https://github.com/qatash/azrar-mhamoud-qattoush.git
   ```

4. **أنشئ branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### أنواع المساهمات

#### 🐛 إصلاح الأخطاء
- ابحث في Issues الموجودة
- إذا لم تجد، افتح Issue جديدة
- اربط PR بالـ Issue

#### ✨ مميزات جديدة
- ناقش المميزة في Issue أولاً
- انتظر الموافقة قبل البدء
- اتبع معايير الكود

#### 📚 تحسين التوثيق
- إصلاح أخطاء إملائية
- تحسين الشرح
- إضافة أمثلة

#### 🧪 كتابة الاختبارات
- أضف اختبارات للكود الجديد
- حسّن تغطية الاختبارات

---

## 🐛 الإبلاغ عن الأخطاء

### قبل الإبلاغ

- **ابحث أولاً**: تحقق من Issues الموجودة
- **حدّث البرنامج**: جرب أحدث إصدار
- **تأكد من الخطأ**: ليس سوء فهم للمميزة

### كيف أبلّغ؟

افتح Issue جديدة وضمّن:

```markdown
**وصف الخطأ**
وصف واضح ومختصر للمشكلة.

**خطوات إعادة الإنتاج**
1. اذهب إلى '...'
2. انقر على '...'
3. انظر الخطأ

**السلوك المتوقع**
ماذا كنت تتوقع أن يحدث؟

**Screenshots**
إن أمكن، أضف screenshots.

**معلومات النظام**
 - نظام التشغيل: [Windows 10/11]
 - الإصدار: [2.0.109]
 - معلومات إضافية

**سياق إضافي**
أي معلومات أخرى عن المشكلة.
```

---

## 💡 اقتراح مميزات

### قبل الاقتراح

- **ابحث**: تحقق من الاقتراحات الموجودة
- **فكر**: هل المميزة مفيدة للجميع؟
- **خطط**: كيف ستعمل؟

### كيف أقترح؟

افتح Issue مع label `enhancement`:

```markdown
**المشكلة المراد حلها**
وصف المشكلة التي تحلها هذه المميزة.

**الحل المقترح**
وصف واضح للحل المقترح.

**البدائل المدروسة**
حلول بديلة فكرت فيها.

**سياق إضافي**
أي معلومات أخرى مفيدة.
```

---

## 🔀 Pull Requests

### قبل إنشاء PR

- [ ] Fork المشروع
- [ ] أنشئ branch من `develop`
- [ ] اكتب كود نظيف
- [ ] أضف/حدّث الاختبارات
- [ ] اختبر محلياً
- [ ] حدّث التوثيق
- [ ] التزم بمعايير الكود

### عملية إنشاء PR

```bash
# 1. تأكد من آخر تحديثات
git fetch upstream
git checkout develop
git merge upstream/develop

# 2. أنشئ branch جديد
git checkout -b feature/amazing-feature

# 3. اعمل على التغييرات
# ... code ...

# 4. اختبر
npm test
npm run lint

# 5. Commit
git add .
git commit -m "feat: add amazing feature"

# 6. Push
git push origin feature/amazing-feature

# 7. افتح PR على GitHub
```

### قالب PR

```markdown
## الوصف
وصف مختصر للتغييرات.

## نوع التغيير
- [ ] إصلاح خطأ (bug fix)
- [ ] مميزة جديدة (new feature)
- [ ] تغيير كاسر (breaking change)
- [ ] تحديث توثيق

## كيف تم الاختبار؟
وصف الاختبارات التي أجريتها.

## Checklist
- [ ] الكود يتبع معايير المشروع
- [ ] أجريت self-review
- [ ] أضفت تعليقات للكود المعقد
- [ ] حدّثت التوثيق
- [ ] لا تحذيرات جديدة
- [ ] أضفت اختبارات
- [ ] الاختبارات تمر محلياً
- [ ] التغييرات المعتمدة تدمج بشكل صحيح
```

---

## 📏 معايير الكود

### TypeScript/JavaScript

```typescript
// ✅ جيد
interface User {
  id: number;
  name: string;
}

const getUser = async (id: number): Promise<User> => {
  // Implementation
};

// ❌ سيء
function getUser(id) {
  // No types
}
```

### React Components

```tsx
// ✅ جيد
interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

// ❌ سيء
export const Button = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### Naming Conventions

| النوع | النمط | مثال |
|-------|-------|-------|
| Components | PascalCase | `UserProfile` |
| Functions | camelCase | `getUserData` |
| Constants | UPPER_SNAKE_CASE | `API_URL` |
| Files | kebab-case | `user-profile.tsx` |

### Commit Messages

نستخدم [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add login functionality
fix: resolve memory leak in data table
docs: update API documentation
style: format code with prettier
refactor: reorganize folder structure
test: add tests for auth module
chore: update dependencies
```

---

## 👀 عملية المراجعة

### ما نبحث عنه

- ✅ الكود يعمل كما هو متوقع
- ✅ يتبع معايير المشروع
- ✅ الاختبارات موجودة وتمر
- ✅ التوثيق محدث
- ✅ لا تأثير سلبي على الأداء
- ✅ الأمان مراعى

### الجدول الزمني

| الخطوة | الوقت المتوقع |
|--------|----------------|
| المراجعة الأولية | 1-3 أيام |
| التغييرات المطلوبة | حسب التعقيد |
| المراجعة النهائية | 1-2 يوم |
| الدمج | فوري بعد الموافقة |

### بعد المراجعة

- **الموافقة ✅**: سيتم دمج PR
- **تغييرات مطلوبة 🔄**: عدّل وأعد Push
- **رفض ❌**: سنوضح السبب

---

## 🎓 موارد للمساهمين

### التوثيق
- [README.md](./README.md) - نظرة عامة
- [DEVELOPMENT.md](./DEVELOPMENT.md) - دليل التطوير
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - المعمارية

### أدوات مفيدة
- [VS Code](https://code.visualstudio.com/)
- [GitHub Desktop](https://desktop.github.com/)
- [Postman](https://www.postman.com/) للاختبار

### المجتمع
- **Discord**: [رابط Discord]
- **GitHub Discussions**: [رابط]
- **Email**: (قناة داخلية)

---

## 🏆 المساهمون

شكراً لجميع المساهمين الرائعين:

<!-- قائمة المساهمين ستضاف هنا -->

---

## ❓ أسئلة؟

لديك سؤال؟ اسأل في:
- GitHub Discussions
- Discord Server
- Email: (قناة داخلية)

---

## 📝 الترخيص

بالمساهمة، توافق على أن مساهماتك ستكون تحت نفس ترخيص المشروع.

---

**شكراً على مساهماتك! 🎉**

نحن نقدر وقتك وجهدك في تحسين AZRAR.

</div>

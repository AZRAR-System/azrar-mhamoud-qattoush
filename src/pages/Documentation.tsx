
import React from 'react';
import { Printer, BookOpen, Code, Layers, Database, Server } from 'lucide-react';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';

export const Documentation: React.FC = () => {
  
  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'documentation' });
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-fade-in">
      
      {/* Screen Only Header */}
      <div className={`${DS.components.pageHeader} mb-8 print:hidden`}>
        <div>
          <h2 className={DS.components.pageTitle + " flex items-center gap-2"}>
            <BookOpen className="text-indigo-600" /> التوثيق التقني للنظام
          </h2>
          <p className={DS.components.pageSubtitle}>مرجع المطورين، الهيكلية، ودليل التشغيل</p>
        </div>
        <RBACGuard requiredPermission="PRINT_EXECUTE">
          <Button onClick={handlePrint} rightIcon={<Printer size={18} />}>
            حفظ كـ PDF
          </Button>
        </RBACGuard>
      </div>

      {/* Document Content (Printable) */}
      <div className="app-card p-12 rounded-3xl text-slate-800 dark:text-slate-200 print:shadow-none print:border-none print:p-0 print:text-black">
        
        {/* Doc Header */}
        <div className="border-b-2 border-gray-100 dark:border-slate-700 pb-8 mb-8 text-center print:border-black">
          <h1 className="text-4xl font-black mb-2">نظام خبرني العقاري</h1>
          <h2 className="text-xl text-slate-500 dark:text-slate-400 print:text-gray-600">التوثيق التقني الشامل (Technical Documentation)</h2>
          <p className="mt-4 text-sm font-mono text-slate-400">الإصدار 3.0 | التحديث: 2026-01-05</p>
        </div>

        {/* 1. Introduction */}
        <section className="mb-10">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 print:text-black">
            1. مقدمة عن النظام
          </h3>
          <p className="leading-loose text-justify mb-4">
            **نظام خبرني العقاري** هو منصة ويب حديثة (SPA - Single Page Application) مصممة لإدارة المحافظ العقارية بشكل متكامل. يهدف النظام إلى أتمتة العمليات اليومية للشركات العقارية، بدءاً من إدارة الملاك والمستأجرين، مروراً بإنشاء العقود وتحصيل الدفعات، وصولاً إلى الصيانة والتقارير المالية.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl print:border print:bg-transparent">
              <h4 className="font-bold mb-2">الفئة المستهدفة</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>شركات إدارة الأملاك</li>
                <li>أصحاب العقارات (الملاك)</li>
                <li>مدراء المجمعات السكنية والتجارية</li>
              </ul>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl print:border print:bg-transparent">
              <h4 className="font-bold mb-2">الميزات التقنية</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Desktop Mode: SQLite KV + LocalStorage Cache</li>
                <li>SQL Server Sync (Desktop) + Sync Log</li>
                <li>Smart Engine (AI-like Behavior Tracking)</li>
                <li>Strict Typing (TypeScript)</li>
                <li>Responsive Design & RTL Support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2. Folder Structure */}
        <section className="mb-10 break-inside-avoid">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 print:text-black">
            <Code size={24}/> 2. بنية المشروع (Folder Structure)
          </h3>
          <div className="bg-slate-900 text-slate-300 p-6 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto print:bg-gray-100 print:text-black print:border">
<pre>{`/src
├── /components          # مكونات الواجهة (UI Components)
│   ├── /dashboard       # ودجات لوحة التحكم (Widgets)
│   ├── /panels          # اللوحات الجانبية (Slide-over Panels)
│   ├── /smart           # مكونات المحرك الذكي (Assistant UI)
│   ├── /ui              # مكتبة العناصر الأساسية (Button, Input...)
│   ├── Layout.tsx       # الهيكل العام (Sidebar + Header)
│   └── RBACGuard.tsx    # مكوّن حماية الصلاحيات
│
├── /context             # إدارة الحالة العامة (Global State)
│   ├── AuthContext.tsx  # إدارة جلسة المستخدم
│   ├── ModalContext.tsx # محرك النوافذ (SmartModalEngine)
│   └── ToastContext.tsx # نظام التنبيهات المنبثقة
│
├── /pages               # صفحات النظام الرئيسية (Routes)
│   ├── Dashboard.tsx    # لوحة المعلومات
│   ├── Contracts.tsx    # إدارة العقود
│   ├── People.tsx       # إدارة الأشخاص
│   ├── Settings.tsx     # الإعدادات
│   └── ...              # بقية الصفحات
│
├── /services            # طبقة المنطق والبيانات (Business Logic)
│   ├── dbCache.ts       # نظام الفهرسة والكاش (In-Memory Indexing)
│   ├── mockDb.ts        # محاكي قاعدة البيانات (CRUD Operations)
│   ├── smartEngine.ts   # خوارزميات الذكاء والتعلم
│   └── searchEngine.ts  # محرك البحث والتصفية المتقدم
│
├── /types.ts            # تعريفات البيانات (TypeScript Interfaces)
├── /config.ts           # إعدادات البيئة والروابط
├── /App.tsx             # نقطة الدخول وتعريف المسارات
└── /main.tsx            # تشغيل الرياكت`}</pre>
          </div>
        </section>

        {/* 3. Core Layers */}
        <section className="mb-10 break-inside-avoid">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 print:text-black">
            <Layers size={24}/> 3. الطبقات الأساسية (Core Layers)
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-indigo-500 pl-4">
              <h4 className="font-bold text-lg">A. طبقة البيانات (Data Layer - DbService)</h4>
              <p className="text-sm">الوسيط الوحيد بين الواجهة وقاعدة البيانات. تحتوي على دوال get, add, update, delete. تقرأ حالياً من التخزين المحلي.</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-bold text-lg">B. محرك الذكاء (Smart Behavior Engine)</h4>
              <p className="text-sm">نظام يتعلم الأنماط من سلوك المستخدم (التتبع، التنبؤ، وكشف الشذوذ في البيانات).</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-bold text-lg">C. نظام الصلاحيات (RBAC System)</h4>
              <p className="text-sm">تحكم يعتمد على الأدوار (SuperAdmin, Admin, Employee) مع صلاحيات دقيقة مثل ADD_PERSON.</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-bold text-lg">D. سجل التدقيق (Audit Logging)</h4>
              <p className="text-sm">يسجل كل حركة (إضافة/تعديل/حذف) مع اسم المستخدم والتاريخ لضمان الشفافية.</p>
            </div>
          </div>
        </section>

        {/* 4. Data Structures */}
        <section className="mb-10 break-inside-avoid">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 print:text-black">
            <Database size={24}/> 4. هيكلية البيانات (Data Schema)
          </h3>
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-900/50 print:bg-white">
              <strong className="block text-lg mb-2">الأشخاص (People)</strong>
              <code>رقم_الشخص (PK), الاسم, رقم_الهاتف, الرقم_الوطني</code>
            </div>
            <div className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-900/50 print:bg-white">
              <strong className="block text-lg mb-2">العقارات (Properties)</strong>
              <code>رقم_العقار (PK), الكود_الداخلي, رقم_المالك (FK), حالة_العقار, المساحة</code>
            </div>
            <div className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-900/50 print:bg-white">
              <strong className="block text-lg mb-2">العقود (Contracts)</strong>
              <code>رقم_العقد (PK), رقم_العقار (FK), رقم_المستاجر (FK), القيمة_السنوية, تواريخ_البداية_والنهاية</code>
            </div>
            <div className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-900/50 print:bg-white">
              <strong className="block text-lg mb-2">الكمبيالات (Installments)</strong>
              <code>رقم_الكمبيالة (PK), رقم_العقد (FK), تاريخ_الاستحقاق, القيمة, الحالة (مدفوع/غير مدفوع)</code>
            </div>
          </div>
        </section>

        {/* 5. Developer Guide */}
        <section className="mb-10 break-inside-avoid">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 print:text-black">
            <Server size={24}/> 5. دليل المطورين (Developer Guide)
          </h3>
          
          <div className="mb-6">
            <h4 className="font-bold mb-2">قواعد كتابة الكود (Coding Standards)</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>استخدام <strong>PascalCase</strong> للمكونات (Components).</li>
              <li>استخدام <strong>camelCase</strong> للدوال والمتغيرات.</li>
              <li>فصل منطق البيانات (Services) عن الواجهة (UI).</li>
              <li>استخدام <code>DbService</code> دائماً للتعامل مع البيانات وعدم استدعاء LocalStorage مباشرة.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-2">وضع Desktop فقط</h4>
            <p className="text-sm">
              هذا المشروع يعمل كتطبيق مكتبي (Electron) مع قاعدة بيانات SQLite محلية. الربط مع Backend/LAN غير مستخدم.
            </p>
          </div>

          <div className="mt-6">
            <h4 className="font-bold mb-2">مرجع المطورين (مهم)</h4>
            <p className="text-sm mb-2">
              المرجع التفصيلي للمعمارية وأوامر البناء وخريطة الدوال موجود ضمن مجلد التوثيق في المشروع.
            </p>
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto print:bg-gray-100 print:text-black print:border">
<pre>{`docs/DEVELOPER_REFERENCE.md
docs/TECHNICAL_DOCUMENTATION.md`}</pre>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold mb-2">تحديثات الصيانة الأخيرة (2026-01)</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>سجل المزامنة يسجل التعديل والحذف بشكل أوضح + سطر ملخص بعد “مزامنة الآن”.</li>
              <li>زر “مزامنة الآن” في لوحة المعلومات + مزامنة تلقائية كل 5 دقائق (مع منع التزامن المتكرر).</li>
              <li>الترويسة: خيار تفعيل/تعطيل + “هوية الشركة” للطباعة والتصدير.</li>
              <li>Excel: إضافة ورقة “الترويسة” كـ Sheet إضافي داخل ملف .xlsx.</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-slate-700 text-center text-sm text-slate-500 font-mono">
          <p>© 2025 — Developed by Mahmoud Qattoush</p>
          <p>AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>

      </div>
    </div>
  );
};


import {
  LayoutDashboard,
  Building,
  FileText,
  CreditCard,
  Settings,
  Database,
  Bell,
  Activity,
  ShieldCheck,
  Wrench,
  HandCoins,
  BarChart3,
  Scale,
  ServerCog,
  Shield,
  Users,
  BadgeDollarSign,
  Lock,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

import { ROUTE_PATHS, type RoutePath } from './paths';

export type RoleName = 'SuperAdmin' | string;

export type NavItem = {
  label: string;
  path: RoutePath | string;
  icon: LucideIcon;
  children?: NavItem[];
  role?: RoleName;
};

// Single source of truth for the sidebar navigation structure.
// Keep this aligned with [src/App.tsx](src/App.tsx) routing.
export const NAV_ITEMS: NavItem[] = [
  { label: 'لوحة المعلومات', path: ROUTE_PATHS.DASHBOARD, icon: LayoutDashboard },
  { label: 'إدارة المبيعات', path: ROUTE_PATHS.SALES, icon: BadgeDollarSign },
  { label: 'إدارة الأشخاص', path: ROUTE_PATHS.PEOPLE, icon: Users },
  { label: 'إدارة العقارات', path: ROUTE_PATHS.PROPERTIES, icon: Building },
  { label: 'العقود', path: ROUTE_PATHS.CONTRACTS, icon: FileText },
  { label: 'الدفعات المالية', path: ROUTE_PATHS.INSTALLMENTS, icon: CreditCard },
  { label: 'أدوات ذكية', path: ROUTE_PATHS.SMART_TOOLS, icon: ServerCog },
  { label: 'إدارة العمولات', path: ROUTE_PATHS.COMMISSIONS, icon: HandCoins },
  { label: 'الصيانة والدعم', path: ROUTE_PATHS.MAINTENANCE, icon: Wrench },
  { label: 'التنبيهات', path: ROUTE_PATHS.ALERTS, icon: Bell },
  { label: 'التقارير الشاملة', path: ROUTE_PATHS.REPORTS, icon: BarChart3 },
  { label: 'المركز القانوني', path: ROUTE_PATHS.LEGAL, icon: Scale },
  {
    label: 'المشرفين',
    path: '#admin-group',
    icon: ShieldCheck,
    children: [
      { label: 'لوحة التحكم المركزية', path: ROUTE_PATHS.ADMIN_PANEL, icon: Shield },
      { label: 'إعدادات النظام', path: ROUTE_PATHS.SETTINGS, icon: Settings },
      { label: 'سجل العمليات', path: ROUTE_PATHS.OPERATIONS, icon: Activity },
      { label: 'صيانة النظام', path: ROUTE_PATHS.SYS_MAINTENANCE, icon: ServerCog },
      { label: 'قواعد البيانات', path: ROUTE_PATHS.DATABASE, icon: Database },
      { label: 'منشئ النظام', path: ROUTE_PATHS.BUILDER, icon: Database },
      { label: 'التوثيق التقني', path: ROUTE_PATHS.DOCS, icon: BookOpen },
      { label: 'إعادة ضبط المصنع', path: ROUTE_PATHS.RESET_DATABASE, icon: Lock, role: 'SuperAdmin' },
    ],
  },
];

// Optional: quick lookup table for titles (can be used outside the sidebar).
export const ROUTE_TITLES: Record<string, string> = (() => {
  const titles: Record<string, string> = {};
  const visit = (item: NavItem) => {
    if (typeof item.path === 'string' && item.path.startsWith('/')) titles[item.path] = item.label;
    item.children?.forEach(visit);
  };
  NAV_ITEMS.forEach(visit);

  // Non-sidebar / utility routes
  titles[ROUTE_PATHS.ACTIVATION] = 'تفعيل النظام';
  titles[ROUTE_PATHS.LOGIN] = 'تسجيل الدخول';
  titles[ROUTE_PATHS.LOGOUT] = 'تسجيل الخروج';
  titles[ROUTE_PATHS.SMART_TOOLS] = 'أدوات ذكية';
  titles[ROUTE_PATHS.COMPANIES] = 'إدارة الأشخاص';
  titles[ROUTE_PATHS.CONTACTS] = 'اتصالات';
  titles[ROUTE_PATHS.BULK_WHATSAPP] = 'إرسال واتساب جماعي';
  titles[ROUTE_PATHS.DOCUMENTS] = 'مستندات';
  titles[ROUTE_PATHS.COMPREHENSIVE_TESTS] = 'الاختبارات الشاملة';
  titles[ROUTE_PATHS.RESET_DATABASE] = 'إعادة ضبط المصنع';

  return titles;
})();

// Optional: per-route subtitle/description (shown in the global header).
// Keep aligned with page headers where available.
export const ROUTE_SUBTITLES: Record<string, string> = {
  [ROUTE_PATHS.ACTIVATION]: 'إدخال رمز التفعيل لتفعيل النظام',
  [ROUTE_PATHS.DASHBOARD]: 'نظام مراقبة شامل متعدد الطبقات مع تحديثات فورية',
  [ROUTE_PATHS.SALES]: 'نظام متكامل لإدارة عروض البيع، المفاوضات، ونقل الملكية',
  [ROUTE_PATHS.PEOPLE]: 'سجل العملاء، الملاك، والمستأجرين',
  [ROUTE_PATHS.CONTACTS]: 'سجل هاتف مُستمد من الأشخاص مع اتصال وواتساب',
  [ROUTE_PATHS.CONTRACTS]: 'دورة حياة كاملة للعقود: إنشاء، تجديد، مخالصات، وأرشفة.',
  [ROUTE_PATHS.INSTALLMENTS]: 'إدارة الدفعات حسب العقود، السداد، ومتابعة المتأخرات',
  [ROUTE_PATHS.COMMISSIONS]: 'تتبع صافي العمولات من العقود والعمليات الخارجية الشهرية',
  [ROUTE_PATHS.MAINTENANCE]: 'إدارة طلبات الصيانة وتكاليف الإصلاح',
  [ROUTE_PATHS.ALERTS]: 'مركز العمليات: متابعة التحصيل، جودة البيانات، والمخاطر',
  [ROUTE_PATHS.REPORTS]: 'توليد تقارير تفصيلية عن جميع عمليات النظام مع إمكانية التصدير والطباعة.',
  [ROUTE_PATHS.LEGAL]: 'توليد وإدارة الإنذارات والإشعارات القانونية للمستأجرين.',
  [ROUTE_PATHS.BUILDER]: 'إدارة الحقول + الجداول + النماذج الديناميكية',
  [ROUTE_PATHS.DOCUMENTS]: 'عرض مجمّع للمرفقات حسب الصنف والصفة',
  [ROUTE_PATHS.BULK_WHATSAPP]: 'اكتب رسالة وافتح محادثات واتساب لعدة جهات اتصال مع مهلة بين كل فتح',
  [ROUTE_PATHS.ADMIN_PANEL]: 'إدارة المستخدمين، الصلاحيات، ومراقبة النظام',
  [ROUTE_PATHS.SETTINGS]: 'تخصيص البيانات، القوائم، والنسخ الاحتياطي',
  [ROUTE_PATHS.DATABASE]: 'إدارة الجداول، تحسين الأداء، والتحكم في القيود',
  [ROUTE_PATHS.DOCS]: 'مرجع المطورين، الهيكلية، ودليل التشغيل',
  [ROUTE_PATHS.RESET_DATABASE]: 'حذف البيانات وإعادة تهيئة النظام',
};

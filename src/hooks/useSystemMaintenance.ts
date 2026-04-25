import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useDbSignal } from '@/hooks/useDbSignal';
import { DbService } from '@/services/mockDb';
import { storage } from '@/services/storage';
import { buildCache } from '@/services/dbCache';
import { validateAllData } from '@/services/dataValidation';
import { runSystemScenarioTests, UiTestResult } from '@/services/integrationTests';
import { clearAllData, resetToFreshState, getDatabaseStats } from '@/services/resetDatabase';
import { isTenancyRelevant } from '@/utils/tenancy';
import { getErrorMessage } from '@/utils/errors';
import { SystemHealth, PredictiveInsight, PerformanceRow, العقود_tbl, الكمبيالات_tbl } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { Table, Key } from 'lucide-react';

export type TabKey = 'diagnostics' | 'predictive' | 'performance' | 'testing' | 'database';

type ViteMeta = {
  env?: {
    VITE_AUTORUN_SYSTEM_TESTS?: unknown;
    VITE_AUTORUN_SYSTEM_TESTS_MUTATION?: unknown;
    VITE_ENABLE_INTEGRATION_TEST_DATA?: unknown;
  };
};

const FRIENDLY_NAMES: Record<string, string> = {
  db_people: 'الأشخاص (People)',
  db_properties: 'العقارات (Properties)',
  db_contracts: 'العقود (Contracts)',
  db_installments: 'الكمبيالات / جدول الدفعات (Installments)',
  db_operations: 'سجل العمليات (Logs)',
  db_users: 'المستخدمين (Users)',
  db_roles: 'الأدوار (Roles)',
  db_user_permissions: 'صلاحيات المستخدمين (User Permissions)',
  db_settings: 'إعدادات النظام (Settings)',
  db_blacklist: 'القائمة السوداء (Blacklist)',
  db_sales_listings: 'عروض البيع (Sales Listings)',
  db_sales_offers: 'عروض الشراء (Sales Offers)',
  db_sales_agreements: 'اتفاقيات البيع (Sales Agreements)',
  db_external_commissions: 'العمولات الخارجية (External Commissions)',
  db_ownership_history: 'سجل الملكية (Ownership History)',
  db_maintenance_tickets: 'الصيانة (Maintenance Tickets)',
  db_attachments: 'المرفقات (Attachments)',
  db_notes: 'الملاحظات (Notes)',
  db_activities: 'النشاطات (Activities)',
  db_lookups: 'القوائم (Lookups)',
  db_lookup_categories: 'تصنيفات القوائم (Lookup Categories)',
  db_dynamic_tables: 'الجداول الديناميكية (Dynamic Tables)',
  db_dynamic_records: 'سجلات ديناميكية (Dynamic Records)',
  db_dynamic_form_fields: 'حقول النماذج (Dynamic Fields)',
  db_dashboard_config: 'إعدادات لوحة التحكم (Dashboard Config)',
  db_dashboard_notes: 'ملاحظات لوحة التحكم (Dashboard Notes)',
  db_reminders: 'التذكيرات (Reminders)',
  db_client_interactions: 'تفاعلات العملاء (Client Interactions)',
  db_followups: 'المتابعات (Follow-ups)',
  db_notification_send_logs: 'سجل إرسال التنبيهات (Notification Send Logs)',
  db_clearance_records: 'براءة الذمة (Clearance Records)',
  db_legal_templates: 'قوالب قانونية (Legal Templates)',
  db_legal_history: 'سجل قانوني (Legal History)',
  db_smart_behavior: 'سلوك ذكي (Smart Behavior)',
  theme: 'الثيم (Theme)',
  khaberni_onboarding_completed: 'حالة الإرشاد (Onboarding)',
  ui_sales_edit_agreement_id: 'ربط تعديل اتفاقية بيع (Sales Deep Link)',
  app_update_feed_url: 'رابط التحديثات (Update Feed URL)',
  audioConfig: 'إعدادات الصوت (Audio Config)',
  daily_scheduler_last_run: 'آخر تشغيل للجدولة اليومية',
  notification_templates: 'قوالب الإشعارات (Notification Templates)',
  notificationLogs: 'سجل الإشعارات (Notification Logs)',
  dashboard_tasks: 'مهام لوحة التحكم (Dashboard Tasks)',
};

const KNOWN_ORDER = [
  'db_people',
  'db_properties',
  'db_contracts',
  'db_installments',
  'db_users',
  'db_roles',
  'db_user_permissions',
  'db_operations',
  'db_settings',
  'db_blacklist',
  'db_sales_listings',
  'db_sales_offers',
  'db_sales_agreements',
  'db_external_commissions',
  'db_ownership_history',
  'db_maintenance_tickets',
  'db_attachments',
  'db_notes',
  'db_activities',
  'db_lookups',
  'db_lookup_categories',
  'db_dynamic_tables',
  'db_dynamic_records',
  'db_dynamic_form_fields',
  'db_dashboard_config',
  'db_dashboard_notes',
  'db_reminders',
  'db_client_interactions',
  'db_followups',
  'db_notification_send_logs',
  'db_clearance_records',
  'db_legal_templates',
  'db_legal_history',
  'db_smart_behavior',
  'theme',
  'app_update_feed_url',
  'audioConfig',
  'notification_templates',
  'notificationLogs',
  'dashboard_tasks',
  'daily_scheduler_last_run',
  'khaberni_onboarding_completed',
  'ui_sales_edit_agreement_id',
];

const HIDDEN_KEYS = new Set(['demo_data_loaded']);

let systemTestsAutorunStarted = false;

export const useSystemMaintenance = (isVisible: boolean) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const dbSignal = useDbSignal();

  const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb;

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [predictiveInsight, setPredictiveInsight] = useState<PredictiveInsight | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    const enabled = typeof flag === 'string' ? flag.toLowerCase() === 'true' : !!flag;
    return enabled ? 'testing' : 'diagnostics';
  });

  // System Testing Tab State
  const [testingRunning, setTestingRunning] = useState(false);
  const [allowMutation, setAllowMutation] = useState(false);
  const [testResults, setTestResults] = useState<UiTestResult[] | null>(null);
  const [resultsPage, setResultsPage] = useState(1);

  // Database Tab State
  const [dbPath, setDbPath] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [installingFromFile, setInstallingFromFile] = useState<boolean>(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [tables, setTables] = useState<Array<{ key: string; name: string; icon: LucideIcon; kind: 'db' | 'system' }>>([]);
  const [tablesPage, setTablesPage] = useState(1);
  const [dbStats, setDbStats] = useState<Record<string, number>>({});
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    if (role !== 'superadmin') navigate('/');
  }, [isAuthenticated, user, navigate]);

  const buildHealthFromValidation = useCallback((): SystemHealth => {
    const validation = validateAllData();
    const integrityWarnings = validation.warnings.length;
    const logicErrors = validation.errors.length;
    const orphans = validation.errors.filter((e) => e.includes('غير موجود')).length;

    const score = Math.max(0, Math.min(100, 100 - (logicErrors * 10 + integrityWarnings * 3)));
    const status: SystemHealth['status'] =
      score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Warning' : 'Critical';

    const categorize = (msg: string) => {
      if (msg.startsWith('تكرار')) return 'فهرسة/تكرار';
      if (msg.includes('غير موجود')) return 'علاقات/ربط';
      if (msg.includes('تاريخ')) return 'تواريخ';
      if (msg.includes('مدة')) return 'منطق/مدة';
      return 'بيانات';
    };

    const issues: SystemHealth['issues'] = [
      ...validation.errors.map((e, idx) => ({
        id: `E-${idx}`,
        type: 'Critical' as const,
        category: categorize(e),
        description: e,
      })),
      ...validation.warnings.map((w, idx) => ({
        id: `W-${idx}`,
        type: 'Warning' as const,
        category: categorize(w),
        description: w,
      })),
    ];

    return {
      score, status, issues,
      stats: { integrityWarnings, orphans, logicErrors },
    };
  }, []);

  const buildPredictiveFromData = useCallback((): PredictiveInsight => {
    const today = new Date();
    const contracts = DbService.getContracts() as العقود_tbl[];
    const installments = DbService.getInstallments() as الكمبيالات_tbl[];

    const lateInstallments = installments.filter((inst) => {
      const dueDate = new Date(inst.تاريخ_استحقاق);
      return inst.حالة_الكمبيالة !== 'مدفوع' && dueDate < today;
    });

    const expiringContracts = contracts.filter((c) => {
      const endDate = new Date(c.تاريخ_النهاية);
      const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return isTenancyRelevant(c) && daysUntil > 0 && daysUntil <= 30;
    });

    const riskFactors = [
      { category: 'LatePayments', count: lateInstallments.length, percentage: 0 },
      { category: 'ExpiringContracts', count: expiringContracts.length, percentage: 0 },
    ].filter((r) => r.count > 0);

    const totalRisk = riskFactors.reduce((s, r) => s + r.count, 0);
    const normalized = riskFactors.map((r) => ({
      ...r,
      percentage: totalRisk > 0 ? Math.round((r.count / totalRisk) * 100) : 0,
    }));

    const score = Math.max(0, Math.min(100, 100 - (lateInstallments.length * 4 + expiringContracts.length * 2)));
    const status: PredictiveInsight['status'] = score >= 70 ? 'Safe' : 'Risk';
    const trend: PredictiveInsight['trend'] = totalRisk === 0 ? 'Improving' : score >= 70 ? 'Stable' : 'Declining';

    const recommendations: string[] = [];
    if (lateInstallments.length > 0)
      recommendations.push(`يوجد ${lateInstallments.length} دفعة متأخرة. راجع صفحة الكمبيالات واتخذ إجراء متابعة.`);
    if (expiringContracts.length > 0)
      recommendations.push(`يوجد ${expiringContracts.length} عقد سينتهي خلال 30 يوم. ابدأ إجراءات التجديد مبكراً.`);
    if (recommendations.length === 0)
      recommendations.push('لا توجد مخاطر واضحة حالياً. استمر بالمراقبة الدورية.');

    return { score, status, trend, riskFactors: normalized, recommendations };
  }, []);

  const runCheck = useCallback(() => {
    if (isDesktopFast) {
      const ok = window.confirm('تنبيه: الفحص الشامل قد يكون ثقيلاً جداً على قواعد بيانات كبيرة (200k+).\n\nهل تريد المتابعة؟');
      if (!ok) {
        setHealth({
          score: 75, status: 'Warning',
          issues: [{ id: 'desktop-fast-skip', type: 'Warning', category: 'الأداء', description: 'تم إلغاء الفحص الشامل لتجنب تحميل/تجميد البيانات الكبيرة في وضع الديسكتوب السريع.' }],
          stats: { integrityWarnings: 0, orphans: 0, logicErrors: 0 },
        });
        setPredictiveInsight({ score: 75, status: 'Safe', trend: 'Stable', riskFactors: [], recommendations: ['قم بتشغيل الفحص يدوياً عند الحاجة (قد يستغرق وقتاً على بيانات كبيرة).'] });
        setLoading(false);
        return;
      }
    }
    setActiveTab('diagnostics');
    setLoading(true);
    requestAnimationFrame(() => {
      try {
        const h = buildHealthFromValidation();
        const p = buildPredictiveFromData();
        setHealth(h);
        setPredictiveInsight(p);
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'حدث خطأ أثناء إعادة الفحص');
      } finally {
        setLoading(false);
      }
    });
  }, [buildHealthFromValidation, buildPredictiveFromData, isDesktopFast, toast]);

  const runPerfTest = useCallback(() => {
    if (isDesktopFast) {
      const ok = window.confirm('تنبيه: اختبار الأداء يقوم بقراءات كاملة للبيانات وقد يسبب تجمد مؤقت على قواعد بيانات كبيرة.\n\nهل تريد المتابعة؟');
      if (!ok) return;
    }
    setLoading(true);
    try {
      const measure = (name: string, fn: () => void): PerformanceRow => {
        const t0 = performance.now();
        fn();
        const t1 = performance.now();
        const t2 = performance.now();
        fn();
        const t3 = performance.now();
        return { name, before: t1 - t0, after: t3 - t2 };
      };
      const report: PerformanceRow[] = [
        measure('قراءة الأشخاص', () => { DbService.getPeople(); }),
        measure('قراءة العقارات', () => { DbService.getProperties(); }),
        measure('قراءة العقود', () => { DbService.getContracts(); }),
        measure('قراءة الكمبيالات', () => { DbService.getInstallments(); }),
        measure('قراءة التنبيهات', () => { DbService.getAlerts(); }),
      ];
      setPerformanceReport(report);
      setActiveTab('performance');
    } finally {
      setLoading(false);
    }
  }, [isDesktopFast]);

  const handleAutoFix = useCallback(() => {
    setOptimizing(true);
    try {
      const result = DbService.optimizeSystem();
      toast.success(result.message);
      runCheck();
    } finally {
      setOptimizing(false);
    }
  }, [runCheck, toast]);

  useEffect(() => {
    if (!isVisible) return;
    if (!isDesktopFast) { runCheck(); return; }
    setHealth({
      score: 85, status: 'Good',
      issues: [{ id: 'desktop-fast-note', type: 'Warning', category: 'الأداء', description: 'تم تعطيل الفحص التلقائي في وضع الديسكتوب السريع لتجنب تحميل بيانات ضخمة. اضغط "إعادة الفحص" لتشغيل الفحص الشامل عند الحاجة.' }],
      stats: { integrityWarnings: 0, orphans: 0, logicErrors: 0 },
    });
    setPredictiveInsight({ score: 85, status: 'Safe', trend: 'Stable', riskFactors: [], recommendations: ['التشخيص التلقائي معطل في وضع الديسكتوب السريع.'] });
    setLoading(false);
  }, [runCheck, dbSignal, isDesktopFast, isVisible]);

  // --- Testing Logic ---
  const runTests = useCallback(async () => {
    setTestingRunning(true);
    try {
      const r = await runSystemScenarioTests({ allowDataMutation: allowMutation });
      setTestResults(r);
      const failed = r.filter((x) => x.status === 'FAIL').length;
      toast[failed > 0 ? 'warning' : 'success'](failed > 0 ? `تم الانتهاء: ${failed} اختبار فشل` : 'تم تشغيل الاختبارات بنجاح');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تشغيل الاختبارات');
    } finally {
      setTestingRunning(false);
    }
  }, [allowMutation, toast]);

  const isAutorunEnabled = useMemo(() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    if (typeof flag === 'string') return flag.toLowerCase() === 'true';
    try {
      if (typeof window !== 'undefined') {
        const qs = new URLSearchParams(window.location.search);
        const v = qs.get('autorun');
        if (v) return String(v).toLowerCase() === 'true' || v === '1';
      }
    } catch (_err) {
      // ignore
    }
    return !!flag;
  }, []);

  const isIntegrationDataEnabled = useMemo(() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_ENABLE_INTEGRATION_TEST_DATA;
    if (typeof flag === 'string') return flag.toLowerCase() === 'true';
    try {
      if (typeof window !== 'undefined') {
        const qs = new URLSearchParams(window.location.search);
        const v = qs.get('integrationData');
        if (v) return String(v).toLowerCase() === 'true' || v === '1';
      }
    } catch (_err) {
      // ignore
    }
    return !!flag;
  }, []);

  useEffect(() => {
    if (!isAutorunEnabled || systemTestsAutorunStarted || testingRunning || testResults) return;
    systemTestsAutorunStarted = true;
    const forceMutation = (() => {
      const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS_MUTATION;
      if (typeof flag === 'string') return flag.toLowerCase() === 'true';
      try {
        if (typeof window !== 'undefined') {
          const v = new URLSearchParams(window.location.search).get('mutation');
          if (v) return String(v).toLowerCase() === 'true' || v === '1';
        }
      } catch (_err) {
        // ignore
      }
      return !!flag;
    })();
    const mutation = forceMutation || isIntegrationDataEnabled;
    setAllowMutation(mutation);
    setTestingRunning(true);
    (async () => {
      try {
        const r = await runSystemScenarioTests({ allowDataMutation: mutation });
        setTestResults(r);
        const fail = r.filter((x) => x.status === 'FAIL').length;
        toast[fail > 0 ? 'warning' : 'success'](fail > 0 ? `تم الانتهاء: ${fail} اختبار فشل` : 'تم تشغيل الاختبارات بنجاح');
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'فشل تشغيل الاختبارات');
      } finally {
        setTestingRunning(false);
        try {
          if (typeof window !== 'undefined' && !!window.desktopDb) {
            setTimeout(() => {
              const quit = (window.desktopDb as unknown as Record<string, unknown>)?.quitApp;
              if (typeof quit === 'function') void (quit as () => void)();
              else window.close();
            }, 900);
          }
        } catch (_err) {
          // ignore
        }
      }
    })();
  }, [isAutorunEnabled, isIntegrationDataEnabled, testResults, testingRunning, toast]);

  const handleResetAllData = useCallback(() => {
    if (user?.الدور !== 'SuperAdmin') { toast.error('هذه العملية متاحة للسوبر أدمن فقط'); return; }
    openPanel('CONFIRM_MODAL', 'reset_all_data_step1', {
      title: 'تحذير', variant: 'danger', confirmText: 'متابعة',
      message: '⚠️ تحذير: سيتم حذف جميع البيانات التشغيلية مع الإبقاء على المستخدمين والصلاحيات والقوالب.\n\nهل تريد المتابعة؟',
      onConfirm: () => {
        openPanel('CONFIRM_MODAL', 'reset_all_data_step2', {
          title: 'تأكيد نهائي', variant: 'danger', confirmText: 'نعم، احذف',
          message: 'تأكيد نهائي: لا يوجد تراجع (Undo). هل أنت متأكد 100%؟',
          onConfirm: () => {
            try {
              const res = DbService.resetAllData?.();
              if (res?.success === false) { toast.error(res?.message || 'فشل مسح البيانات'); return; }
              toast.success(res?.message || 'تم مسح البيانات بنجاح');
              setTimeout(() => window.location.reload(), 800);
            } catch (e: unknown) { toast.error(getErrorMessage(e) || 'فشل مسح البيانات'); }
          },
        });
      },
    });
  }, [openPanel, toast, user?.الدور]);

  // --- Database Logic ---
  const refreshLocalStorageList = useCallback(async () => {
    try {
      const allKeys = await storage.keys();
      const keys = allKeys.filter((k) => !HIDDEN_KEYS.has(k));
      const orderIndex = new Map<string, number>();
      KNOWN_ORDER.forEach((k, i) => orderIndex.set(k, i));
      const sorted = keys.sort((a, b) => {
        const ai = orderIndex.has(a) ? (orderIndex.get(a) as number) : Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.has(b) ? (orderIndex.get(b) as number) : Number.MAX_SAFE_INTEGER;
        return ai !== bi ? ai - bi : a.localeCompare(b);
      });
      setTables(sorted.map((k) => {
        const kind: 'db' | 'system' = k.startsWith('db_') ? 'db' : 'system';
        const name = FRIENDLY_NAMES[k] ?? (kind === 'db' ? `جدول: ${k}` : `مفتاح: ${k}`);
        return { key: k, name, icon: kind === 'db' ? Table : Key, kind };
      }));
    } catch (_err) {
      setTables([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'database') return;
    if (window.desktopDb?.getPath) window.desktopDb.getPath().then(setDbPath).catch(() => { });
    if (window.desktopUpdater?.getVersion) window.desktopUpdater.getVersion().then(setAppVersion).catch(() => { });
    getDatabaseStats().then(setDbStats).catch(() => { });
    refreshLocalStorageList();
  }, [activeTab, refreshLocalStorageList]);

  const handleRebuildIndexes = () => {
    setRebuilding(true);
    setTimeout(() => { buildCache(); setRebuilding(false); toast.success('تم إعادة بناء الفهارس بنجاح'); }, 1000);
  };

  const handleClearKey = async (key: string) => {
    const ok = await toast.confirm({ title: 'تحذير', message: `هل أنت متأكد من مسح جميع بيانات (${key})؟ لا يمكن التراجع.`, confirmText: 'مسح', cancelText: 'إلغاء', isDangerous: true });
    if (ok) {
      await storage.removeItem(key);
      buildCache(); refreshLocalStorageList(); toast.success('تم مسح البيانات بنجاح');
    }
  };

  const doInstallFromFile = async () => {
    if (!window.desktopUpdater?.installFromFile) { toast.warning('متاح فقط في وضع Desktop'); return; }
    setInstallingFromFile(true);
    try { await window.desktopUpdater.installFromFile(); }
    catch (e: unknown) { toast.error(getErrorMessage(e) || 'فشل التثبيت'); }
    finally { setInstallingFromFile(false); }
  };

  const handleResetToFresh = async () => {
    const ok = await toast.confirm({ title: 'إعادة تهيئة النظام', message: 'سيتم حذف جميع البيانات والاحتفاظ بمستخدم admin فقط. هل أنت متأكد؟ اكتب "إعادة تهيئة" للتأكيد.', confirmText: 'تأكيد الحذف', cancelText: 'إلغاء', isDangerous: true, requireTextInput: 'إعادة تهيئة' });
    if (ok) {
      setResetLoading(true);
      try {
        const res = await resetToFreshState();
        if (res.success) { toast.success(res.message); setTimeout(() => window.location.reload(), 1500); }
        else toast.error(res.message);
      } finally { setResetLoading(false); }
    }
  };

  const handleClearAll = async () => {
    const ok = await toast.confirm({ title: 'حذف جميع البيانات نهائياً', message: '⚠️ تحذير: سيتم حذف كافة السجلات والملفات نهائياً. يرجى كتابة "حذف نهائي" للتأكيد.', confirmText: 'حذف الكل', cancelText: 'إلغاء', isDangerous: true, requireTextInput: 'حذف نهائي' });
    if (ok) {
      setResetLoading(true);
      try {
        const res = await clearAllData();
        if (res.success) { toast.success(res.message); setTimeout(() => window.location.reload(), 1500); }
        else toast.error(res.message);
      } finally { setResetLoading(false); }
    }
  };

  return {
    user,
    isDesktopFast,
    health,
    predictiveInsight,
    performanceReport,
    loading,
    optimizing,
    activeTab,
    setActiveTab,
    testing: {
      running: testingRunning,
      allowMutation,
      setAllowMutation,
      results: testResults,
      resultsPage,
      setResultsPage,
      runTests,
      handleResetAllData,
    },
    database: {
      dbPath, appVersion, installingFromFile, rebuilding, tables, tablesPage, setTablesPage, dbStats, resetLoading,
      handleRebuildIndexes, handleClearKey, doInstallFromFile, handleResetToFresh, handleClearAll,
    },
    runCheck,
    runPerfTest,
    handleAutoFix,
  };
};

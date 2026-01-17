
import React, { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw, Trash2, Key, Table, AlertTriangle, ShieldCheck, HardDrive, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildCache, DbCache } from '@/services/dbCache';
import { useToast } from '@/context/ToastContext';
import { storage } from '@/services/storage';
import { validateAllData, type ValidationResult } from '@/services/dataValidation';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';

type LooseRow = Record<string, unknown>;

const getArray = (key: string): LooseRow[] => {
  const cached = DbCache.arrays[key];
  if (DbCache.isInitialized && Array.isArray(cached)) return cached as LooseRow[];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LooseRow[]) : [];
  } catch {
    return [];
  }
};

export const DatabaseManager: React.FC = () => {
  const toast = useToast();
  const [rebuilding, setRebuilding] = useState(false);
  const [cacheTick, setCacheTick] = useState(0);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validatedAt, setValidatedAt] = useState<number | null>(null);

  type LocalStorageEntry = {
    key: string;
    name: string;
    icon: LucideIcon;
    kind: 'db' | 'system';
  };

  const FRIENDLY_NAMES: Record<string, string> = {
    // Core DB
    db_people: 'الأشخاص (People)',
    db_properties: 'العقارات (Properties)',
    db_contracts: 'العقود (Contracts)',
    db_installments: 'الكمبيالات (Installments)',
    db_payments: 'الدفعات (Payments)',
    db_operations: 'سجل العمليات (Logs)',
    db_users: 'المستخدمين (Users)',
    db_roles: 'الأدوار (Roles)',
    db_user_permissions: 'صلاحيات المستخدمين (User Permissions)',
    db_settings: 'إعدادات النظام (Settings)',
    db_blacklist: 'القائمة السوداء (Blacklist)',

    // Sales
    db_sales_listings: 'عروض البيع (Sales Listings)',
    db_sales_offers: 'عروض الشراء (Sales Offers)',
    db_sales_agreements: 'اتفاقيات البيع (Sales Agreements)',
    db_external_commissions: 'العمولات الخارجية (External Commissions)',
    db_ownership_history: 'سجل الملكية (Ownership History)',

    // Maintenance
    db_maintenance_tickets: 'الصيانة (Maintenance Tickets)',

    // Attachments / Notes / Activity
    db_attachments: 'المرفقات (Attachments)',
    db_notes: 'الملاحظات (Notes)',
    db_activities: 'النشاطات (Activities)',

    // Lookups / Dynamic
    db_lookups: 'القوائم (Lookups)',
    db_lookup_categories: 'تصنيفات القوائم (Lookup Categories)',
    db_dynamic_tables: 'الجداول الديناميكية (Dynamic Tables)',
    db_dynamic_records: 'سجلات ديناميكية (Dynamic Records)',
    db_dynamic_form_fields: 'حقول النماذج (Dynamic Fields)',

    // Dashboard / Extras
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

    // System/App state
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

  // Hide legacy/development-only keys from production UI.
  const HIDDEN_KEYS = useMemo(() => new Set<string>(['demo_data_loaded']), []);

  const KNOWN_ORDER = useMemo(
    () => [
      'db_people',
      'db_properties',
      'db_contracts',
      'db_installments',
      'db_payments',
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
      // system
      'theme',
      'app_update_feed_url',
      'audioConfig',
      'notification_templates',
      'notificationLogs',
      'dashboard_tasks',
      'daily_scheduler_last_run',
      'khaberni_onboarding_completed',
      'ui_sales_edit_agreement_id',
    ],
    []
  );

  const [tables, setTables] = useState<LocalStorageEntry[]>([]);

  type IndexDiagnostic = {
    name: string;
    table: string;
    type: string;
    status: 'Active' | 'Warning' | 'Info';
    note?: string;
  };

  const handleRebuildIndexes = () => {
    setRebuilding(true);
    setTimeout(() => {
      buildCache();
      setCacheTick(t => t + 1);
      setRebuilding(false);
      toast.success('تم إعادة بناء الفهارس وتحديث التجميعات (Aggregates) بنجاح');
    }, 1500);
  };

  const handleValidateConstraints = () => {
    setValidating(true);
    setTimeout(() => {
      try {
        const result = validateAllData();
        setValidation(result);
        setValidatedAt(Date.now());
        if (result.isValid) toast.success('✅ القيود والعلاقات سليمة');
        else toast.error(`❌ تم العثور على أخطاء: ${result.errors.length}`);
      } catch (e) {
        toast.error('❌ فشل فحص القيود: ' + (e as Error).message);
      } finally {
        setValidating(false);
      }
    }, 0);
  };

  const refreshLocalStorageList = () => {
    try {
      const keys = Array.from(new Set(Object.keys(localStorage))).filter(k => !HIDDEN_KEYS.has(k));
      const orderIndex = new Map<string, number>();
      KNOWN_ORDER.forEach((k, i) => orderIndex.set(k, i));

      const sorted = keys.sort((a, b) => {
        const ai = orderIndex.has(a) ? (orderIndex.get(a) as number) : Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.has(b) ? (orderIndex.get(b) as number) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
      });

      setTables(
        sorted.map(k => {
          const kind: 'db' | 'system' = k.startsWith('db_') ? 'db' : 'system';
          const name = FRIENDLY_NAMES[k] ?? (kind === 'db' ? `جدول: ${k}` : `مفتاح: ${k}`);
          const icon = kind === 'db' ? Table : Key;
          return { key: k, name, icon, kind };
        })
      );
    } catch {
      setTables([]);
    }
  };

  useEffect(() => {
    refreshLocalStorageList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('ar-EG');
    } catch {
      return '';
    }
  };

  const memoryIndexDiagnostics: IndexDiagnostic[] = useMemo(() => {
    // Force recompute when cache is rebuilt.
    void cacheTick;

    if (!DbCache.isInitialized) {
      return [
        {
          name: 'Cache / Dashboard Indexes',
          table: 'System',
          type: 'Not Initialized',
          status: 'Info',
          note: 'الكاش غير مبني بعد — اضغط “إعادة بناء الفهارس”',
        },
      ];
    }

    const peopleArr = getArray('db_people');
    const propertiesArr = getArray('db_properties');
    const contractsArr = getArray('db_contracts');
    const installmentsArr = getArray('db_installments');
    const usersArr = getArray('db_users');

    const peopleWithNationalId = peopleArr.filter(p => p['الرقم_الوطني']).length;
    const peopleWithPhone = peopleArr.filter(p => p['رقم_الهاتف']).length;
    const propertiesWithCode = propertiesArr.filter(p => p['الكود_الداخلي']).length;
    const usersWithUsername = usersArr.filter(u => u['اسم_المستخدم']).length;

    const missingOwners = propertiesArr.filter(p => {
      const ownerId = p['رقم_المالك'];
      return !!ownerId && !DbCache.people.has(String(ownerId));
    }).length;
    const missingContractProperty = contractsArr.filter(c => {
      const propertyId = c['رقم_العقار'];
      return !!propertyId && !DbCache.properties.has(String(propertyId));
    }).length;
    const missingContractTenant = contractsArr.filter(c => {
      const tenantId = c['رقم_المستاجر'];
      return !!tenantId && !DbCache.people.has(String(tenantId));
    }).length;
    const missingInstallmentContract = installmentsArr.filter(i => {
      const contractId = i['رقم_العقد'];
      return !!contractId && !DbCache.contracts.has(String(contractId));
    }).length;

    const pkPeopleOk = DbCache.people.size === peopleArr.length;
    const pkPropertiesOk = DbCache.properties.size === propertiesArr.length;
    const pkContractsOk = DbCache.contracts.size === contractsArr.length;
    const pkInstallmentsOk = DbCache.installments.size === installmentsArr.length;
    const pkUsersOk = DbCache.users.size === usersArr.length;

    const uqNationalOk = DbCache.ix_NationalId.size === peopleWithNationalId;
    const uqPhoneOk = DbCache.ix_PhoneNumber.size === peopleWithPhone;
    const uqPropCodeOk = DbCache.ix_PropertyInternalCode.size === propertiesWithCode;
    const uqUsernameOk = DbCache.ix_Username.size === usersWithUsername;

    const fkOwnerOk = missingOwners === 0;
    const fkContractPropOk = missingContractProperty === 0;
    const fkContractTenantOk = missingContractTenant === 0;
    const fkInstallmentContractOk = missingInstallmentContract === 0;

    const rows: IndexDiagnostic[] = [
      {
        name: 'PK_PersonID',
        table: 'People',
        type: `Primary Key (Map) • ${DbCache.people.size}/${peopleArr.length}`,
        status: pkPeopleOk ? 'Active' : 'Warning',
        note: pkPeopleOk ? undefined : 'تكرار/تضارب محتمل في رقم الشخص (يؤدي إلى overwrite في Map)',
      },
      {
        name: 'PK_PropertyID',
        table: 'Properties',
        type: `Primary Key (Map) • ${DbCache.properties.size}/${propertiesArr.length}`,
        status: pkPropertiesOk ? 'Active' : 'Warning',
        note: pkPropertiesOk ? undefined : 'تكرار/تضارب محتمل في رقم العقار',
      },
      {
        name: 'PK_ContractID',
        table: 'Contracts',
        type: `Primary Key (Map) • ${DbCache.contracts.size}/${contractsArr.length}`,
        status: pkContractsOk ? 'Active' : 'Warning',
        note: pkContractsOk ? undefined : 'تكرار/تضارب محتمل في رقم العقد',
      },
      {
        name: 'PK_InstallmentID',
        table: 'Installments',
        type: `Primary Key (Map) • ${DbCache.installments.size}/${installmentsArr.length}`,
        status: pkInstallmentsOk ? 'Active' : 'Warning',
        note: pkInstallmentsOk ? undefined : 'تكرار/تضارب محتمل في رقم الكمبيالة',
      },
      {
        name: 'PK_UserID',
        table: 'Users',
        type: `Primary Key (Map) • ${DbCache.users.size}/${usersArr.length}`,
        status: pkUsersOk ? 'Active' : 'Warning',
        note: pkUsersOk ? undefined : 'تكرار/تضارب محتمل في رقم المستخدم',
      },
      {
        name: 'IX_NationalID',
        table: 'People',
        type: `Unique (Set) • ${DbCache.ix_NationalId.size}/${peopleWithNationalId}`,
        status: uqNationalOk ? 'Active' : 'Warning',
        note: uqNationalOk ? undefined : 'تكرار في الرقم الوطني',
      },
      {
        name: 'IX_PhoneNumber',
        table: 'People',
        type: `Unique (Set) • ${DbCache.ix_PhoneNumber.size}/${peopleWithPhone}`,
        status: uqPhoneOk ? 'Active' : 'Warning',
        note: uqPhoneOk ? undefined : 'تكرار في رقم الهاتف',
      },
      {
        name: 'IX_PropertyCode',
        table: 'Properties',
        type: `Unique (Set) • ${DbCache.ix_PropertyInternalCode.size}/${propertiesWithCode}`,
        status: uqPropCodeOk ? 'Active' : 'Warning',
        note: uqPropCodeOk ? undefined : 'تكرار في الكود الداخلي للعقار',
      },
      {
        name: 'IX_Username',
        table: 'Users',
        type: `Unique (Set) • ${DbCache.ix_Username.size}/${usersWithUsername}`,
        status: uqUsernameOk ? 'Active' : 'Warning',
        note: uqUsernameOk ? undefined : 'تكرار في اسم المستخدم',
      },
      {
        name: 'FK_Property_Owner',
        table: 'Properties → People',
        type: `Foreign Key • Missing: ${missingOwners}`,
        status: fkOwnerOk ? 'Active' : 'Warning',
      },
      {
        name: 'FK_Contract_Property',
        table: 'Contracts → Properties',
        type: `Foreign Key • Missing: ${missingContractProperty}`,
        status: fkContractPropOk ? 'Active' : 'Warning',
      },
      {
        name: 'FK_Contract_Tenant',
        table: 'Contracts → People',
        type: `Foreign Key • Missing: ${missingContractTenant}`,
        status: fkContractTenantOk ? 'Active' : 'Warning',
      },
      {
        name: 'FK_Installment_Contract',
        table: 'Installments → Contracts',
        type: `Foreign Key • Missing: ${missingInstallmentContract}`,
        status: fkInstallmentContractOk ? 'Active' : 'Warning',
      },
      {
        name: 'Indexes By Status',
        table: 'Contracts/Properties/Installments',
        type: `Secondary (Map) • ${DbCache.contractsByStatus.size + DbCache.propertiesByStatus.size + DbCache.installmentsByStatus.size}`,
        status: 'Active',
        note: 'فهارس ثانوية لتجميع البيانات حسب الحالة',
      },
    ];

    return rows;
  }, [cacheTick]);

  const handleClearKey = async (key: string) => {
    const ok = await toast.confirm({
      title: 'تحذير',
      message: 'هل أنت متأكد من مسح جميع البيانات في هذا الجدول؟ لا يمكن التراجع.',
      confirmText: 'مسح',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (ok) {
      // Some tables have dependent data that should be cleared together.
      const keysToClear = [key];

      // Clearing sales listings should also clear offers/agreements derived from them.
      if (key === 'db_sales_listings') {
        keysToClear.push(
          'db_sales_offers',
          'db_sales_agreements',
          'db_external_commissions',
          'db_ownership_history'
        );
      }

      // Clearing agreements should also clear external commissions and ownership history.
      if (key === 'db_sales_agreements') {
        keysToClear.push('db_external_commissions', 'db_ownership_history');
      }

      // De-dupe
      const uniqueKeys = Array.from(new Set(keysToClear));
      for (const k of uniqueKeys) {
        if (k.startsWith('db_')) {
          await storage.setItem(k, '[]');
        } else {
          // For non-db keys, remove the key entirely (system/UI state).
          try {
            await storage.removeItem(k);
          } catch {
            // ignore
          }
          try {
            localStorage.removeItem(k);
          } catch {
            // ignore
          }
        }
      }

      buildCache();
      setCacheTick(t => t + 1);
      refreshLocalStorageList();
      toast.success('تم مسح البيانات');
    }
  };

  const getSize = (key: string) => {
    const data = localStorage.getItem(key);
    return data ? (data.length / 1024).toFixed(2) + ' KB' : '0 KB';
  };

  const getCount = (key: string): string => {
    const raw = localStorage.getItem(key);
    if (!raw) return '0';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return String(parsed.length);
      if (parsed && typeof parsed === 'object') return '1';
      return '1';
    } catch {
      return '1';
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
            <Database size={22} />
            مدير قواعد البيانات والفهارس
          </h2>
          <p className={DS.components.pageSubtitle}>إدارة الجداول، تحسين الأداء، والتحكم في القيود</p>
        </div>
        <Button
          onClick={handleRebuildIndexes}
          isLoading={rebuilding}
          rightIcon={<RefreshCw size={20} />}
        >
          إعادة بناء الفهارس
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Table Stats */}
        <div className="app-card">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 leading-snug flex-wrap">
              <HardDrive size={18} className="text-slate-500" /> جداول النظام (LocalStorage)
            </h3>
          </div>
          <div className="overflow-x-auto relative">
          <table className="min-w-[720px] w-full text-right text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className="p-4">الجدول</th>
                <th className="p-4">عدد السجلات</th>
                <th className="p-4">الحجم</th>
                <th className="p-4 sticky left-0 bg-slate-50 dark:bg-slate-900 text-center w-16">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {tables.map(t => (
                <tr key={t.key} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 font-medium">
                    <div className="flex items-start gap-2 min-w-0">
                      <t.icon size={16} className={t.kind === 'db' ? 'text-indigo-500 shrink-0' : 'text-orange-500 shrink-0'} />
                      <div className="min-w-0">
                        <div className="whitespace-normal break-words">{t.name}</div>
                        <span className="block text-xs text-slate-400 font-mono whitespace-normal break-all">({t.key})</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono">{getCount(t.key)}</td>
                  <td className="p-4 font-mono text-slate-500">{getSize(t.key)}</td>
                  <td className="p-4 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30 text-center">
                    <button 
                      onClick={() => handleClearKey(t.key)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" 
                      title="مسح البيانات"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Index Manager */}
        <div className="app-card">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Key size={18} className="text-orange-500" /> الفهارس والقيود (Memory Indexes)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleValidateConstraints}
                disabled={validating}
                className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded font-bold flex items-center gap-1 disabled:opacity-50"
                title="فحص القيود والعلاقات"
              >
                <ShieldCheck size={12} /> {validating ? 'جاري الفحص...' : 'فحص القيود'}
              </button>
              <span className={`text-xs px-2 py-1 rounded font-bold flex items-center gap-1 ${DbCache.isInitialized ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                 <CheckCircle size={12} /> {DbCache.isInitialized ? 'Optimization Active' : 'Needs Rebuild'}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>حالة الكاش: {DbCache.isInitialized ? 'مفعل' : 'غير مبني'}</span>
              <span>آخر تحديث: {DbCache.lastUpdated ? formatDateTime(DbCache.lastUpdated) : '—'}</span>
            </div>

            {memoryIndexDiagnostics.map((idx, i) => (
              <div key={i} className="flex justify-between items-center p-3 border border-gray-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${idx.type.includes('Primary') ? 'bg-indigo-100 text-indigo-600' : idx.type.includes('Secondary') ? 'bg-emerald-100 text-emerald-600' : idx.type.includes('Foreign') ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-600'}`}>
                    <Key size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-700 dark:text-white">{idx.name}</p>
                    <p className="text-xs text-slate-400">On: {idx.table}</p>
                    {idx.note ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{idx.note}</p> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1 border ${idx.status === 'Active' ? 'bg-green-50 text-green-700 border-green-100' : idx.status === 'Warning' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    <ShieldCheck size={12} /> {idx.status}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{idx.type}</span>
                </div>
              </div>
            ))}

            {validation ? (
              <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                    <ShieldCheck size={16} /> نتائج فحص القيود
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {validatedAt ? formatDateTime(validatedAt) : ''}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${validation.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {validation.isValid ? 'سليم' : 'يوجد مشاكل'}
                  </span>
                  <span>الأخطاء: <span className="font-mono">{validation.errors.length}</span></span>
                  <span>التحذيرات: <span className="font-mono">{validation.warnings.length}</span></span>
                </div>

                {(validation.errors.length > 0 || validation.warnings.length > 0) ? (
                  <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                    {validation.errors.map((msg, idx) => (
                      <div key={`e-${idx}`} className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
                        {msg}
                      </div>
                    ))}
                    {validation.warnings.map((msg, idx) => (
                      <div key={`w-${idx}`} className="text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg p-2">
                        {msg}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex items-center gap-3 text-sm text-indigo-700 dark:text-indigo-300 mt-4">
              <AlertTriangle size={20} />
              <p>نظام الكاش (Dashboard Cache) مفعل لتحسين سرعة استعلامات الواجهة الرئيسية.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};


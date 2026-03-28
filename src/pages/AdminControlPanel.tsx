import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import {
  العمليات_tbl,
  المستخدمين_tbl,
  RoleType,
  الأشخاص_tbl,
  صلاحيات_المستخدمين_tbl,
  BlacklistRecord,
} from '@/types';
import {
  Shield,
  Activity,
  Users,
  BarChart3,
  Search,
  CheckCircle,
  Lock,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  UserCheck,
  UserX,
  Smartphone,
  Globe,
  Settings,
  UserPlus,
  ChevronDown,
  Link,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useToast } from '@/context/ToastContext';
import { useSmartModal } from '@/context/ModalContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DS } from '@/constants/designSystem';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';
import { runReportSmart } from '@/services/reporting';
import { safeNumber } from '@/utils/safe';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { AppModal } from '@/components/ui/AppModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrencyJOD } from '@/utils/format';
import type { DashboardStats } from '@/services/dbCache';
import type { LucideIcon } from 'lucide-react';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { PaginationControls } from '@/components/shared/PaginationControls';

// --- SUB-COMPONENTS ---

type StatCardProps = {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
  color: string;
};

const StatCard = ({ title, value, sub, icon: Icon, color }: StatCardProps) => (
  <div className="app-card p-6 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800 dark:text-white">{value}</h3>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  </div>
);

// --- MAIN PAGE ---

export const AdminControlPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'activity' | 'users' | 'blacklist'>(
    'analytics'
  );
  const toast = useToast();
  const { openPanel } = useSmartModal();

  type NewUserForm = {
    اسم_المستخدم: string;
    اسم_للعرض: string;
    كلمة_المرور: string;
    الدور: RoleType;
    linkedPersonId: string;
  };

  const isDesktopFast =
    typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb?.domainGet;

  const fastPersonByIdRef = useRef<Map<string, الأشخاص_tbl>>(new Map());
  const [fastPersonCacheVersion, setFastPersonCacheVersion] = useState(0);

  // Data States
  const [analytics, setAnalytics] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<العمليات_tbl[]>([]);
  const [users, setUsers] = useState<المستخدمين_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]); // To link employees
  const [allPermissions, setAllPermissions] = useState<صلاحيات_المستخدمين_tbl[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistRecord[]>([]);

  // Filter States
  const [logFilter, setLogFilter] = useState({ user: '', action: '', date: '' });
  const [userSearch, setUserSearch] = useState('');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [showArchivedBlacklist, setShowArchivedBlacklist] = useState(false);

  const logsPageSize = useResponsivePageSize({
    base: 8,
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
  });
  const usersPageSize = useResponsivePageSize({ base: 6, sm: 8, md: 9, lg: 12, xl: 15, '2xl': 18 });

  const [logsPage, setLogsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  const filteredLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        (!logFilter.user || log.اسم_المستخدم.includes(logFilter.user)) &&
        (!logFilter.action || log.نوع_العملية.includes(logFilter.action)) &&
        (!logFilter.date || log.تاريخ_العملية.startsWith(logFilter.date))
    );
  }, [logs, logFilter]);

  useEffect(() => {
    setLogsPage(1);
  }, [logFilter.user, logFilter.action, logFilter.date, logsPageSize]);

  const logsPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredLogs.length || 0) / logsPageSize)),
    [filteredLogs.length, logsPageSize]
  );

  useEffect(() => {
    setLogsPage((p) => Math.min(Math.max(1, p), logsPageCount));
  }, [logsPageCount]);

  const visibleLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsPage, logsPageSize]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => u.اسم_المستخدم.includes(userSearch));
  }, [users, userSearch]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, usersPageSize]);

  const usersPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredUsers.length || 0) / usersPageSize)),
    [filteredUsers.length, usersPageSize]
  );

  useEffect(() => {
    setUsersPage((p) => Math.min(Math.max(1, p), usersPageCount));
  }, [usersPageCount]);

  const visibleUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return filteredUsers.slice(start, start + usersPageSize);
  }, [filteredUsers, usersPage, usersPageSize]);

  // User Edit Modal State
  const [editingUser, setEditingUser] = useState<المستخدمين_tbl | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]); // Array of codes

  const [employeeCommissionMonthKey, setEmployeeCommissionMonthKey] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [employeeCommissionSummary, setEmployeeCommissionSummary] = useState<{
    loading: boolean;
    error?: string;
    monthKey: string;
    countThisMonth: number;
    totalOfficeThisMonth: number;
    totalIntroThisMonth: number;
    totalEmployeeThisMonth: number;
    rentOfficeThisMonth: number;
    rentEmployeeThisMonth: number;
    saleOfficeThisMonth: number;
    saleEmployeeThisMonth: number;
    countAll: number;
    totalOfficeAll: number;
    totalIntroAll: number;
    totalEmployeeAll: number;
    rentOfficeAll: number;
    rentEmployeeAll: number;
    saleOfficeAll: number;
    saleEmployeeAll: number;
  } | null>(null);

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({
    اسم_المستخدم: '',
    اسم_للعرض: '',
    كلمة_المرور: '',
    الدور: 'Employee',
    linkedPersonId: '',
  });

  const dbSignal = useDbSignal();

  const loadData = useCallback(() => {
    if (activeTab === 'analytics') {
      setAnalytics(DbService.getAdminAnalytics());
    } else if (activeTab === 'activity') {
      setLogs(DbService.getLogs());
    } else if (activeTab === 'users') {
      setUsers(DbService.getSystemUsers());
      setPeople(isDesktopFast ? [] : DbService.getPeople());
      setAllPermissions(DbService.getPermissionDefinitions());
    } else if (activeTab === 'blacklist') {
      setBlacklist(DbService.getBlacklist());
      setPeople(isDesktopFast ? [] : DbService.getPeople());
    }
  }, [activeTab, isDesktopFast]);

  useEffect(() => {
    loadData();
  }, [dbSignal, loadData]);

  useEffect(() => {
    let alive = true;

    const toRecord = (value: unknown): Record<string, unknown> =>
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const toNumber = (value: unknown): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const currentMonthKey =
      String(employeeCommissionMonthKey || '').trim() || new Date().toISOString().slice(0, 7);
    const username = String(editingUser?.اسم_المستخدم || '').trim();

    if (!editingUser || !username) {
      setEmployeeCommissionSummary(null);
      return () => {
        alive = false;
      };
    }

    // When opening a new user, default the picker to current month.
    setEmployeeCommissionMonthKey((prev) => (prev ? prev : new Date().toISOString().slice(0, 7)));

    setEmployeeCommissionSummary({
      loading: true,
      monthKey: currentMonthKey,
      countThisMonth: 0,
      totalOfficeThisMonth: 0,
      totalIntroThisMonth: 0,
      totalEmployeeThisMonth: 0,
      rentOfficeThisMonth: 0,
      rentEmployeeThisMonth: 0,
      saleOfficeThisMonth: 0,
      saleEmployeeThisMonth: 0,
      countAll: 0,
      totalOfficeAll: 0,
      totalIntroAll: 0,
      totalEmployeeAll: 0,
      rentOfficeAll: 0,
      rentEmployeeAll: 0,
      saleOfficeAll: 0,
      saleEmployeeAll: 0,
    });

    (async () => {
      try {
        const report = await runReportSmart('employee_commissions');
        const rows = Array.isArray(report?.data) ? report.data : [];

        const userRows = rows.filter(
          (r) => String(toRecord(r)['employeeUsername'] ?? '').trim() === username
        );
        const monthRows = userRows.filter(
          (r) => String(toRecord(r)['date'] ?? '').slice(0, 7) === currentMonthKey
        );

        const byType = (arr: unknown[], type: string) =>
          arr.filter((r) => String(toRecord(r)['type'] ?? '').trim() === type);

        const sumOffice = (arr: unknown[]): number =>
          arr.map((r) => toNumber(toRecord(r)['officeCommission'])).reduce((s, n) => s + n, 0);
        const sumEmployee = (arr: unknown[]): number =>
          arr.map((r) => toNumber(toRecord(r)['employeeTotal'])).reduce((s, n) => s + n, 0);
        const sumIntro = (arr: unknown[]): number =>
          arr.map((r) => toNumber(toRecord(r)['intro'])).reduce((s, n) => s + n, 0);

        const monthRent = byType(monthRows, 'إيجار');
        const monthSale = byType(monthRows, 'بيع');
        const allRent = byType(userRows, 'إيجار');
        const allSale = byType(userRows, 'بيع');

        const next = {
          loading: false,
          monthKey: currentMonthKey,
          countThisMonth: monthRows.length,
          totalOfficeThisMonth: sumOffice(monthRows),
          totalIntroThisMonth: sumIntro(monthRows),
          totalEmployeeThisMonth: sumEmployee(monthRows),
          rentOfficeThisMonth: sumOffice(monthRent),
          rentEmployeeThisMonth: sumEmployee(monthRent),
          saleOfficeThisMonth: sumOffice(monthSale),
          saleEmployeeThisMonth: sumEmployee(monthSale),
          countAll: userRows.length,
          totalOfficeAll: sumOffice(userRows),
          totalIntroAll: sumIntro(userRows),
          totalEmployeeAll: sumEmployee(userRows),
          rentOfficeAll: sumOffice(allRent),
          rentEmployeeAll: sumEmployee(allRent),
          saleOfficeAll: sumOffice(allSale),
          saleEmployeeAll: sumEmployee(allSale),
        };

        if (!alive) return;
        setEmployeeCommissionSummary(next);
      } catch (e) {
        if (!alive) return;
        setEmployeeCommissionSummary({
          loading: false,
          error: (e as Error)?.message || 'فشل تحميل ملخص العمولات',
          monthKey: currentMonthKey,
          countThisMonth: 0,
          totalOfficeThisMonth: 0,
          totalIntroThisMonth: 0,
          totalEmployeeThisMonth: 0,
          rentOfficeThisMonth: 0,
          rentEmployeeThisMonth: 0,
          saleOfficeThisMonth: 0,
          saleEmployeeThisMonth: 0,
          countAll: 0,
          totalOfficeAll: 0,
          totalIntroAll: 0,
          totalEmployeeAll: 0,
          rentOfficeAll: 0,
          rentEmployeeAll: 0,
          saleOfficeAll: 0,
          saleEmployeeAll: 0,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [editingUser, employeeCommissionMonthKey]);

  // Desktop-fast: resolve linked/blacklist people names lazily via SQL
  useEffect(() => {
    if (!isDesktopFast) return;
    if (activeTab !== 'users' && activeTab !== 'blacklist') return;
    let alive = true;

    const run = async () => {
      const ids = new Set<string>();
      if (activeTab === 'users') {
        for (const u of users) {
          const pid = String(u.linkedPersonId || '').trim();
          if (pid) ids.add(pid);
        }
      }
      if (activeTab === 'blacklist') {
        for (const rec of blacklist) {
          const pid = String(rec.personId || '').trim();
          if (pid) ids.add(pid);
        }
      }

      const limited = Array.from(ids).slice(0, 300);
      let changed = false;

      for (const pid of limited) {
        if (!alive) return;
        if (fastPersonByIdRef.current.has(pid)) continue;
        try {
          const person = await domainGetSmart('people', pid);
          if (person) {
            fastPersonByIdRef.current.set(pid, person);
            changed = true;
          }
        } catch {
          // ignore
        }
      }

      if (alive && changed) setFastPersonCacheVersion((v) => v + 1);
    };

    void run();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, activeTab, users, blacklist]);

  // --- ACTIONS ---

  const handleToggleUserStatus = async (id: string, currentStatus: boolean) => {
    const ok = await toast.confirm({
      title: 'تأكيد',
      message: currentStatus ? 'هل تريد إيقاف هذا الحساب؟' : 'هل تريد تفعيل هذا الحساب؟',
      confirmText: 'تأكيد',
      cancelText: 'إلغاء',
      isDangerous: currentStatus,
    });
    if (!ok) return;
    DbService.updateUserStatus(id, !currentStatus);
    loadData();
    toast.success(currentStatus ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
  };

  const handleDeleteUser = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف مستخدم',
      message: 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    DbService.deleteSystemUser(id);
    loadData();
    toast.success('تم حذف المستخدم بنجاح');
  };

  const handleOpenEditUser = (user: المستخدمين_tbl) => {
    setEditingUser(user);
    // Load existing permissions for this user from DB (not legacy array)
    const perms = DbService.getUserPermissions(user.id);
    setTempPermissions(perms);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    // Save Role
    DbService.updateUserRole(editingUser.id, editingUser.الدور);

    // Save Permissions (New Relation Table)
    DbService.updateUserPermissions(editingUser.id, tempPermissions);

    toast.success('تم تحديث بيانات المستخدم وصلاحياته');
    setEditingUser(null);
    loadData();
  };

  const togglePermission = (code: string) => {
    setTempPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  // Add User Actions
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      DbService.addSystemUser(newUser);
      loadData();
      setIsAddUserModalOpen(false);
      setNewUser({
        اسم_المستخدم: '',
        اسم_للعرض: '',
        كلمة_المرور: '',
        الدور: 'Employee',
        linkedPersonId: '',
      });
      toast.success('تم إضافة المستخدم بنجاح');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast.error(msg);
    }
  };

  const getLinkedPersonName = (id?: string) => {
    if (!id) return null;
    if (isDesktopFast) {
      void fastPersonCacheVersion;
      const p = fastPersonByIdRef.current.get(String(id));
      return p ? p.الاسم : null;
    }
    const p = people.find((p) => p.رقم_الشخص === id);
    return p ? p.الاسم : null;
  };

  const getPersonById = (id?: string) => {
    if (!id) return null;
    if (isDesktopFast) {
      void fastPersonCacheVersion;
      return fastPersonByIdRef.current.get(String(id)) || null;
    }
    return people.find((p) => String(p.رقم_الشخص) === String(id)) || null;
  };

  // Blacklist Actions
  const handleLiftBan = async (id: string) => {
    const ok = await toast.confirm({
      title: 'تأكيد',
      message: 'هل تريد رفع الحظر عن هذا الشخص؟',
      confirmText: 'نعم',
      cancelText: 'إلغاء',
    });
    if (!ok) return;
    DbService.removeFromBlacklist(id);
    toast.success('تم رفع الحظر');
    loadData();
  };

  const handleEditBan = (recordId: string) => {
    openPanel('BLACKLIST_FORM', recordId, {
      mode: 'edit',
      onSuccess: () => loadData(),
    });
  };

  // --- RENDERERS ---

  const renderAnalytics = () => {
    if (!analytics) return <div>تحميل...</div>;

    const pieData = [
      { name: 'عقارات مؤجرة', value: analytics.occupiedProps, color: '#10b981' }, // green
      { name: 'عقارات شاغرة', value: analytics.vacantProps, color: '#3b82f6' }, // blue
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="العقود النشطة"
            value={safeNumber(analytics.activeContracts)}
            sub={`${safeNumber(analytics.expiredContracts)} منتهي`}
            icon={Shield}
            color="bg-indigo-500"
          />
          <StatCard
            title="إجمالي التحصيل"
            value={`${safeNumber(analytics.totalCollected).toLocaleString()} د.أ`}
            sub={`${safeNumber(analytics.totalDue).toLocaleString()} د.أ متأخرات`}
            icon={BarChart3}
            color="bg-emerald-500"
          />
          <StatCard
            title="المرفقات الشهرية"
            value={safeNumber(analytics.monthlyAttachments)}
            sub="ملفات تم رفعها هذا الشهر"
            icon={Download}
            color="bg-indigo-500"
          />
          <StatCard
            title="التنبيهات المفتوحة"
            value={safeNumber(analytics.openAlerts)}
            sub="تتطلب إجراء"
            icon={AlertTriangle}
            color="bg-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy Chart */}
          <div className="app-card p-6">
            <h3 className="font-bold text-slate-700 dark:text-white mb-4">توزيع العقارات</h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div> مؤجر (
                {analytics.occupiedProps})
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div> شاغر (
                {analytics.vacantProps})
              </div>
            </div>
          </div>

          {/* Top Debtors List */}
          <div className="app-card p-6">
            <h3 className="font-bold text-slate-700 dark:text-white mb-4">
              أعلى 10 مستأجرين تأخيراً
            </h3>
            <div className="overflow-y-auto max-h-64 space-y-3 custom-scrollbar">
              {analytics.topDebtors &&
                analytics.topDebtors.map((d, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600 w-6">{i + 1}.</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {d.name}
                      </span>
                    </div>
                    <span className="font-bold text-red-600">
                      {safeNumber(d.amount).toLocaleString()} د.أ
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <input
            placeholder="بحث بالموظف..."
            className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
            aria-label="بحث بالموظف"
            title="بحث بالموظف"
            value={logFilter.user}
            onChange={(e) => setLogFilter({ ...logFilter, user: e.target.value })}
          />
          <input
            placeholder="بحث بنوع الإجراء..."
            className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
            aria-label="بحث بنوع الإجراء"
            title="بحث بنوع الإجراء"
            value={logFilter.action}
            onChange={(e) => setLogFilter({ ...logFilter, action: e.target.value })}
          />
          <input
            type="date"
            className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
            aria-label="بحث بتاريخ العملية"
            title="بحث بتاريخ العملية"
            value={logFilter.date}
            onChange={(e) => setLogFilter({ ...logFilter, date: e.target.value })}
          />
        </div>

        {/* Table */}
        <div className="app-table-wrapper">
          <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3">
              إجمالي السجلات: {filteredLogs.length.toLocaleString()}
            </div>
            <PaginationControls
              page={logsPage}
              pageCount={logsPageCount}
              onPageChange={setLogsPage}
            />
          </div>
          <div className="max-h-[600px] overflow-auto no-scrollbar">
            <table className="app-table">
              <thead className="app-table-thead">
                <tr>
                  <th className="app-table-th">الموظف</th>
                  <th className="app-table-th">الإجراء</th>
                  <th className="app-table-th">التفاصيل</th>
                  <th className="app-table-th">الجهاز / IP</th>
                  <th className="app-table-th">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {visibleLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="app-table-empty">
                      لا توجد سجلات مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map((log) => (
                    <tr key={log.id} className="app-table-row app-table-row-striped group">
                      <td className="app-table-td font-black">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black shadow-sm group-hover:scale-110 transition-transform">
                            {log.اسم_المستخدم.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-700 dark:text-slate-200">
                            {log.اسم_المستخدم}
                          </span>
                        </div>
                      </td>
                      <td className="app-table-td">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                          {log.نوع_العملية}
                        </span>
                      </td>
                      <td className="app-table-td">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {log.اسم_الجدول} #{log.رقم_السجل}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                            {log.details}
                          </span>
                        </div>
                      </td>
                      <td className="app-table-td">
                        <div className="flex flex-col gap-1 text-[10px] font-medium text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Globe size={12} className="text-slate-300" /> {log.ipAddress}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Smartphone size={12} className="text-slate-300" /> {log.deviceInfo}
                          </span>
                        </div>
                      </td>
                      <td
                        className="app-table-td font-mono text-[10px] text-slate-500 font-bold"
                        dir="ltr"
                      >
                        {new Date(log.تاريخ_العملية).toLocaleString('ar-JO')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex justify-between items-center">
          <input
            placeholder="بحث عن مستخدم..."
            className="border p-2 rounded-xl text-sm w-64 bg-white dark:bg-slate-800 dark:border-slate-600 outline-none"
            aria-label="بحث عن مستخدم"
            title="بحث عن مستخدم"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <PaginationControls
            page={usersPage}
            pageCount={usersPageCount}
            onPageChange={setUsersPage}
          />
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 font-bold text-sm"
          >
            <UserPlus size={18} /> مستخدم جديد
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400">
          الإجمالي: {filteredUsers.length.toLocaleString()} مستخدم
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleUsers.map((user) => {
            const linkedName = getLinkedPersonName(user.linkedPersonId);
            return (
              <div
                key={user.id}
                className={`app-card p-6 flex flex-col gap-4 relative overflow-hidden transition hover:shadow-lg
                            ${user.isActive ? 'border-transparent shadow-sm' : 'border-red-100 dark:border-red-900/30 opacity-75'}
                        `}
              >
                {/* Status Badge */}
                <div className="absolute top-4 left-4">
                  <StatusBadge
                    status={user.isActive ? 'نشط' : 'معطل'}
                    className="!text-[10px] !px-2 !py-0.5 !border-0"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg
                                    ${user.الدور === 'SuperAdmin' ? 'bg-purple-600' : user.الدور === 'Admin' ? 'bg-indigo-600' : 'bg-slate-500'}
                                `}
                  >
                    {user.اسم_المستخدم.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                      {user.اسم_للعرض || user.اسم_المستخدم}
                    </h3>
                    {user.اسم_للعرض && (
                      <p
                        className="text-[11px] text-slate-500 dark:text-slate-400 font-bold"
                        dir="ltr"
                      >
                        @{user.اسم_المستخدم}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">{user.الدور}</p>
                    {linkedName && (
                      <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                        <Link size={10} /> {linkedName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-slate-700 pt-4 flex gap-2">
                  <button
                    onClick={() => handleOpenEditUser(user)}
                    className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} /> تعديل الصلاحيات
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                    className={`p-2 rounded-lg transition text-white ${user.isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
                    aria-label={user.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                    title={user.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                  >
                    {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 rounded-lg transition text-white bg-red-500 hover:bg-red-600"
                    aria-label="حذف الحساب"
                    title="حذف الحساب"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ADD USER MODAL */}
        <AppModal
          open={isAddUserModalOpen}
          title="إضافة مستخدم جديد"
          onClose={() => setIsAddUserModalOpen(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="add-user-form"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
              >
                حفظ
              </button>
            </div>
          }
        >
          <form id="add-user-form" onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                htmlFor="admin-add-user-username"
              >
                اسم المستخدم
              </label>
              <input
                id="admin-add-user-username"
                required
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newUser.اسم_المستخدم}
                onChange={(e) => setNewUser({ ...newUser, اسم_المستخدم: e.target.value })}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                htmlFor="admin-add-user-display-name"
              >
                الاسم للعرض (اختياري)
              </label>
              <input
                id="admin-add-user-display-name"
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newUser.اسم_للعرض || ''}
                onChange={(e) => setNewUser({ ...newUser, اسم_للعرض: e.target.value })}
                placeholder="مثال: أحمد محمد"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                سيظهر في الواجهة بدلاً من اسم المستخدم.
              </p>
            </div>
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                htmlFor="admin-add-user-password"
              >
                كلمة المرور
              </label>
              <input
                id="admin-add-user-password"
                required
                type="password"
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newUser.كلمة_المرور}
                onChange={(e) => setNewUser({ ...newUser, كلمة_المرور: e.target.value })}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                htmlFor="admin-add-user-role"
              >
                الصلاحية / الدور
              </label>
              <div className="relative">
                <select
                  id="admin-add-user-role"
                  className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                  value={newUser.الدور}
                  onChange={(e) => setNewUser({ ...newUser, الدور: e.target.value as RoleType })}
                >
                  <option value="Employee">موظف (صلاحيات محدودة)</option>
                  <option value="Admin">مدير النظام (صلاحيات كاملة)</option>
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Link to Person (Separation Feature) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                ربط بملف شخص (اختياري)
              </label>
              {isDesktopFast ? (
                <div className="space-y-2">
                  <PersonPicker
                    value={String(newUser.linkedPersonId || '')}
                    onChange={(personId) =>
                      setNewUser({ ...newUser, linkedPersonId: String(personId || '') })
                    }
                    placeholder="-- غير مرتبط --"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, linkedPersonId: '' })}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                    >
                      إزالة الربط
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                    aria-label="ربط بملف شخص"
                    title="ربط بملف شخص"
                    value={newUser.linkedPersonId}
                    onChange={(e) => setNewUser({ ...newUser, linkedPersonId: e.target.value })}
                  >
                    <option value="">-- غير مرتبط --</option>
                    {people.map((p) => (
                      <option key={p.رقم_الشخص} value={p.رقم_الشخص}>
                        {p.الاسم} ({p.رقم_نوع_الشخص})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400">
                    <Link size={16} />
                  </div>
                </div>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                يُستخدم لربط حساب الدخول ببيانات الموظف أو الشخص في النظام.
              </p>
            </div>
          </form>
        </AppModal>

        {/* EDIT USER MODAL */}
        <AppModal
          open={!!editingUser}
          title={
            editingUser ? (
              <>
                <Settings size={20} className="text-indigo-600" /> إدارة صلاحيات:{' '}
                {editingUser.اسم_المستخدم}
              </>
            ) : (
              'إدارة الصلاحيات'
            )
          }
          onClose={() => setEditingUser(null)}
          size="2xl"
          footer={
            editingUser ? (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-200 font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveUser}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition"
                >
                  حفظ التغييرات
                </button>
              </div>
            ) : null
          }
          bodyClassName="p-0"
        >
          {editingUser ? (
            <div className="p-6 space-y-6">
              {/* Employee Commissions Summary */}
              <div className="app-card p-5 rounded-2xl border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-800 dark:text-white truncate">
                      ملخص عمولات الموظف
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      شامل عمولة الوسيط الخارجي
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <label
                        className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                        htmlFor="admin-employee-commission-month"
                      >
                        الشهر
                      </label>
                      <input
                        id="admin-employee-commission-month"
                        type="date"
                        aria-label="اختيار الشهر"
                        title="اختيار الشهر (اختر أي يوم ضمن الشهر)"
                        value={employeeCommissionMonthKey ? `${employeeCommissionMonthKey}-01` : ''}
                        onChange={(e) =>
                          setEmployeeCommissionMonthKey(
                            e.target.value ? e.target.value.slice(0, 7) : ''
                          )
                        }
                        className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs"
                      />
                    </div>
                    <StatusBadge status="نشط" />
                  </div>
                </div>

                {employeeCommissionSummary?.loading ? (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    جارٍ التحميل…
                  </div>
                ) : employeeCommissionSummary?.error ? (
                  <div className="mt-4 text-sm text-red-600">{employeeCommissionSummary.error}</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          الشهر المحدد ({employeeCommissionSummary?.monthKey})
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                          عدد العمليات: {employeeCommissionSummary?.countThisMonth ?? 0}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          إجمالي عمولة الموظف
                        </div>
                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                          {formatCurrencyJOD(
                            employeeCommissionSummary?.totalEmployeeThisMonth ?? 0,
                            { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                          )}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          إجمالي العمولات (الأساس)
                        </div>
                        <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                          {formatCurrencyJOD(employeeCommissionSummary?.totalOfficeThisMonth ?? 0, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          تفصيل الشهر: إيجار
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white">
                            {formatCurrencyJOD(
                              employeeCommissionSummary?.rentOfficeThisMonth ?? 0,
                              { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCurrencyJOD(
                              employeeCommissionSummary?.rentEmployeeThisMonth ?? 0,
                              { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          تفصيل الشهر: بيع
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white">
                            {formatCurrencyJOD(
                              employeeCommissionSummary?.saleOfficeThisMonth ?? 0,
                              { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCurrencyJOD(
                              employeeCommissionSummary?.saleEmployeeThisMonth ?? 0,
                              { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          إجمالي العمليات (كل الفترة)
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                          {employeeCommissionSummary?.countAll ?? 0}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          عمولة الموظف (كل الفترة)
                        </div>
                        <div className="text-lg font-black text-amber-700 dark:text-amber-300">
                          {formatCurrencyJOD(employeeCommissionSummary?.totalEmployeeAll ?? 0, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          إدخال عقار (5%)
                        </div>
                        <div className="text-lg font-black text-purple-700 dark:text-purple-300">
                          {formatCurrencyJOD(employeeCommissionSummary?.totalIntroAll ?? 0, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-gray-50/60 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          كل الفترة: إيجار
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white">
                            {formatCurrencyJOD(employeeCommissionSummary?.rentOfficeAll ?? 0, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCurrencyJOD(employeeCommissionSummary?.rentEmployeeAll ?? 0, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50/60 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          كل الفترة: بيع
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white">
                            {formatCurrencyJOD(employeeCommissionSummary?.saleOfficeAll ?? 0, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCurrencyJOD(employeeCommissionSummary?.saleEmployeeAll ?? 0, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Role Selection */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">
                  الدور الوظيفي (المستوى الرئيسي)
                </label>
                <div className="flex gap-4">
                  {(['SuperAdmin', 'Admin', 'Employee'] as RoleType[]).map((role) => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={editingUser.الدور === role}
                        onChange={() => setEditingUser({ ...editingUser, الدور: role })}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-sm font-medium">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions Matrix */}
              <div>
                <h4 className="font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                  <Lock size={18} className="text-orange-500" /> تخصيص الصلاحيات الدقيقة
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {allPermissions.map((perm) => (
                    <label
                      key={perm.code}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition
                                                ${
                                                  tempPermissions.includes(perm.code)
                                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                                    : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600 opacity-70'
                                                }
                                            `}
                    >
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {perm.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={tempPermissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                        className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </AppModal>
      </div>
    );
  };

  const renderBlacklist = () => {
    const filtered = blacklist.filter((b) => {
      const person = getPersonById(b.personId);
      const name = String(person?.الاسم || '').toLowerCase();
      return name.includes(blacklistSearch.toLowerCase()) && (showArchivedBlacklist || b.isActive);
    });

    return (
      <RBACGuard
        requiredPermission="BLACKLIST_VIEW"
        fallback={<div className="p-8 text-center text-gray-400">ليس لديك صلاحية الوصول</div>}
      >
        <div className="animate-fade-in space-y-6">
          {/* Controls */}
          <div className="app-card p-4 rounded-xl flex justify-between items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="text-gray-400" size={20} />
              <input
                placeholder="بحث بالاسم..."
                className="bg-transparent outline-none flex-1 text-sm text-slate-700 dark:text-white"
                aria-label="بحث بالاسم"
                title="بحث بالاسم"
                value={blacklistSearch}
                onChange={(e) => setBlacklistSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={showArchivedBlacklist}
                  onChange={(e) => setShowArchivedBlacklist(e.target.checked)}
                />
                عرض الأرشيف
              </label>
            </div>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 gap-6">
            {filtered.length === 0 ? (
              <div className="app-table-empty border-2 border-dashed border-slate-200 dark:border-slate-800 bg-transparent">
                <ShieldAlert
                  size={64}
                  className="mx-auto mb-4 text-slate-200 dark:text-slate-800"
                />
                <p className="text-slate-400 font-black tracking-wide">
                  لا توجد سجلات مطابقة في القائمة السوداء
                </p>
              </div>
            ) : (
              filtered.map((rec) => {
                const person = getPersonById(rec.personId);
                return (
                  <div
                    key={rec.id}
                    className={`app-card p-8 border-r-8 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl
                                      ${rec.isActive ? 'border-r-rose-500 shadow-rose-500/5' : 'border-r-slate-300 dark:border-r-slate-700 opacity-60'}
                                  `}
                  >
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div
                        className={`p-4 rounded-[1.5rem] flex-shrink-0 shadow-lg ${rec.isActive ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-rose-500/10' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-none'}`}
                      >
                        {rec.isActive ? <Ban size={32} /> : <CheckCircle size={32} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-xl font-black text-slate-800 dark:text-white truncate max-w-[300px]">
                            {person?.الاسم || 'شخص محذوف'}
                          </h3>
                          {!rec.isActive && (
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700 uppercase tracking-tight">
                              تم رفع الحظر
                            </span>
                          )}
                          <StatusBadge
                            status={rec.severity}
                            className="!text-[10px] !px-3 !py-1 !font-black !rounded-xl"
                          />
                        </div>

                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-4">
                          <div className="flex items-center gap-1.5">
                            <Activity size={14} className="text-slate-300" />{' '}
                            {new Date(rec.dateAdded).toLocaleDateString('ar-JO')}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <UserPlus size={14} className="text-slate-300" /> بواسطة {rec.addedBy}
                          </div>
                        </div>

                        <div className="relative group">
                          <div className="absolute -right-3 top-0 bottom-0 w-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pr-4 font-medium italic">
                            "{rec.reason}"
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {rec.isActive && (
                        <div className="flex md:flex-col gap-3 w-full md:w-auto mt-4 md:mt-0">
                          <RBACGuard requiredPermission="BLACKLIST_REMOVE">
                            <button
                              onClick={() => handleLiftBan(rec.id)}
                              className="flex-1 md:w-32 py-3 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all shadow-sm active:scale-95"
                            >
                              رفع الحظر
                            </button>
                          </RBACGuard>
                          <RBACGuard requiredPermission="BLACKLIST_ADD">
                            <button
                              onClick={() => handleEditBan(rec.id)}
                              className="flex-1 md:w-32 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 rounded-2xl text-xs font-black hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm active:scale-95"
                            >
                              تعديل
                            </button>
                          </RBACGuard>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </RBACGuard>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex justify-between items-center shadow-sm z-10">
        <div>
          <div className={DS.components.pageHeader}>
            <div>
              <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
                <Shield size={22} className="text-indigo-600" />
                لوحة التحكم المركزية
              </h2>
              <p className={DS.components.pageSubtitle}>
                إدارة المستخدمين، الصلاحيات، ومراقبة النظام
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 flex gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'analytics' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          <BarChart3 size={18} /> التحليلات
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'activity' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          <Activity size={18} /> سجل النشاط
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          <Users size={18} /> المستخدمين والصلاحيات
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'blacklist' ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          <ShieldAlert size={18} /> القائمة السوداء
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'activity' && renderActivity()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'blacklist' && renderBlacklist()}
      </div>
    </div>
  );
};

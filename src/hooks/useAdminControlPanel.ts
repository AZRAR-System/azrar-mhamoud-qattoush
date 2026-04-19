import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import {
  المستخدمين_tbl,
  RoleType,
  الأشخاص_tbl,
  صلاحيات_المستخدمين_tbl,
  BlacklistRecord,
} from '@/types';
import { auditLog, type AuditLogRecord } from '@/services/auditLog';
import { exportToXlsx } from '@/utils/xlsx';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSmartModal } from '@/context/ModalContext';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';
import { runReportSmart } from '@/services/reporting';
import type { DashboardStats } from '@/services/dbCache';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';

export type AdminTabKey = 'analytics' | 'activity' | 'users' | 'blacklist';

export type NewUserForm = {
  اسم_المستخدم: string;
  اسم_للعرض: string;
  كلمة_المرور: string;
  الدور: RoleType;
  linkedPersonId: string;
};

export type EmployeeCommissionSummary = {
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
};

export const useAdminControlPanel = (isVisible: boolean) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const dbSignal = useDbSignal();

  const [activeTab, setActiveTab] = useState<AdminTabKey>('analytics');

  const isDesktopFast =
    typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb?.domainGet;

  const fastPersonByIdRef = useRef<Map<string, الأشخاص_tbl>>(new Map());
  const [fastPersonCacheVersion, setFastPersonCacheVersion] = useState(0);

  // Data States
  const [analytics, setAnalytics] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [users, setUsers] = useState<المستخدمين_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [allPermissions, setAllPermissions] = useState<صلاحيات_المستخدمين_tbl[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistRecord[]>([]);

  // Filter States
  const [logFilter, setLogFilter] = useState({ 
    user: '', 
    action: '', 
    dateFrom: '', 
    dateTo: '' 
  });
  const [userSearch, setUserSearch] = useState('');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [showArchivedBlacklist, setShowArchivedBlacklist] = useState(false);

  // Pagination
  const logsPageSize = useResponsivePageSize({
    base: 8, sm: 10, md: 12, lg: 16, xl: 20, '2xl': 24,
  });
  const usersPageSize = useResponsivePageSize({
    base: 6, sm: 8, md: 9, lg: 12, xl: 15, '2xl': 18,
  });

  const [logsPage, setLogsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  // User Modals State
  const [editingUser, setEditingUser] = useState<المستخدمين_tbl | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({
    اسم_المستخدم: '',
    اسم_للعرض: '',
    كلمة_المرور: '',
    الدور: 'Employee',
    linkedPersonId: '',
  });

  // Commissions State
  const [employeeCommissionMonthKey, setEmployeeCommissionMonthKey] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [employeeCommissionSummary, setEmployeeCommissionSummary] = useState<EmployeeCommissionSummary | null>(null);

  // --- Auth Guard ---
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    if (role !== 'superadmin' && role !== 'admin') navigate('/');
  }, [isAuthenticated, user, navigate]);

  // --- Data Loading ---
  const loadData = useCallback(() => {
    if (activeTab === 'analytics') {
      setAnalytics(DbService.getAdminAnalytics());
    } else if (activeTab === 'activity') {
      setLogs(auditLog.getAll());
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
    if (isVisible) loadData();
  }, [dbSignal, loadData, isVisible]);

  // --- Search & Filters ---
  const filteredLogs = useMemo(() => {
    return logs.filter((log: AuditLogRecord) => {
      const r = log;
      if (logFilter.user && r.userName !== logFilter.user) return false;
      if (logFilter.action && r.action !== logFilter.action) return false;
      const day = r.timestamp?.slice(0, 10);
      if (logFilter.dateFrom && day < logFilter.dateFrom) return false;
      if (logFilter.dateTo && day > logFilter.dateTo) return false;
      return true;
    });
  }, [logs, logFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => u.اسم_المستخدم.includes(userSearch));
  }, [users, userSearch]);

  const logsPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredLogs.length || 0) / logsPageSize)),
    [filteredLogs.length, logsPageSize]
  );

  const usersPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredUsers.length || 0) / usersPageSize)),
    [filteredUsers.length, usersPageSize]
  );

  useEffect(() => { setLogsPage(1); }, [logFilter, logsPageSize]);
  useEffect(() => { setLogsPage((p) => Math.min(Math.max(1, p), logsPageCount)); }, [logsPageCount]);
  useEffect(() => { setUsersPage(1); }, [userSearch, usersPageSize]);
  useEffect(() => { setUsersPage((p) => Math.min(Math.max(1, p), usersPageCount)); }, [usersPageCount]);

  const visibleLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsPage, logsPageSize]);

  const visibleUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return filteredUsers.slice(start, start + usersPageSize);
  }, [filteredUsers, usersPage, usersPageSize]);

  // --- Commission Sync ---
  useEffect(() => {
    let alive = true;
    const toRecord = (value: unknown): Record<string, unknown> =>
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const toNumber = (value: unknown): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const currentMonthKey = String(employeeCommissionMonthKey || '').trim() || new Date().toISOString().slice(0, 7);
    const username = String(editingUser?.اسم_المستخدم || '').trim();

    if (!editingUser || !username) {
      setEmployeeCommissionSummary(null);
      return () => { alive = false; };
    }

    setEmployeeCommissionSummary(prev => ({
      ...(prev || {
        countThisMonth: 0, totalOfficeThisMonth: 0, totalIntroThisMonth: 0, totalEmployeeThisMonth: 0,
        rentOfficeThisMonth: 0, rentEmployeeThisMonth: 0, saleOfficeThisMonth: 0, saleEmployeeThisMonth: 0,
        countAll: 0, totalOfficeAll: 0, totalIntroAll: 0, totalEmployeeAll: 0,
        rentOfficeAll: 0, rentEmployeeAll: 0, saleOfficeAll: 0, saleEmployeeAll: 0,
      }),
      loading: true,
      monthKey: currentMonthKey,
    }));

    (async () => {
      try {
        const report = await runReportSmart('employee_commissions');
        const rows = Array.isArray(report?.data) ? report.data : [];
        const userRows = rows.filter((r) => String(toRecord(r)['employeeUsername'] ?? '').trim() === username);
        const monthRows = userRows.filter((r) => String(toRecord(r)['date'] ?? '').slice(0, 7) === currentMonthKey);

        const byType = (arr: unknown[], type: string) => arr.filter((r) => String(toRecord(r)['type'] ?? '').trim() === type);
        const sumOffice = (arr: unknown[]): number => arr.map((r) => toNumber(toRecord(r)['officeCommission'])).reduce((s, n) => s + n, 0);
        const sumEmployee = (arr: unknown[]): number => arr.map((r) => toNumber(toRecord(r)['employeeTotal'])).reduce((s, n) => s + n, 0);
        const sumIntro = (arr: unknown[]): number => arr.map((r) => toNumber(toRecord(r)['intro'])).reduce((s, n) => s + n, 0);

        const next: EmployeeCommissionSummary = {
          loading: false,
          monthKey: currentMonthKey,
          countThisMonth: monthRows.length,
          totalOfficeThisMonth: sumOffice(monthRows),
          totalIntroThisMonth: sumIntro(monthRows),
          totalEmployeeThisMonth: sumEmployee(monthRows),
          rentOfficeThisMonth: sumOffice(byType(monthRows, 'إيجار')),
          rentEmployeeThisMonth: sumEmployee(byType(monthRows, 'إيجار')),
          saleOfficeThisMonth: sumOffice(byType(monthRows, 'بيع')),
          saleEmployeeThisMonth: sumEmployee(byType(monthRows, 'بيع')),
          countAll: userRows.length,
          totalOfficeAll: sumOffice(userRows),
          totalIntroAll: sumIntro(userRows),
          totalEmployeeAll: sumEmployee(userRows),
          rentOfficeAll: sumOffice(byType(userRows, 'إيجار')),
          rentEmployeeAll: sumEmployee(byType(userRows, 'إيجار')),
          saleOfficeAll: sumOffice(byType(userRows, 'بيع')),
          saleEmployeeAll: sumEmployee(byType(userRows, 'بيع')),
        };
        if (!alive) return;
        setEmployeeCommissionSummary(next);
      } catch (_e) {
        if (!alive) return;
        setEmployeeCommissionSummary({
          loading: false, error: (_e as Error)?.message || 'فشل تحميل ملخص العمولات',
          monthKey: currentMonthKey,
          countThisMonth: 0, totalOfficeThisMonth: 0, totalIntroThisMonth: 0, totalEmployeeThisMonth: 0,
          rentOfficeThisMonth: 0, rentEmployeeThisMonth: 0, saleOfficeThisMonth: 0, saleEmployeeThisMonth: 0,
          countAll: 0, totalOfficeAll: 0, totalIntroAll: 0, totalEmployeeAll: 0,
          rentOfficeAll: 0, rentEmployeeAll: 0, saleOfficeAll: 0, saleEmployeeAll: 0,
        });
      }
    })();
    return () => { alive = false; };
  }, [editingUser, employeeCommissionMonthKey]);

  // --- Desktop Lazy Resolution ---
  useEffect(() => {
    if (!isDesktopFast || !isVisible) return;
    if (activeTab !== 'users' && activeTab !== 'blacklist') return;
    let alive = true;
    (async () => {
      const ids = new Set<string>();
      if (activeTab === 'users') users.forEach(u => u.linkedPersonId && ids.add(u.linkedPersonId));
      if (activeTab === 'blacklist') blacklist.forEach(rec => rec.personId && ids.add(rec.personId));
      const limited = Array.from(ids).slice(0, 300);
      let changed = false;
      for (const pid of limited) {
        if (!alive) return;
        if (fastPersonByIdRef.current.has(pid)) continue;
        try {
          const person = await domainGetSmart('people', pid);
          if (person) { fastPersonByIdRef.current.set(pid, person); changed = true; }
        } catch { /* ignore */ }
      }
      if (alive && changed) setFastPersonCacheVersion((v) => v + 1);
    })();
    return () => { alive = false; };
  }, [isDesktopFast, activeTab, users, blacklist, isVisible]);

  // --- Handlers ---
  const handleExportLogs = useCallback(() => {
    const data = filteredLogs.map((r) => ({
      id: r.id, userName: r.userName, action: r.action, entity: r.entity,
      entityId: r.entityId ?? '', details: r.details ?? '', timestamp: r.timestamp, ip: r.ip ?? '',
    }));
    void exportToXlsx('سجل_التدقيق', [
      { key: 'timestamp', header: 'الوقت' }, { key: 'userName', header: 'المستخدم' }, { key: 'action', header: 'الإجراء' },
      { key: 'entity', header: 'الكيان' }, { key: 'entityId', header: 'معرف السجل' }, { key: 'details', header: 'التفاصيل' }, { key: 'ip', header: 'IP' },
    ], data as Record<string, unknown>[], `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredLogs]);

  const handleToggleUserStatus = async (id: string, currentStatus: boolean) => {
    const ok = await toast.confirm({
      title: 'تأكيد', message: currentStatus ? 'هل تريد إيقاف هذا الحساب؟' : 'هل تريد تفعيل هذا الحساب؟',
      confirmText: 'تأكيد', cancelText: 'إلغاء', isDangerous: currentStatus,
    });
    if (!ok) return;
    DbService.updateUserStatus(id, !currentStatus);
    loadData();
    toast.success(currentStatus ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
  };

  const handleDeleteUser = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف مستخدم', message: 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.',
      confirmText: 'حذف', cancelText: 'إلغاء', isDangerous: true,
    });
    if (!ok) return;
    DbService.deleteSystemUser(id);
    loadData();
    toast.success('تم حذف المستخدم بنجاح');
  };

  const handleOpenEditUser = (user: المستخدمين_tbl) => {
    setEditingUser(user);
    setTempPermissions(DbService.getUserPermissions(user.id));
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    DbService.updateUserRole(editingUser.id, editingUser.الدور);
    DbService.updateUserPermissions(editingUser.id, tempPermissions);
    toast.success('تم تحديث بيانات المستخدم وصلاحياته');
    setEditingUser(null);
    loadData();
  };

  const togglePermission = (code: string) => {
    setTempPermissions((prev) => prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      DbService.addSystemUser(newUser);
      loadData();
      setIsAddUserModalOpen(false);
      setNewUser({ اسم_المستخدم: '', اسم_للعرض: '', كلمة_المرور: '', الدور: 'Employee', linkedPersonId: '' });
      toast.success('تم إضافة المستخدم بنجاح');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    }
  };

  const getPersonById = useCallback((id?: string) => {
    if (!id) return null;
    if (isDesktopFast) {
      void fastPersonCacheVersion;
      return fastPersonByIdRef.current.get(String(id)) || null;
    }
    return people.find((p) => String(p.رقم_الشخص) === String(id)) || null;
  }, [isDesktopFast, fastPersonCacheVersion, people]);

  const getLinkedPersonName = useCallback((id?: string) => {
    const p = getPersonById(id);
    return p ? p.الاسم : null;
  }, [getPersonById]);

  const handleLiftBan = async (id: string) => {
    const ok = await toast.confirm({ title: 'تأكيد', message: 'هل تريد رفع الحظر عن هذا الشخص؟', confirmText: 'نعم', cancelText: 'إلغاء' });
    if (!ok) return;
    DbService.removeFromBlacklist(id);
    toast.success('تم رفع الحظر');
    loadData();
  };

  const handleEditBan = (recordId: string) => {
    openPanel('BLACKLIST_FORM', recordId, { mode: 'edit', onSuccess: () => loadData() });
  };

  return {
    user, navigate, toast, openPanel, activeTab, setActiveTab, isDesktopFast,
    analytics, logs, users, people, allPermissions, blacklist,
    logFilter, setLogFilter, userSearch, setUserSearch, blacklistSearch, setBlacklistSearch, showArchivedBlacklist, setShowArchivedBlacklist,
    logsPage, setLogsPage, usersPage, setUsersPage, logsPageCount, usersPageCount, visibleLogs, visibleUsers,
    editingUser, setEditingUser, tempPermissions, setTempPermissions, isAddUserModalOpen, setIsAddUserModalOpen, newUser, setNewUser,
    employeeCommissionMonthKey, setEmployeeCommissionMonthKey, employeeCommissionSummary,
    loadData, handleExportLogs, handleToggleUserStatus, handleDeleteUser, handleOpenEditUser, handleSaveUser, togglePermission, handleAddUser,
    getPersonById, getLinkedPersonName, handleLiftBan, handleEditBan,
    filteredLogs, filteredUsers,
  };
};

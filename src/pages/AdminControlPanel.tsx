import React, { useMemo, useRef, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { العمليات_tbl, المستخدمين_tbl, RoleType, الأشخاص_tbl, صلاحيات_المستخدمين_tbl, BlacklistRecord } from '@/types';
import {
  Shield,
  Activity,
  Users,
  BarChart3,
  Search,
  CheckCircle,
  XCircle,
  Lock,
  Edit2,
  Trash2,
  Filter,
  Download,
  AlertTriangle,
  UserCheck,
  UserX,
  Smartphone,
  Globe,
  Settings,
  UserPlus,
  Key,
  ChevronDown,
  Link,
  ShieldAlert,
  Ban
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import { useToast } from '@/context/ToastContext';
import { useSmartModal } from '@/context/ModalContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DS } from '@/constants/designSystem';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';
import { PersonPicker } from '@/components/shared/PersonPicker';

// --- SUB-COMPONENTS ---

const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
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
  const [activeTab, setActiveTab] = useState<'analytics' | 'activity' | 'users' | 'blacklist'>('analytics');
  const toast = useToast();
  const { openPanel } = useSmartModal();

    const isDesktopFast =
        typeof window !== 'undefined' && storage.isDesktop() && !!(window as any)?.desktopDb?.domainGet;

    const fastPersonByIdRef = useRef<Map<string, any>>(new Map());
    const [fastPersonCacheVersion, setFastPersonCacheVersion] = useState(0);

  // Data States
  const [analytics, setAnalytics] = useState<any>(null);
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

  // User Edit Modal State
  const [editingUser, setEditingUser] = useState<المستخدمين_tbl | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]); // Array of codes

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ اسم_المستخدم: '', اسم_للعرض: '', كلمة_المرور: '', الدور: 'Employee' as RoleType, linkedPersonId: '' });

    const dbSignal = useDbSignal();

  useEffect(() => {
    loadData();
    }, [activeTab, dbSignal]);

  const loadData = () => {
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
  };

    // Desktop-fast: resolve linked/blacklist people names lazily via SQL
    useEffect(() => {
        if (!isDesktopFast) return;
        if (activeTab !== 'users' && activeTab !== 'blacklist') return;
        let alive = true;

        const run = async () => {
            const ids = new Set<string>();
            if (activeTab === 'users') {
                for (const u of users as any[]) {
                    const pid = String((u as any)?.linkedPersonId || '').trim();
                    if (pid) ids.add(pid);
                }
            }
            if (activeTab === 'blacklist') {
                for (const rec of blacklist as any[]) {
                    const pid = String((rec as any)?.personId || '').trim();
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
    setTempPermissions(prev => 
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  // Add User Actions
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      DbService.addSystemUser(newUser);
      loadData();
      setIsAddUserModalOpen(false);
            setNewUser({ اسم_المستخدم: '', اسم_للعرض: '', كلمة_المرور: '', الدور: 'Employee', linkedPersonId: '' });
      toast.success('تم إضافة المستخدم بنجاح');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getLinkedPersonName = (id?: string) => {
      if(!id) return null;
            if (isDesktopFast) {
                void fastPersonCacheVersion;
                const p = fastPersonByIdRef.current.get(String(id));
                return p ? p.الاسم : null;
            }
            const p = people.find(p => p.رقم_الشخص === id);
            return p ? p.الاسم : null;
  }

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
          onSuccess: () => loadData()
      });
  };

  // --- RENDERERS ---

  const renderAnalytics = () => {
    if (!analytics) return <div>تحميل...</div>;
    
    const pieData = [
        { name: 'عقارات مؤجرة', value: analytics.occupiedProps, color: '#10b981' }, // green
        { name: 'عقارات شاغرة', value: analytics.vacantProps, color: '#3b82f6' }   // blue
    ];

    const safeNum = (n: any) => Number(n) || 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="العقود النشطة" 
                    value={safeNum(analytics.activeContracts)} 
                    sub={`${safeNum(analytics.expiredContracts)} منتهي`}
                    icon={Shield} 
                    color="bg-indigo-500" 
                />
                <StatCard 
                    title="إجمالي التحصيل" 
                    value={`${safeNum(analytics.totalCollected).toLocaleString()} د.أ`}
                    sub={`${safeNum(analytics.totalDue).toLocaleString()} د.أ متأخرات`}
                    icon={BarChart3} 
                    color="bg-emerald-500" 
                />
                <StatCard 
                    title="المرفقات الشهرية" 
                    value={safeNum(analytics.monthlyAttachments)}
                    sub="ملفات تم رفعها هذا الشهر"
                    icon={Download} 
                    color="bg-indigo-500" 
                />
                <StatCard 
                    title="التنبيهات المفتوحة" 
                    value={safeNum(analytics.openAlerts)}
                    sub="تتطلب إجراء"
                    icon={AlertTriangle} 
                    color="bg-amber-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupancy Chart */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-white mb-4">توزيع العقارات</h3>
                    <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <ChartTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> مؤجر ({analytics.occupiedProps})</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-full"></div> شاغر ({analytics.vacantProps})</div>
                    </div>
                </div>

                {/* Top Debtors List */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-white mb-4">أعلى 10 مستأجرين تأخيراً</h3>
                    <div className="overflow-y-auto max-h-64 space-y-3 custom-scrollbar">
                        {analytics.topDebtors && analytics.topDebtors.map((d: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600 w-6">{i + 1}.</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                                </div>
                                <span className="font-bold text-red-600">{safeNum(d.amount).toLocaleString()} د.أ</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderActivity = () => {
    const filteredLogs = logs.filter(log => 
        (!logFilter.user || log.اسم_المستخدم.includes(logFilter.user)) &&
        (!logFilter.action || log.نوع_العملية.includes(logFilter.action)) &&
        (!logFilter.date || log.تاريخ_العملية.startsWith(logFilter.date))
    );

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <input 
                    placeholder="بحث بالموظف..." 
                    className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
                    value={logFilter.user} onChange={e => setLogFilter({...logFilter, user: e.target.value})}
                />
                <input 
                    placeholder="بحث بنوع الإجراء..." 
                    className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
                    value={logFilter.action} onChange={e => setLogFilter({...logFilter, action: e.target.value})}
                />
                <input 
                    type="date"
                    className="border p-2 rounded-lg text-sm bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
                    value={logFilter.date} onChange={e => setLogFilter({...logFilter, date: e.target.value})}
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold">
                        <tr>
                            <th className="p-4">الموظف</th>
                            <th className="p-4">الإجراء</th>
                            <th className="p-4">التفاصيل</th>
                            <th className="p-4">الجهاز / IP</th>
                            <th className="p-4">التوقيت</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                <td className="p-4 font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                                        {log.اسم_المستخدم.charAt(0)}
                                    </div>
                                    {log.اسم_المستخدم}
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs font-bold border border-gray-200 dark:border-slate-600">
                                        {log.نوع_العملية}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500">
                                    {log.اسم_الجدول} #{log.رقم_السجل} <span className="text-xs text-gray-400">{log.details}</span>
                                </td>
                                <td className="p-4 text-xs text-slate-400">
                                    <div className="flex flex-col gap-1">
                                        <span className="flex items-center gap-1"><Globe size={10}/> {log.ipAddress}</span>
                                        <span className="flex items-center gap-1"><Smartphone size={10}/> {log.deviceInfo}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-500" dir="ltr">
                                    {new Date(log.تاريخ_العملية).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                    value={userSearch} onChange={e => setUserSearch(e.target.value)}
                />
                <button 
                    onClick={() => setIsAddUserModalOpen(true)} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 font-bold text-sm"
                >
                    <UserPlus size={18} /> مستخدم جديد
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.filter(u => u.اسم_المستخدم.includes(userSearch)).map(user => {
                    const linkedName = getLinkedPersonName(user.linkedPersonId);
                    return (
                        <div key={user.id} className={`bg-white dark:bg-slate-800 rounded-2xl border-2 p-6 flex flex-col gap-4 relative overflow-hidden transition hover:shadow-lg
                            ${user.isActive ? 'border-transparent shadow-sm' : 'border-red-100 dark:border-red-900/30 opacity-75'}
                        `}>
                            {/* Status Badge */}
                            <div className={`absolute top-4 left-4 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1
                                ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                            `}>
                                {user.isActive ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                                {user.isActive ? 'نشط' : 'معطل'}
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg
                                    ${user.الدور === 'SuperAdmin' ? 'bg-purple-600' : user.الدور === 'Admin' ? 'bg-indigo-600' : 'bg-slate-500'}
                                `}>
                                    {user.اسم_المستخدم.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{user.اسم_للعرض || user.اسم_المستخدم}</h3>
                                    {user.اسم_للعرض && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold" dir="ltr">@{user.اسم_المستخدم}</p>
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
                                    title={user.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                                >
                                    {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                                </button>
                                <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 rounded-lg transition text-white bg-red-500 hover:bg-red-600"
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
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-up border border-gray-200 dark:border-slate-700">
                        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">إضافة مستخدم جديد</h3>
                            <button
                                onClick={() => setIsAddUserModalOpen(false)}
                                className="p-2 rounded-lg text-slate-500 hover:bg-black/10 hover:text-slate-700 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white transition"
                                title="إغلاق"
                                aria-label="إغلاق"
                            >
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">اسم المستخدم</label>
                                <input required className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={newUser.اسم_المستخدم} onChange={e => setNewUser({...newUser, اسم_المستخدم: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الاسم للعرض (اختياري)</label>
                                <input className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={String((newUser as any).اسم_للعرض || '')} onChange={e => setNewUser({...newUser, اسم_للعرض: e.target.value})} placeholder="مثال: أحمد محمد" />
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">سيظهر في الواجهة بدلاً من اسم المستخدم.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">كلمة المرور</label>
                                <input required type="password" className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={newUser.كلمة_المرور} onChange={e => setNewUser({...newUser, كلمة_المرور: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الصلاحية / الدور</label>
                                <div className="relative">
                                    <select className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                        value={newUser.الدور} onChange={e => setNewUser({...newUser, الدور: e.target.value as RoleType})}>
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
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ربط بملف شخص (اختياري)</label>
                                                                {isDesktopFast ? (
                                                                    <div className="space-y-2">
                                                                        <PersonPicker
                                                                            value={String(newUser.linkedPersonId || '')}
                                                                            onChange={(personId) => setNewUser({ ...newUser, linkedPersonId: String(personId || '') })}
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
                                                                            <select className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                                                                    value={newUser.linkedPersonId} onChange={e => setNewUser({...newUser, linkedPersonId: e.target.value})}>
                                                                                    <option value="">-- غير مرتبط --</option>
                                                                                    {people.map(p => (
                                                                                            <option key={p.رقم_الشخص} value={p.رقم_الشخص}>{p.الاسم} ({p.رقم_نوع_الشخص})</option>
                                                                                    ))}
                                                                            </select>
                                                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400">
                                                                                    <Link size={16} />
                                                                            </div>
                                                                    </div>
                                                                )}
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">يُستخدم لربط حساب الدخول ببيانات الموظف أو الشخص في النظام.</p>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">إلغاء</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">حفظ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL */}
            {editingUser && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-up">
                        <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings size={24} className="text-indigo-600"/> إدارة صلاحيات: {editingUser.اسم_المستخدم}
                            </h3>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-red-600 transition"
                                title="إغلاق"
                                aria-label="إغلاق"
                            >
                                <XCircle size={24}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Role Selection */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">الدور الوظيفي (المستوى الرئيسي)</label>
                                <div className="flex gap-4">
                                    {(['SuperAdmin', 'Admin', 'Employee'] as RoleType[]).map(role => (
                                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="role" 
                                                checked={editingUser.الدور === role}
                                                onChange={() => setEditingUser({...editingUser, الدور: role})}
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
                                    <Lock size={18} className="text-orange-500"/> تخصيص الصلاحيات الدقيقة
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {allPermissions.map(perm => (
                                        <label 
                                            key={perm.code} 
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition
                                                ${tempPermissions.includes(perm.code) 
                                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                                                    : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600 opacity-70'}
                                            `}
                                        >
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{perm.label}</span>
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

                        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900">
                            <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-200 font-bold transition">إلغاء</button>
                            <button onClick={handleSaveUser} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition">حفظ التغييرات</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderBlacklist = () => {
      const filtered = blacklist.filter(b => {
          const person = getPersonById((b as any).personId);
          const name = String(person?.الاسم || '').toLowerCase();
          return name.includes(blacklistSearch.toLowerCase()) && (showArchivedBlacklist || b.isActive);
      });

      return (
          <RBACGuard requiredPermission="BLACKLIST_VIEW" fallback={<div className="p-8 text-center text-gray-400">ليس لديك صلاحية الوصول</div>}>
              <div className="animate-fade-in space-y-6">
                  {/* Controls */}
                  <div className="flex justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 flex-1">
                          <Search className="text-gray-400" size={20}/>
                          <input 
                              placeholder="بحث بالاسم..."
                              className="bg-transparent outline-none flex-1 text-sm text-slate-700 dark:text-white"
                              value={blacklistSearch}
                              onChange={e => setBlacklistSearch(e.target.value)}
                          />
                      </div>
                      <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 select-none">
                              <input type="checkbox" className="w-4 h-4" checked={showArchivedBlacklist} onChange={e => setShowArchivedBlacklist(e.target.checked)} />
                              عرض الأرشيف
                          </label>
                      </div>
                  </div>

                  {/* List */}
                  <div className="grid grid-cols-1 gap-4">
                      {filtered.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                              <ShieldAlert size={48} className="mx-auto mb-4 opacity-20"/>
                              <p>لا توجد سجلات مطابقة</p>
                          </div>
                      ) : (
                          filtered.map(rec => {
                              const person = getPersonById((rec as any).personId);
                              return (
                                  <div key={rec.id} className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border-l-4 shadow-sm flex flex-col md:flex-row gap-6 items-start transition hover:shadow-md
                                      ${rec.isActive 
                                          ? 'border-l-red-500 border-t border-b border-r border-gray-100 dark:border-slate-700' 
                                          : 'border-l-gray-400 border border-gray-100 dark:border-slate-700 opacity-70'}
                                  `}>
                                      <div className="flex items-start gap-4 flex-1">
                                          <div className={`p-3 rounded-full flex-shrink-0 ${rec.isActive ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                              {rec.isActive ? <Ban size={24}/> : <CheckCircle size={24}/>}
                                          </div>
                                          <div>
                                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                  {person?.الاسم || 'شخص محذوف'}
                                                  {!rec.isActive && <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-500">تم رفع الحظر</span>}
                                              </h3>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border
                                                      ${rec.severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                        rec.severity === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                                        'bg-yellow-50 text-yellow-700 border-yellow-200'}
                                                  `}>
                                                      {rec.severity}
                                                  </span>
                                                  <span className="text-xs text-slate-400">
                                                      {new Date(rec.dateAdded).toLocaleDateString()} • بواسطة {rec.addedBy}
                                                  </span>
                                              </div>
                                              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                                                  {rec.reason}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Actions */}
                                      {rec.isActive && (
                                          <div className="flex flex-col gap-2">
                                              <RBACGuard requiredPermission="BLACKLIST_REMOVE">
                                                  <button 
                                                      onClick={() => handleLiftBan(rec.id)}
                                                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 hover:border-green-200 transition"
                                                  >
                                                      رفع الحظر
                                                  </button>
                                              </RBACGuard>
                                              <RBACGuard requiredPermission="BLACKLIST_ADD">
                                                  <button 
                                                      onClick={() => handleEditBan(rec.id)}
                                                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 hover:border-indigo-200 transition"
                                                  >
                                                      تعديل
                                                  </button>
                                              </RBACGuard>
                                          </div>
                                      )}
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
                            <p className={DS.components.pageSubtitle}>إدارة المستخدمين، الصلاحيات، ومراقبة النظام</p>
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


import React from 'react';
import {
  Lock,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  UserCheck,
  UserX,
  Settings,
  UserPlus,
  ChevronDown,
  ShieldAlert,
  Ban,
  ScrollText,
  Filter,
  RefreshCw,
  Shield,
  BarChart3,
  Search,
  CheckCircle,
  Activity,
  Users as UsersIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DS } from '@/constants/designSystem';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { AppModal } from '@/components/ui/AppModal';
import { PageLayout } from '@/components/shared/PageLayout';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { StatCard as DSStatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrencyJOD } from '@/utils/format';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { safeNumber } from '@/utils/safe';
import type { RoleType } from '@/types';
import type { useAdminControlPanel } from '@/hooks/useAdminControlPanel';


// --- MAIN VIEW ---

export interface AdminControlPanelPageViewProps {
  page: ReturnType<typeof useAdminControlPanel>;
}

export const AdminControlPanelPageView: React.FC<AdminControlPanelPageViewProps> = ({ page }) => {
  const {
    activeTab, setActiveTab, analytics, visibleLogs, filteredLogs, logsPage, logsPageCount, setLogsPage,
    logFilter, setLogFilter, handleExportLogs, loadData,
    userSearch, setUserSearch, usersPage, usersPageCount, setUsersPage, visibleUsers, filteredUsers,
    isAddUserModalOpen, setIsAddUserModalOpen, handleAddUser, newUser, setNewUser, isDesktopFast, people,
    editingUser, setEditingUser, handleSaveUser, employeeCommissionMonthKey, setEmployeeCommissionMonthKey,
    employeeCommissionSummary, allPermissions, tempPermissions, togglePermission, handleOpenEditUser,
    handleToggleUserStatus, handleDeleteUser, getLinkedPersonName, blacklistSearch, setBlacklistSearch,
    showArchivedBlacklist, setShowArchivedBlacklist, blacklist, getPersonById, handleLiftBan, handleEditBan
  } = page;

  const renderAnalytics = () => {
    if (!analytics) return <div>تحميل...</div>;

    const pieData = [
      { name: 'عقارات مؤجرة', value: analytics.occupiedProps, color: '#10b981' },
      { name: 'عقارات شاغرة', value: analytics.vacantProps, color: '#3b82f6' },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <StatsCardRow>
          <DSStatCard
            label="العقود النشطة"
            value={safeNumber(analytics.activeContracts)}
            subtitle={`${safeNumber(analytics.expiredContracts)} منتهي`}
            icon={Shield}
            color="indigo"
          />
          <DSStatCard
            label="إجمالي التحصيل"
            value={`${safeNumber(analytics.totalCollected).toLocaleString()} د.أ`}
            subtitle={`${safeNumber(analytics.totalDue).toLocaleString()} د.أ متأخرات`}
            icon={BarChart3}
            color="emerald"
          />
          <DSStatCard
            label="المرفقات الشهرية"
            value={safeNumber(analytics.monthlyAttachments)}
            subtitle="ملفات تم رفعها هذا الشهر"
            icon={Download}
            color="blue"
          />
          <DSStatCard
            label="التنبيهات المفتوحة"
            value={safeNumber(analytics.openAlerts)}
            subtitle="تتطلب إجراء"
            icon={AlertTriangle}
            color="amber"
          />
        </StatsCardRow>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="app-card p-6">
            <h3 className="font-bold text-slate-700 dark:text-white mb-4">توزيع العقارات</h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
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
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div> مؤجر ({analytics.occupiedProps})
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div> شاغر ({analytics.vacantProps})
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <h3 className="font-bold text-slate-700 dark:text-white mb-4">أعلى 10 مستأجرين تأخيراً</h3>
            <div className="overflow-y-auto max-h-64 space-y-3 custom-scrollbar">
              {analytics.topDebtors && analytics.topDebtors.map((d, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600 w-6">{i + 1}.</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                  </div>
                  <span className="font-bold text-red-600">{safeNumber(d.amount).toLocaleString()} د.أ</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 rounded-2xl shadow-sm">
            <ScrollText size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">سجل العمليات والتدقيق</h3>
            <p className="text-sm text-slate-500 mt-1">مراقبة كافة تحركات المستخدمين والعمليات الحساسة في النظام.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => loadData()} className="gap-2">
            <RefreshCw size={16} /> تحديث
          </Button>
          <Button onClick={() => handleExportLogs()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20">
            <Download size={16} /> تصدير Excel
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">
          <Filter size={16} /> تصفية السجلات
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase px-1">الموظف</label>
            <input
              placeholder="اسم المستخدم..."
              className="w-full border p-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={logFilter.user}
              onChange={(e) => setLogFilter({ ...logFilter, user: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase px-1">نوع الإجراء</label>
            <input
              placeholder="مثلاً: تعديل، حذف..."
              className="w-full border p-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={logFilter.action}
              onChange={(e) => setLogFilter({ ...logFilter, action: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase px-1">من تاريخ</label>
            <input
              type="date"
              className="w-full border p-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 outline-none"
              value={logFilter.dateFrom}
              onChange={(e) => setLogFilter({ ...logFilter, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase px-1">إلى تاريخ</label>
            <input
              type="date"
              className="w-full border p-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 outline-none"
              value={logFilter.dateTo}
              onChange={(e) => setLogFilter({ ...logFilter, dateTo: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <div className="app-table-wrapper rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 shadow-sm z-10">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 border-r border-slate-200 dark:border-slate-800 ml-4 pl-4 shrink-0">
            {filteredLogs.length.toLocaleString()} سجل
          </div>
          <PaginationControls page={logsPage} pageCount={logsPageCount} onPageChange={setLogsPage} />
        </div>
        <div className="max-h-[700px] overflow-auto no-scrollbar bg-white dark:bg-slate-900/40">
          <table className="app-table">
            <thead className="app-table-thead !bg-slate-50/50 dark:!bg-slate-900/80 sticky top-0 backdrop-blur-md">
              <tr>
                <th className="app-table-th">الوقت</th>
                <th className="app-table-th">المستخدم</th>
                <th className="app-table-th">الإجراء</th>
                <th className="app-table-th">الكيان</th>
                <th className="app-table-th">IP</th>
                <th className="app-table-th">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
              {visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="app-table-empty !py-20 text-slate-400">
                    <ScrollText size={48} className="mx-auto mb-4 opacity-10" />
                    لا توجد سجلات مطابقة لمعايير البحث
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => (
                  <tr key={log.id} className="app-table-row group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="app-table-td font-mono text-[10px] text-slate-500 font-bold whitespace-nowrap" dir="ltr">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-JO') : '—'}
                    </td>
                    <td className="app-table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          {log.userName?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{log.userName}</span>
                      </div>
                    </td>
                    <td className="app-table-td">
                      <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black border border-indigo-100/50 dark:border-indigo-800/50">
                        {log.action}
                      </span>
                    </td>
                    <td className="app-table-td">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {log.entity}
                        {log.entityId && <span className="text-slate-400 font-normal mr-1">#{log.entityId.slice(0, 8)}</span>}
                      </span>
                    </td>
                    <td className="app-table-td font-mono text-[10px] text-slate-400">{log.ip || '—'}</td>
                    <td className="app-table-td max-w-xs xl:max-w-md">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate hover:whitespace-normal transition-all" title={log.details}>
                        {log.details || '—'}
                      </div>
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

  const renderUsers = () => (
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
        <PaginationControls page={usersPage} pageCount={usersPageCount} onPageChange={setUsersPage} />
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 font-bold text-sm"
        >
          <UserPlus size={18} /> مستخدم جديد
        </button>
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-400">الإجمالي: {filteredUsers.length.toLocaleString()} مستخدم</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleUsers.map((u) => {
          const linkedName = getLinkedPersonName(u.linkedPersonId);
          return (
            <div key={u.id} className={`app-card p-6 flex flex-col gap-4 relative overflow-hidden transition hover:shadow-lg ${u.isActive ? 'border-transparent shadow-sm' : 'border-red-100 dark:border-red-900/30 opacity-75'}`}>
              <div className="absolute top-4 left-4">
                <StatusBadge status={u.isActive ? 'نشط' : 'معطل'} className="!text-[10px] !px-2 !py-0.5 !border-0" />
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${u.الدور === 'SuperAdmin' ? 'bg-purple-600' : u.الدور === 'Admin' ? 'bg-indigo-600' : 'bg-slate-500'}`}>
                  {u.اسم_المستخدم.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{u.اسم_للعرض || u.اسم_المستخدم}</h3>
                  {u.اسم_للعرض && <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold" dir="ltr">@{u.اسم_المستخدم}</p>}
                  <p className="text-xs text-slate-500">{u.الدور}</p>
                  {linkedName && <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1"><span style={{ fontSize: 10 }}>🔗</span> {linkedName}</p>}
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-slate-700 pt-4 flex gap-2">
                <button onClick={() => handleOpenEditUser(u)} className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 flex items-center justify-center gap-2">
                  <Edit2 size={16} /> تعديل الصلاحيات
                </button>
                <button onClick={() => handleToggleUserStatus(u.id, u.isActive)} className={`p-2 rounded-lg transition text-white ${u.isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`} title={u.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}>
                  {u.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                </button>
                <button onClick={() => handleDeleteUser(u.id)} className="p-2 rounded-lg transition text-white bg-red-500 hover:bg-red-600" title="حذف الحساب">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AppModal
        open={isAddUserModalOpen}
        title="إضافة مستخدم جديد"
        onClose={() => setIsAddUserModalOpen(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">إلغاء</button>
            <button type="submit" form="add-user-form" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">حفظ</button>
          </div>
        }
      >
        <form id="add-user-form" onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-add-user-username">اسم المستخدم</label>
            <input id="admin-add-user-username" required className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.اسم_المستخدم} onChange={(e) => setNewUser({ ...newUser, اسم_المستخدم: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-add-user-display-name">الاسم للعرض (اختياري)</label>
            <input id="admin-add-user-display-name" className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.اسم_للعرض || ''} onChange={(e) => setNewUser({ ...newUser, اسم_للعرض: e.target.value })} placeholder="مثال: أحمد محمد" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">سيظهر في الواجهة بدلاً من اسم المستخدم.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-add-user-password">كلمة المرور</label>
            <input id="admin-add-user-password" required type="password" className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.كلمة_المرور} onChange={(e) => setNewUser({ ...newUser, كلمة_المرور: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-add-user-role">الصلاحية / الدور</label>
            <div className="relative">
              <select id="admin-add-user-role" className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer" value={newUser.الدور} onChange={(e) => setNewUser({ ...newUser, الدور: e.target.value as RoleType })}>
                <option value="Employee">موظف (صلاحيات محدودة)</option>
                <option value="Admin">مدير النظام (صلاحيات كاملة)</option>
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400"><ChevronDown size={16} /></div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ربط بملف شخص (اختياري)</label>
            {isDesktopFast ? (
              <div className="space-y-2">
                <PersonPicker value={String(newUser.linkedPersonId || '')} onChange={(personId) => setNewUser({ ...newUser, linkedPersonId: String(personId || '') })} placeholder="-- غير مرتبط --" />
                <div className="flex justify-end"><button type="button" onClick={() => setNewUser({ ...newUser, linkedPersonId: '' })} className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white">إزالة الربط</button></div>
              </div>
            ) : (
              <div className="relative">
                <select className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer" title="ربط بملف شخص" value={newUser.linkedPersonId} onChange={(e) => setNewUser({ ...newUser, linkedPersonId: e.target.value })}>
                  <option value="">-- غير مرتبط --</option>
                  {people.map((p) => <option key={p.رقم_الشخص} value={p.رقم_الشخص}>{p.الاسم} ({p.رقم_نوع_الشخص})</option>)}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400"><span style={{ fontSize: 16 }}>🔗</span></div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">يُستخدم لربط حساب الدخول ببيانات الموظف أو الشخص في النظام.</p>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={!!editingUser}
        title={editingUser ? <><Settings size={20} className="text-indigo-600" /> إدارة صلاحيات: {editingUser.اسم_المستخدم}</> : 'إدارة الصلاحيات'}
        onClose={() => setEditingUser(null)}
        size="2xl"
        footer={editingUser ? <div className="flex justify-end gap-3"><button onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-200 font-bold transition">إلغاء</button><button onClick={handleSaveUser} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition">حفظ التغييرات</button></div> : null}
        bodyClassName="p-0"
      >
        {editingUser && (
          <div className="p-6 space-y-6">
            <div className="app-card p-5 rounded-2xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-800 dark:text-white truncate">ملخص عمولات الموظف</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">شامل عمولة الوسيط الخارجي</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400" htmlFor="admin-employee-commission-month">الشهر</label>
                    <input id="admin-employee-commission-month" type="date" title="اختيار الشهر (اختر أي يوم ضمن الشهر)" value={employeeCommissionMonthKey ? `${employeeCommissionMonthKey}-01` : ''} onChange={(e) => setEmployeeCommissionMonthKey(e.target.value ? e.target.value.slice(0, 7) : '')} className="px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs" />
                  </div>
                  <StatusBadge status="نشط" />
                </div>
              </div>
              {employeeCommissionSummary?.loading ? <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">جارٍ التحميل…</div> : employeeCommissionSummary?.error ? <div className="mt-4 text-sm text-red-600">{employeeCommissionSummary.error}</div> : (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الشهر المحدد ({employeeCommissionSummary?.monthKey})</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white">عدد العمليات: {employeeCommissionSummary?.countThisMonth ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي عمولة الموظف</div>
                      <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(employeeCommissionSummary?.totalEmployeeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي العمولات (الأساس)</div>
                      <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">{formatCurrencyJOD(employeeCommissionSummary?.totalOfficeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تفصيل الشهر: إيجار</div>
                      <div className="flex items-center justify-between gap-3 mt-1"><div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div><div className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrencyJOD(employeeCommissionSummary?.rentOfficeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                      <div className="flex items-center justify-between gap-3"><div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div><div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(employeeCommissionSummary?.rentEmployeeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تفصيل الشهر: بيع</div>
                      <div className="flex items-center justify-between gap-3 mt-1"><div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div><div className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrencyJOD(employeeCommissionSummary?.saleOfficeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                      <div className="flex items-center justify-between gap-3"><div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div><div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(employeeCommissionSummary?.saleEmployeeThisMonth ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900/20 border border-gray-100 dark:border-slate-700"><div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي العمليات (كل الفترة)</div><div className="text-sm font-bold text-slate-800 dark:text-white">{employeeCommissionSummary?.countAll ?? 0}</div></div>
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30"><div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عمولة الموظف (كل الفترة)</div><div className="text-lg font-black text-amber-700 dark:text-amber-300">{formatCurrencyJOD(employeeCommissionSummary?.totalEmployeeAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30"><div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إدخال عقار (5%)</div><div className="text-lg font-black text-purple-700 dark:text-purple-300">{formatCurrencyJOD(employeeCommissionSummary?.totalIntroAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-gray-50/60 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">كل الفترة: إيجار</div>
                      <div className="flex items-center justify-between gap-3 mt-1"><div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div><div className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrencyJOD(employeeCommissionSummary?.rentOfficeAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                      <div className="flex items-center justify-between gap-3"><div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div><div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(employeeCommissionSummary?.rentEmployeeAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50/60 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">كل الفترة: بيع</div>
                      <div className="flex items-center justify-between gap-3 mt-1"><div className="text-xs text-slate-600 dark:text-slate-300">المكتب</div><div className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrencyJOD(employeeCommissionSummary?.saleOfficeAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                      <div className="flex items-center justify-between gap-3"><div className="text-xs text-slate-600 dark:text-slate-300">الموظف</div><div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(employeeCommissionSummary?.saleEmployeeAll ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">الدور الوظيفي (المستوى الرئيسي)</label>
              <div className="flex gap-4">
                {(['SuperAdmin', 'Admin', 'Employee'] as RoleType[]).map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="role" checked={editingUser.الدور === role} onChange={() => setEditingUser({ ...editingUser, الدور: role })} className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2"><Lock size={18} className="text-orange-500" /> تخصيص الصلاحيات الدقيقة</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allPermissions.map((perm) => (
                  <label key={perm.code} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${tempPermissions.includes(perm.code) ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600 opacity-70'}`}>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{perm.label}</span>
                    <input type="checkbox" checked={tempPermissions.includes(perm.code)} onChange={() => togglePermission(perm.code)} className="w-5 h-5 rounded text-green-600 focus:ring-green-500" />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );

  const renderBlacklist = () => (
    <RBACGuard requiredPermission="BLACKLIST_VIEW" fallback={<div className="p-8 text-center text-gray-400">ليس لديك صلاحية الوصول</div>}>
      <div className="animate-fade-in space-y-6">
        <div className="app-card p-4 rounded-xl flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="text-gray-400" size={20} />
            <input placeholder="بحث بالاسم..." className="bg-transparent outline-none flex-1 text-sm text-slate-700 dark:text-white" title="بحث بالاسم" value={blacklistSearch} onChange={(e) => setBlacklistSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 select-none">
              <input type="checkbox" className="w-4 h-4" checked={showArchivedBlacklist} onChange={(e) => setShowArchivedBlacklist(e.target.checked)} />
              عرض الأرشيف
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {blacklist.filter(b => {
            const p = getPersonById(b.personId);
            return String(p?.الاسم || '').toLowerCase().includes(blacklistSearch.toLowerCase()) && (showArchivedBlacklist || b.isActive);
          }).length === 0 ? (
            <div className="app-table-empty border-2 border-dashed border-slate-200 dark:border-slate-800 bg-transparent">
              <ShieldAlert size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-800" />
              <p className="text-slate-400 font-black tracking-wide">لا توجد سجلات مطابقة في القائمة السوداء</p>
            </div>
          ) : (
            blacklist.filter(b => {
              const p = getPersonById(b.personId);
              return String(p?.الاسم || '').toLowerCase().includes(blacklistSearch.toLowerCase()) && (showArchivedBlacklist || b.isActive);
            }).map((rec) => {
              const person = getPersonById(rec.personId);
              return (
                <div key={rec.id} className={`app-card p-8 border-r-8 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl ${rec.isActive ? 'border-r-rose-500 shadow-rose-500/5' : 'border-r-slate-300 dark:border-r-slate-700 opacity-60'}`}>
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className={`p-4 rounded-[1.5rem] flex-shrink-0 shadow-lg ${rec.isActive ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-rose-500/10' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-none'}`}>{rec.isActive ? <Ban size={32} /> : <CheckCircle size={32} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white truncate max-w-[300px]">{person?.الاسم || 'شخص محذوف'}</h3>
                        {!rec.isActive && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700 uppercase tracking-tight">تم رفع الحظر</span>}
                        <StatusBadge status={rec.severity} className="!text-[10px] !px-3 !py-1 !font-black !rounded-xl" />
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-4">
                        <div className="flex items-center gap-1.5"><Activity size={14} className="text-slate-300" /> {new Date(rec.dateAdded).toLocaleDateString('ar-JO')}</div>
                        <div className="flex items-center gap-1.5"><UserPlus size={14} className="text-slate-300" /> بواسطة {rec.addedBy}</div>
                      </div>
                      <div className="relative group"><div className="absolute -right-3 top-0 bottom-0 w-1 bg-slate-100 dark:bg-slate-800 rounded-full" /><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pr-4 font-medium italic">"{rec.reason}"</p></div>
                    </div>
                    {rec.isActive && (
                      <div className="flex md:flex-col gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <RBACGuard requiredPermission="BLACKLIST_REMOVE"><button onClick={() => handleLiftBan(rec.id)} className="flex-1 md:w-32 py-3 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all shadow-sm active:scale-95">رفع الحظر</button></RBACGuard>
                        <RBACGuard requiredPermission="BLACKLIST_ADD"><button onClick={() => handleEditBan(rec.id)} className="flex-1 md:w-32 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 rounded-2xl text-xs font-black hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm active:scale-95">تعديل</button></RBACGuard>
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

  return (
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="لوحة التحكم المركزية"
        description="إدارة المستخدمين، الصلاحيات، ومراقبة النظام"
        icon={<Shield size={32} />}
        actions={
          <div className="flex flex-wrap items-center gap-2 bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md">
            {[
              { id: 'analytics', label: 'التحليلات', icon: BarChart3, color: 'text-white' },
              { id: 'activity', label: 'سجل النشاط', icon: Activity, color: 'text-white' },
              { id: 'users', label: 'المستخدمين', icon: UsersIcon, color: 'text-white' },
              { id: 'blacklist', label: 'القائمة السوداء', icon: ShieldAlert, color: 'text-rose-300' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'analytics' | 'activity' | 'users' | 'blacklist')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-white text-indigo-700 shadow-soft scale-100'
                    : `text-white/70 hover:text-white hover:bg-white/10 scale-95`
                }`}
              >
                <tab.icon size={16} className={activeTab === tab.id ? 'text-indigo-600' : tab.color} />
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-6 flex-1 space-y-8">
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'activity' && renderActivity()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'blacklist' && renderBlacklist()}
      </div>
    </PageLayout>
  );
};

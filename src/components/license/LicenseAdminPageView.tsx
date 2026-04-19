import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Activity,
  LayoutDashboard,
  Key,
  Users2 as CustomersIcon,
  Settings as SettingsIcon,
  LogOut,
  Globe,
  Search,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Smartphone,
  History,
  Info
} from 'lucide-react';
import { licenseStatusToArabic } from '@/features/licenseAdmin/utils';
import type { useLicenseAdmin, TabKey, IssueDuration } from '@/hooks/useLicenseAdmin';

export interface LicenseAdminPageViewProps {
  page: ReturnType<typeof useLicenseAdmin>;
}

export const LicenseAdminPageView: React.FC<LicenseAdminPageViewProps> = ({ page }) => {
  const {
    activeTab, setActiveTab, serverUrl, setServerUrl, servers, newServer, setNewServer,
    username, setUsername, password, setPassword, serverAdminToken, setServerAdminToken,
    loggedIn, busy, error, info, q, setQ, items, selectedKey, setSelectedKey,
    selectedRecord, issueMaxActivations, setIssueMaxActivations, issueExpiresAt, setIssueExpiresAt,
    issueDuration, setSetStatusValue, setStatusValue,
    activateDeviceId, setActivateDeviceId, 
    activateResultJson, activateMeta, savePath, customerSearch, setCustomerSearch,
    customerName, setCustomerName, customerCompany, setCustomerCompany, 
    exportConfirmPassword, setExportConfirmPassword,
    newUsername, setNewUsername, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    doAddServer, doRemoveServer, refreshList, doDelete, doLogin, doSaveAdminToken, doLogout,
    doIssue, doActivate, doSaveLicenseFile,
    doUpdateAfterSales, applyIssueDuration, filteredCustomerGroups,
    doUpdateServerUser,
  } = page;

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Globe className="text-indigo-600" size={28} />
              مركز إدارة التراخيص (Hub)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              إدارة تفعيل الأنظمة، متابعة العملاء، وإعدادات خادم الترخيص المركزي.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void refreshList()} disabled={busy || !loggedIn}>
              <Activity size={16} className={busy ? 'animate-spin' : ''} />
              تحديث البيانات
            </Button>
            {loggedIn && (
              <Button variant="danger" onClick={() => void doLogout()}>
                <LogOut size={16} />
                خروج
              </Button>
            )}
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          {[
            { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
            { id: 'licenses', label: 'إدارة التراخيص', icon: Key },
            { id: 'customers', label: 'العملاء والمتابعة', icon: CustomersIcon },
            { id: 'settings', label: 'إعدادات الحساب', icon: SettingsIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error/Info Banner */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3 transition-all animate-shake">
            <ShieldCheck size={20} />
            {error}
          </div>
        )}
        {info && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3 transition-all">
            <Info size={20} />
            {info}
          </div>
        )}

        {/* Content Area */}
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                {/* Server Selection */}
                <Card className="p-6 rounded-3xl space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Globe size={20} className="text-indigo-600" />
                    خوادم الترخيص المتاحة
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      {servers.map((s) => (
                        <div
                          key={s}
                          onClick={() => setServerUrl(s)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                            serverUrl === s
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`p-2 rounded-xl ${serverUrl === s ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Globe size={16} />
                            </div>
                            <span className="text-sm font-bold truncate">{s}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); doRemoveServer(s); }}
                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-full text-slate-400">
                        <Plus size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold">إضافة خادم جديد</p>
                        <p className="text-[10px] text-slate-400">يمكنك إضافة روابط خوادم تفعيل أخرى</p>
                      </div>
                      <div className="w-full space-y-2">
                        <Input
                          value={newServer}
                          onChange={(e) => setNewServer(e.target.value)}
                          placeholder="https://license.yoursite.com"
                        />
                        <Button onClick={doAddServer} className="w-full">إضافة للسجل</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                {/* Login Status */}
                <Card className="p-6 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Key size={20} className="text-indigo-600" />
                        حالة الدخول
                      </h3>
                      <StatusBadge status={loggedIn ? 'متصل' : 'غير متصل'} />
                    </div>

                    {!loggedIn ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 px-1">اسم المستخدم (Admin)</label>
                          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 px-1">كلمة المرور</label>
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        </div>
                        <Button onClick={() => void doLogin()} isLoading={busy} className="w-full py-6 text-lg">
                          تسجيل الدخول للسيرفر
                        </Button>
                      </div>
                    ) : (
                      <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
                          <ShieldCheck size={32} />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-800 dark:text-emerald-300">أنت الآن في وضع التحكم</p>
                          <p className="text-[10px] text-emerald-600/70 mt-1">يمكنك إدارة التراخيص والعملاء عبر التبويبات أعلاه.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="space-y-6">
              {!loggedIn ? (
                <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <Key size={48} className="mx-auto text-slate-300" />
                  <p className="text-slate-500">يرجى تسجيل الدخول أولاً من لوحة التحكم للوصول لإدارة التراخيص.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Management */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <Card className="p-6 rounded-3xl space-y-6">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Activity size={20} className="text-indigo-600" />
                          قائمة المفاتيح المصدرة
                        </h3>
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                          <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <Input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && refreshList()}
                              placeholder="بحث برقم الكود أو الاسم..."
                              className="pr-10"
                            />
                          </div>
                          <Button onClick={() => void refreshList()} disabled={busy}>تحديث</Button>
                        </div>
                      </div>

                      <div className="app-table-wrapper rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="app-table">
                          <thead className="app-table-thead">
                            <tr>
                              <th className="app-table-th">المفتاح</th>
                              <th className="app-table-th">العميل</th>
                              <th className="app-table-th text-center">الحالة</th>
                              <th className="app-table-th text-center">التفعيل</th>
                              <th className="app-table-th text-center">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                            {items.slice(0, 50).map((it) => (
                              <tr
                                key={it.licenseKey}
                                onClick={() => setSelectedKey(it.licenseKey)}
                                className={`app-table-row group transition-all cursor-pointer ${
                                  selectedKey === it.licenseKey ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                                }`}
                              >
                                <td className="app-table-td">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded">
                                      <Key size={12} />
                                    </div>
                                    <span className="font-mono text-xs font-black" dir="ltr">{it.licenseKey}</span>
                                  </div>
                                </td>
                                <td className="app-table-td">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold">{it.customerName || '—'}</span>
                                    <span className="text-[10px] text-slate-400">{it.customerCompany || 'بدون شركة'}</span>
                                  </div>
                                </td>
                                <td className="app-table-td text-center">
                                  <StatusBadge status={licenseStatusToArabic(it.status || '')} className="!text-[10px] !px-2 !py-0.5" />
                                </td>
                                <td className="app-table-td text-center">
                                  <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                    {it.activationsCount || 0} / {it.maxActivations || '—'}
                                  </span>
                                </td>
                                <td className="app-table-td">
                                  <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-indigo-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                      <Info size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: Actions & Details */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Issue New */}
                    <Card className="p-6 rounded-3xl space-y-4 border-2 border-indigo-100 dark:border-indigo-900/30">
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Plus size={18} className="text-indigo-600" />
                        إصدار مفتاح جديد
                      </h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">الأجهزة (Max)</label>
                            <Input type="number" value={issueMaxActivations} onChange={(e) => setIssueMaxActivations(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">المدة</label>
                            <Select
                              value={issueDuration}
                              onChange={(e) => applyIssueDuration(e.target.value as IssueDuration)}
                              options={[
                                { value: 'trial14d', label: 'تجريبي 14 يوم' },
                                { value: '1m', label: 'شهر واحد' },
                                { value: '3m', label: '3 أشهر' },
                                { value: '6m', label: '6 أشهر' },
                                { value: '1y', label: 'سنة كاملة' },
                                { value: 'custom', label: 'مخصص' },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الانتهاء</label>
                          <Input type="date" value={issueExpiresAt} onChange={(e) => setIssueExpiresAt(e.target.value)} />
                        </div>
                        <Button onClick={() => void doIssue()} isLoading={busy} className="w-full">إصدار الآن</Button>
                      </div>
                    </Card>

                    {/* Selected Item Details (Drawer alternative) */}
                    {selectedRecord && (
                      <Card className="p-6 rounded-3xl space-y-6 border-l-4 border-l-indigo-600 animate-slide-left">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-slate-800 dark:text-white">تفاصيل: {selectedKey.slice(0, 8)}...</h4>
                          <button onClick={() => void doDelete()} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                            <span className="text-xs text-slate-500">حالة الكود</span>
                            <Select
                              className="w-32 !py-1 !px-2 !text-xs"
                              value={setStatusValue}
                              onChange={(e) => setSetStatusValue(e.target.value as 'active' | 'suspended' | 'revoked')}
                              options={[
                                { value: 'active', label: 'فعال' },
                                { value: 'suspended', label: 'معلق' },
                                { value: 'revoked', label: 'ملغي' },
                              ]}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase px-1">بصمة العميل (تفعيل)</label>
                            <div className="flex gap-2">
                              <Input
                                value={activateDeviceId}
                                onChange={(e) => setActivateDeviceId(e.target.value)}
                                placeholder="Fingerprint..."
                                className="font-mono text-xs"
                              />
                              <Button variant="secondary" onClick={() => void doActivate()} disabled={busy}><Smartphone size={16} /></Button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase px-1">بيانات العميل (تعديل سريع)</label>
                            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسم العميل" className="text-xs" />
                            <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="اسم المكتب/الشركة" className="text-xs" />
                          </div>

                          <Button onClick={() => void doUpdateAfterSales()} isLoading={busy} className="w-full" variant="secondary">حفظ التعديلات</Button>
                          
                          {activateResultJson && (
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] text-emerald-600 font-bold">{activateMeta}</p>
                              <div className="flex gap-2">
                                <Input
                                  type="password"
                                  value={exportConfirmPassword}
                                  onChange={(e) => setExportConfirmPassword(e.target.value)}
                                  placeholder="كلمة المرور للتأكيد"
                                  className="text-xs"
                                />
                                <Button onClick={() => void doSaveLicenseFile()} size="sm" className="bg-emerald-600 hover:bg-emerald-700"><Save size={14} /></Button>
                              </div>
                              {savePath && <p className="text-[9px] text-slate-400 truncate">المسار: {savePath}</p>}
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <Card className="p-6 rounded-3xl space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                      <CustomersIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">قائمة العملاء النشطين</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">تجميع المفاتيح الصادرة حسب بيانات كل عميل.</p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="بحث بالاسم أو الشركة..."
                      className="pr-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCustomerGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className="app-card p-5 rounded-3xl space-y-4 hover:shadow-lg transition-all border border-slate-100 dark:border-slate-800 group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 dark:text-white truncate" title={g.label}>{g.label}</h4>
                          <p className="text-xs text-slate-400 mt-1 truncate">{g.company || 'فردي'}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-black">
                          {g.items.length} كود
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {g.items.slice(0, 3).map(it => (
                          <div key={it.licenseKey} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="font-mono" dir="ltr">{it.licenseKey.slice(0, 8)}...</span>
                            <StatusBadge status={licenseStatusToArabic(it.status || '')} className="!text-[9px] !px-1.5 !py-0" />
                          </div>
                        ))}
                        {g.items.length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center">+ {g.items.length - 3} رموز أخرى</p>
                        )}
                      </div>

                      <button
                        onClick={() => { setActiveTab('licenses'); setQ(g.label); void refreshList(); }}
                        className="w-full py-2 rounded-xl text-xs font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all border border-indigo-100 dark:border-indigo-900/30"
                      >
                        عرض كافة التفاصيل
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="p-8 rounded-3xl space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <SettingsIcon size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">إعدادات ملف المشغل (Server Admin)</h3>
                  <p className="text-sm text-slate-500">تعديل بيانات الدخول الخاصة بك لهذا الخادم فقط.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اسم المستخدم الجديد</label>
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="admin_new"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">كلمة المرور الجديدة</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">تأكيد كلمة المرور</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex gap-3 text-amber-700 dark:text-amber-400">
                      <History size={20} className="shrink-0" />
                      <p className="text-xs leading-relaxed">
                        ⚠️ تنبيه: تغيير كلمة المرور سيؤدي إلى إنهاء الجلسة الحالية. سيتعين عليك تسجيل الدخول مرة أخرى بالبيانات الجديدة.
                      </p>
                    </div>
                  </div>

                  <Button onClick={() => void doUpdateServerUser()} isLoading={busy} className="w-full py-6 text-lg">
                    <Save size={18} className="ml-2" />
                    حفظ وتحديث الحساب
                  </Button>
                </div>
              </Card>

              {/* Server Info / Token Area */}
              <Card className="p-6 rounded-3xl space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Key size={18} className="text-indigo-600" />
                  توكن الأمان للسيرفر (Admin Token)
                </h4>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={serverAdminToken}
                    onChange={(e) => setServerAdminToken(e.target.value)}
                    placeholder="الصق التوكن هنا..."
                  />
                  <Button onClick={() => void doSaveAdminToken()} isLoading={busy} variant="secondary">حفظ التوكن</Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  * هذا التوكن يستخدم للمصادقة بين تطبيقك وسيرفر التراخيص المركزي. تأكد من تطابقه مع توكن السيرفر.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

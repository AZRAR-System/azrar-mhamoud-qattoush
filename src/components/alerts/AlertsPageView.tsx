import React from 'react';
import {
  Bell,
  CheckCircle,
  Clock,
  AlertTriangle,
  CheckCheck,
  User,
  Home,
  MessageCircle,
  StickyNote,
  FileText,
  Layers,
  Database,
  ShieldAlert,
  PenTool,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppModal } from '@/components/ui/AppModal';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import type { useAlerts } from '@/hooks/useAlerts';
import type { tbl_Alerts, AlertDetail } from '@/types';

interface AlertsPageViewProps {
  page: ReturnType<typeof useAlerts>;
}

export const AlertsPageView: React.FC<AlertsPageViewProps> = ({ page }) => {
  const {
    alerts,
    pagedAlerts,
    availableCategories,
    selectedAlert,
    setSelectedAlert,
    noteText,
    setNoteText,
    only,
    setOnly,
    category,
    setCategory,
    q,
    setQ,
    page: currentPage,
    setPage,
    pageCount,
    expiryKind,
    setExpiryKind,
    handleMarkAllRead,
    handleDismiss,
    handleNavigate,
    sendWhatsApp,
    sendFixedExpiryWhatsApp,
    openLegalNotice,
    saveNote,
    handleUpdateAndScan,
    isExpiryKind,
  } = page;

  const t = (s: string) => s;

  const getAlertStyle = (alert: tbl_Alerts) => {
    if (alert.category === 'Financial')
      return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400';
    if (alert.category === 'DataQuality')
      return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    if (alert.category === 'Risk')
      return 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400';
    return 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-400';
  };

  const getAlertIcon = (cat: string) => {
    switch (cat) {
      case 'Financial':
        return <AlertTriangle size={24} />;
      case 'DataQuality':
        return <Database size={24} />;
      case 'Risk':
        return <ShieldAlert size={24} />;
      case 'Expiry':
        return <Clock size={24} />;
      default:
        return <Bell size={24} />;
    }
  };

  const getMissingFieldLabel = (field: string) => {
    if (field === 'رقم_اشتراك_الكهرباء') return 'رقم اشتراك الكهرباء';
    if (field === 'رقم_اشتراك_المياه') return 'رقم اشتراك المياه';
    return field;
  };

  return (
    <div className="animate-fade-in pb-10 space-y-8">
      <SmartPageHero
        title="التنبيهات والإشعارات"
        description="مركز العمليات: متابعة التحصيل، جودة البيانات، والمخاطر"
        icon={Bell}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleUpdateAndScan}
              className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black px-6 py-3 rounded-2xl shadow-soft hover:shadow-md transition-all active:scale-95"
              leftIcon={<Clock size={20} />}
            >
              تحديث ومسح شامل
            </Button>
            {alerts.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleMarkAllRead}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6 py-3 rounded-2xl shadow-soft hover:shadow-md transition-all active:scale-95"
                leftIcon={<CheckCheck size={20} />}
              >
                تعليم الكل كمقروء
              </Button>
            )}
          </>
        }
      />

      <div className="app-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="relative">
            <Input
              type="text"
              placeholder={t('بحث في التنبيهات...')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10 pr-4 py-3 bg-slate-50/50 dark:bg-slate-950/30 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/30 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setOnly('unread')}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                only === 'unread'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              غير مقروء
            </button>
            <button
              onClick={() => setOnly('all')}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                only === 'all'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              الكل
            </button>
          </div>

          <select
            className="w-full text-xs font-black border-none bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-2xl outline-none ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">كل التصنيفات</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {pagedAlerts.length === 0 ? (
          <div className="app-card p-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-300 mb-6">
              <CheckCheck size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              لا توجد تنبيهات حالياً
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold">
              لقد قمت بمراجعة كافة الإشعارات الهامة.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2">
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {alerts.length.toLocaleString()} تنبيه
              </div>
              <PaginationControls
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pagedAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`app-card group relative transition-all duration-300 hover:shadow-lg border-r-4 ${
                    a.category === 'Financial'
                      ? 'border-r-rose-500'
                      : a.category === 'DataQuality'
                        ? 'border-r-indigo-500'
                        : a.category === 'Risk'
                          ? 'border-r-orange-500'
                          : 'border-r-slate-400'
                  }`}
                >
                  <div className="p-6 flex flex-col md:flex-row gap-6">
                    <div
                      className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg ${
                        a.category === 'Financial'
                          ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                          : a.category === 'DataQuality'
                            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white'
                            : a.category === 'Risk'
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                              : 'bg-gradient-to-br from-slate-500 to-slate-600 text-white'
                      }`}
                    >
                      {getAlertIcon(a.category || '')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <h3 className="font-black text-lg text-slate-800 dark:text-white truncate">
                          {a.نوع_التنبيه}
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">
                          {new Date(a.تاريخ_الانشاء).toLocaleDateString('en-GB')}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                        {a.الوصف}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-black">
                        {a.tenantName && (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/50">
                            <User size={14} /> {a.tenantName}
                          </div>
                        )}
                        {a.propertyCode && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                            <Home size={14} /> {a.propertyCode}
                          </div>
                        )}
                        {a.category && (
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                            <Layers size={14} /> {a.category}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 justify-end min-w-[120px]">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setSelectedAlert(a)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                      >
                        مراجعة وإجراء
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(a)}
                        className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-black text-xs px-4 py-2.5 rounded-xl transition-all"
                      >
                        تجاهل
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* QUICK ACTION MODAL */}
      {selectedAlert && (
        <AppModal
          open={!!selectedAlert}
          title={
            <div className="flex items-center gap-2">
              <span>{selectedAlert.نوع_التنبيه}</span>
              {selectedAlert.count && selectedAlert.count > 1 ? (
                <span className="bg-white/50 dark:bg-black/20 text-xs px-2 py-0.5 rounded">
                  مجمع
                </span>
              ) : null}
            </div>
          }
          onClose={() => setSelectedAlert(null)}
          size="lg"
          headerClassName={`${getAlertStyle(selectedAlert)} bg-opacity-20 dark:bg-opacity-10`}
          bodyClassName="p-0"
          footer={
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleDismiss(selectedAlert)}
                className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
              >
                <CheckCircle size={16} /> تعليم كمقروء (تجاهل)
              </button>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white text-sm"
              >
                إغلاق
              </button>
            </div>
          }
        >
          <div className="p-6 space-y-6">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedAlert.الوصف}
            </p>

            {/* Fixed expiry/renewal quick notifications */}
            {selectedAlert.category === 'Expiry' &&
              selectedAlert.مرجع_الجدول === 'العقود_tbl' &&
              selectedAlert.مرجع_المعرف !== 'batch' && (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                    رسائل انتهاء/تجديد العقد (ثابتة)
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        نوع الرسالة
                      </label>
                      <select
                        className="flex-1 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded px-3 py-2 outline-none"
                        value={expiryKind}
                        onChange={(e) => {
                          const nextKind = e.target.value;
                          if (isExpiryKind(nextKind)) setExpiryKind(nextKind);
                        }}
                      >
                        <option value="pre_notice">إخطار مبدئي قبل نهاية العقد</option>
                        <option value="approved">الموافقة على التجديد</option>
                        <option value="rejected">عدم التجديد</option>
                        <option value="auto">التجديد التلقائي</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => sendFixedExpiryWhatsApp('tenant')}
                        className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition"
                      >
                        <MessageCircle size={18} /> للمستأجر
                      </button>
                      <button
                        onClick={() => sendFixedExpiryWhatsApp('owner')}
                        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold transition"
                      >
                        <MessageCircle size={18} /> للمالك
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {/* --- GROUPED DETAILS TABLE (Generic) --- */}
            {selectedAlert.details && selectedAlert.details.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-gray-50 dark:bg-slate-800 p-3 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                  <Layers size={16} className="text-orange-500" />
                  التفاصيل ({selectedAlert.details.length})
                </div>

                {selectedAlert.category === 'DataQuality' ? (
                  /* DATA QUALITY (READ-ONLY + SEND) */
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {selectedAlert.مرجع_الجدول === 'العقارات_tbl' && (
                      <div className="p-4 bg-indigo-50/40 dark:bg-indigo-900/10 border-b border-gray-100 dark:border-slate-800">
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                          إرسال إخطار نقص بيانات العقارات
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          يتم الإرسال للمالك/المالكين حسب كل عقار باستخدام قالب ثابت.
                        </div>
                        <button
                          onClick={() => sendWhatsApp()}
                          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition"
                        >
                          <MessageCircle size={18} /> إرسال واتساب للمالكين
                        </button>
                      </div>
                    )}

                    {selectedAlert.details.map((d: AlertDetail) => {
                      const missingFields = Array.isArray(d?.missingFields)
                        ? d.missingFields.map((x) => String(x ?? '').trim()).filter(Boolean)
                        : [];
                      const missingText = missingFields.length
                        ? missingFields.map(getMissingFieldLabel).join('، ')
                        : '—';
                      return (
                        <div key={d.id} className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-700 dark:text-white">
                              {d.name}
                            </span>
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded">
                              نقص بيانات
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            الحقول الناقصة:{' '}
                            <span className="font-bold text-slate-600 dark:text-slate-200">
                              {missingText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* STANDARD LIST (Financial/Risk) */
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500">
                      <tr>
                        {selectedAlert.category === 'Financial' && <th className="p-3 text-right">التاريخ</th>}
                        <th className="p-3 text-right">
                          {selectedAlert.category === 'Risk' ? 'الاسم' : 'القيمة'}
                        </th>
                        <th className="p-3 text-right">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {selectedAlert.details.map((d) => (
                        <tr key={d.id}>
                          {selectedAlert.category === 'Financial' && (
                            <td className="p-3 font-medium text-red-600">{d.date}</td>
                          )}
                          <td className="p-3 font-bold">
                            {selectedAlert.category === 'Risk'
                              ? d.name
                              : `${d.amount?.toLocaleString()} د.أ`}
                          </td>
                          <td className="p-3 text-gray-400 dark:text-slate-400">{d.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={sendWhatsApp}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20"
              >
                <MessageCircle size={20} /> إرسال واتساب
              </button>

              <button
                onClick={() => handleNavigate(selectedAlert)}
                className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 py-3 rounded-xl font-bold transition"
              >
                <FileText size={20} /> التفاصيل الكاملة
              </button>

              {/* Legal Notice Button (If Financial/Risk/Expiry) */}
              {selectedAlert.category !== 'DataQuality' &&
                selectedAlert.مرجع_المعرف !== 'batch' && (
                  <button
                    onClick={openLegalNotice}
                    className="col-span-2 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 rounded-xl font-bold transition"
                  >
                    <PenTool size={20} /> إرسال إخطار قانوني
                  </button>
                )}
            </div>

            {/* Add Note Section (Only for specific/single alerts) */}
            {selectedAlert.مرجع_المعرف !== 'batch' && (
              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <StickyNote size={16} /> إضافة ملاحظة سريعة
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="ملاحظة للمتابعة..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button
                    onClick={saveNote}
                    className="bg-slate-800 dark:bg-slate-700 text-white p-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </AppModal>
      )}
    </div>
  );
};

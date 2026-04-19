import type { FC } from 'react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import {
  Scale,
  FileText,
  Copy,
  Plus,
  ExternalLink,
  CheckCircle,
  Trash2,
  MessageCircle,
  Printer,
  Send,
  Clock,
  Search,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { ContractPicker } from '@/components/shared/ContractPicker';
import { AttachmentManager } from '@/components/AttachmentManager';
import { MergeVariablesCatalog } from '@/components/shared/MergeVariablesCatalog';
import { formatNumber, formatDateYMD } from '@/utils/format';
import type { useLegalHub } from '@/hooks/useLegalHub';

interface LegalHubPageViewProps {
  page: ReturnType<typeof useLegalHub>;
}

export const LegalHubPageView: FC<LegalHubPageViewProps> = ({ page }) => {
  const {
    templates,
    historySearch,
    setHistorySearch,
    historyPage,
    setHistoryPage,
    selectedContractId,
    setSelectedContractId,
    selectedContractTenantId,
    selectedTemplateId,
    setSelectedTemplateId,
    generatedText,
    setGeneratedText,
    pendingSend,
    editingHistory,
    setEditingHistory,
    editNote,
    setEditNote,
    editReply,
    setEditReply,
    isAddTemplateOpen,
    setIsAddTemplateOpen,
    newTemplateForm,
    setNewTemplateForm,
    isVariablesOpen,
    setIsVariablesOpen,
    visibleHistory,
    historyPageCount,
    filteredHistory,
    handleApproveSend,
    handleCopy,
    handleWhatsApp,
    handlePreparePrint,
    handleSaveHistoryEdit,
    handleDeleteHistory,
    handleAddTemplate,
    handleDeleteTemplate,
    openEditHistory,
    isCustom,
    safeContractId,
    openPanel,
  } = page;

  return (
    <div className="animate-fade-in space-y-6">
      <SmartPageHero
        title="المركز القانوني والإخطارات"
        description="توليد وإدارة الإنذارات والإشعارات القانونية للمستأجرين."
        icon={Scale}
        iconColor="text-purple-600 dark:text-purple-400"
        iconBg="bg-purple-50 dark:bg-purple-950/40"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-200px)]">
        {/* LEFT PANEL: GENERATOR */}
        <div className="app-card flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <FileText size={20} className="text-purple-500" /> إنشاء إخطار جديد
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsVariablesOpen(true)}
                rightIcon={<Copy size={14} />}
              >
                المتغيرات
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddTemplateOpen(true)}
                rightIcon={<Plus size={14} />}
              >
                نموذج جديد
              </Button>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
            {/* Contract Select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                1. اختر العقد
              </label>
              <ContractPicker
                value={selectedContractId}
                onChange={(contractId) => setSelectedContractId(contractId)}
                placeholder="-- اختر عقداً --"
                onOpenContract={(contractId) => openPanel('CONTRACT_DETAILS', contractId)}
              />

              {selectedContractId ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPanel('CONTRACT_DETAILS', selectedContractId)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <ExternalLink size={14} /> فتح العقد
                  </button>
                  {(() => {
                    const tenantId = selectedContractTenantId;
                    if (!tenantId) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => openPanel('PERSON_DETAILS', tenantId)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      >
                        <ExternalLink size={14} /> فتح المستأجر
                      </button>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {/* Template Select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                2. نوع الإخطار
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {templates.map((t) => (
                  <div key={t.id} className="relative group">
                    <button
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium border transition flex justify-between items-center
                          ${
                            selectedTemplateId === t.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                              : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                    >
                      <span className="truncate">{t.title}</span>
                      {selectedTemplateId === t.id && (
                        <CheckCircle size={14} className="text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                    {isCustom(t.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(t.id);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-red-100 text-red-500 rounded hidden group-hover:block hover:bg-red-200"
                        title="حذف النموذج"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col min-h-[200px]">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                3. معاينة وتعديل النص
              </label>
              <textarea
                className="flex-1 w-full bg-yellow-50/50 dark:bg-slate-900 border border-yellow-200 dark:border-slate-600 rounded-xl p-4 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400/50 text-slate-800 dark:text-slate-200"
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                placeholder="سيظهر نص الإخطار هنا بعد اختيار العقد والقالب..."
              ></textarea>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between">
            <button
              onClick={handleCopy}
              disabled={!generatedText}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
            >
              <Copy size={18} /> نسخ
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleWhatsApp}
                disabled={!generatedText || !selectedContractId}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                <MessageCircle size={18} /> واتساب
              </button>
              <RBACGuard requiredPermission="PRINT_EXECUTE">
                <button
                  onClick={handlePreparePrint}
                  disabled={!generatedText}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-bold disabled:opacity-50"
                >
                  <Printer size={18} /> طباعة
                </button>
              </RBACGuard>
              <button
                onClick={handleApproveSend}
                disabled={!pendingSend}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                <Send size={18} /> اعتماد الإرسال
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: HISTORY */}
        <div className="app-card flex flex-col h-[500px] lg:h-auto">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Clock size={20} className="text-orange-500" /> سجل الإخطارات المرسلة
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="بحث..."
                  className="w-44 pr-8 pl-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                />
              </div>
              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">
                {formatNumber(filteredHistory.length)}
              </span>
              <PaginationControls
                page={historyPage}
                pageCount={historyPageCount}
                onPageChange={setHistoryPage}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {filteredHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>لا يوجد سجلات سابقة</p>
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-4 font-medium">نوع الإخطار</th>
                    <th className="p-4 font-medium">رقم العقد</th>
                    <th className="p-4 font-medium">تاريخ الإرسال</th>
                    <th className="p-4 font-medium">الطريقة</th>
                    <th className="p-4 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {visibleHistory.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-indigo-50/50 dark:hover:bg-slate-700/30 transition"
                    >
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                        {rec.templateTitle}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">
                        <button
                          type="button"
                          onClick={() => openPanel('CONTRACT_DETAILS', rec.contractId)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="فتح تفاصيل العقد"
                        >
                          #{safeContractId(rec.contractId)}
                        </button>
                      </td>
                      <td className="p-4 text-slate-500" dir="ltr">
                        {formatDateYMD(rec.sentDate)}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded w-fit">
                          {rec.sentMethod === 'WhatsApp' ? (
                            <MessageCircle size={12} />
                          ) : (
                            <Printer size={12} />
                          )}
                          {rec.sentMethod}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditHistory(rec)}
                            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600"
                            title="تعديل"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteHistory(rec.id)}
                            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-red-600"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ADD TEMPLATE MODAL */}
      {isAddTemplateOpen && (
        <AppModal
          open={isAddTemplateOpen}
          onClose={() => setIsAddTemplateOpen(false)}
          size="lg"
          title="إضافة نموذج جديد"
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsAddTemplateOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" form="add-template-form">
                حفظ النموذج
              </Button>
            </div>
          }
        >
          <form id="add-template-form" onSubmit={handleAddTemplate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">عنوان النموذج</label>
              <input
                required
                className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-2 focus:ring-purple-500"
                value={newTemplateForm.title}
                onChange={(e) => setNewTemplateForm({ ...newTemplateForm, title: e.target.value })}
                placeholder="مثال: إنذار عدلي أولي"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">التصنيف</label>
              <select
                className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
                value={newTemplateForm.category}
                onChange={(e) => {
                  const next = String(e.target.value || '').trim();
                  if (
                    next === 'General' ||
                    next === 'Warning' ||
                    next === 'Eviction' ||
                    next === 'Renewal'
                  ) {
                    setNewTemplateForm({ ...newTemplateForm, category: next });
                  }
                }}
              >
                <option value="General">عام</option>
                <option value="Warning">إنذار / تنبيه</option>
                <option value="Eviction">إخلاء</option>
                <option value="Renewal">تجديد</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">نص النموذج</label>
              <div className="mb-2">
                <MergeVariablesCatalog
                  title="كل المتغيرات (بالعربية)"
                  maxHeightClassName="max-h-56"
                />
              </div>
              <textarea
                required
                className="w-full h-32 border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-2 focus:ring-purple-500 text-sm leading-relaxed"
                value={newTemplateForm.content}
                onChange={(e) =>
                  setNewTemplateForm({ ...newTemplateForm, content: e.target.value })
                }
                placeholder="أدخل نص النموذج هنا..."
              />
            </div>
          </form>
        </AppModal>
      )}

      {/* EDIT HISTORY MODAL */}
      {editingHistory && (
        <AppModal
          open={!!editingHistory}
          onClose={() => setEditingHistory(null)}
          size="2xl"
          title="تعديل سجل الإخطار"
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditingHistory(null)}>
                إلغاء
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleSaveHistoryEdit()}>
                حفظ التعديل
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              عقد: <b className="font-mono">#{safeContractId(editingHistory.contractId)}</b> •{' '}
              {editingHistory.templateTitle}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">ملاحظة داخلية (اختياري)</label>
              <textarea
                className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none text-sm resize-none"
                rows={3}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="مثال: تم التواصل وتم الاتفاق على موعد سداد"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">ملاحظة الرد (اختياري)</label>
              <textarea
                className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none text-sm resize-none"
                rows={3}
                value={editReply}
                onChange={(e) => setEditReply(e.target.value)}
                placeholder="مثال: رد المستأجر: سأدفع غداً"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                صورة الرد / مرفقات الرد (اختياري)
              </label>
              <AttachmentManager referenceType={'LegalNotice'} referenceId={editingHistory.id} />
            </div>
          </div>
        </AppModal>
      )}

      {/* VARIABLES MODAL */}
      {isVariablesOpen && (
        <AppModal
          open={isVariablesOpen}
          onClose={() => setIsVariablesOpen(false)}
          size="4xl"
          title="متغيرات الدمج (بالعربية)"
        >
          <MergeVariablesCatalog
            title="كل المتغيرات المتاحة (اضغط للنسخ)"
            maxHeightClassName="max-h-[60vh]"
          />
        </AppModal>
      )}
    </div>
  );
};

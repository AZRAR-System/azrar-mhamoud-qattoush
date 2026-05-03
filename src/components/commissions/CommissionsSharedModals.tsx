import type { FC } from 'react';
import { AppModal } from '@/components/ui/AppModal';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import type { CommissionsPageModel } from '@/components/commissions/commissionsPageTypes';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { Pencil, Plus } from 'lucide-react';

const inputClass =
  'w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm';

const asString = (v: unknown): string => String(v ?? '');

export const CommissionsSharedModals: FC<{ page: CommissionsPageModel }> = ({ page }) => {
  const {
    isExternalModalOpen,
    externalModalMode,
    newExtComm,
    setNewExtComm,
    handleAddExternal,
    closeExternalModal,
    isContractModalOpen,
    editingContractComm,
    setEditingContractComm,
    contractEmployeeBreakdown,
    handleSaveContractEdit,
    closeContractModal,
    systemUsers,
  } = page;

  return (
    <>
      {isExternalModalOpen ? (
        <AppModal
          open={isExternalModalOpen}
          title={
            externalModalMode === 'add' ? (
              <>
                <Plus size={20} /> إضافة عمولة خارجية
              </>
            ) : (
              <>
                <Pencil size={20} /> تعديل عمولة خارجية
              </>
            )
          }
          onClose={closeExternalModal}
          size="lg"
          footer={
            <div className="flex gap-3">
              <button
                type="submit"
                form="external-commission-form"
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-bold text-white transition hover:bg-indigo-700"
              >
                {externalModalMode === 'add' ? 'حفظ' : 'حفظ التعديل'}
              </button>
              <button
                type="button"
                onClick={closeExternalModal}
                className="flex-1 rounded-lg bg-gray-200 py-2.5 font-bold text-slate-800 transition hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
              >
                إلغاء
              </button>
            </div>
          }
        >
          <form id="external-commission-form" onSubmit={handleAddExternal} className="space-y-4">
            <Input
              type="date"
              className={inputClass}
              value={newExtComm.التاريخ || ''}
              onChange={(e) => setNewExtComm({ ...newExtComm, التاريخ: e.target.value })}
            />
            <input
              type="text"
              placeholder="العنوان"
              className={inputClass}
              value={newExtComm.العنوان || ''}
              onChange={(e) => setNewExtComm({ ...newExtComm, العنوان: e.target.value })}
            />
            <DynamicSelect
              label="نوع الدخل الخارجي"
              category="ext_comm_type"
              value={newExtComm.النوع || ''}
              onChange={(val) => setNewExtComm((prev) => ({ ...prev, النوع: val }))}
              placeholder="اختر نوع الدخل..."
              required
            />
            <MoneyInput
              placeholder="القيمة"
              className={inputClass}
              value={typeof newExtComm.القيمة === 'number' ? newExtComm.القيمة : undefined}
              onValueChange={(v) => setNewExtComm({ ...newExtComm, القيمة: v })}
            />
            <textarea
              placeholder="ملاحظات (اختياري)"
              className={`${inputClass} resize-none`}
              rows={3}
              value={newExtComm.ملاحظات || ''}
              onChange={(e) => setNewExtComm({ ...newExtComm, ملاحظات: e.target.value })}
            />
          </form>
        </AppModal>
      ) : null}

      {isContractModalOpen && editingContractComm ? (
        <AppModal
          open={isContractModalOpen}
          title={
            <>
              <Pencil size={20} /> تعديل عمولة العقد
            </>
          }
          onClose={closeContractModal}
          size="lg"
          footer={
            <div className="flex gap-3">
              <button
                type="submit"
                form="contract-commission-form"
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-bold text-white transition hover:bg-indigo-700"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={closeContractModal}
                className="flex-1 rounded-lg bg-gray-200 py-2.5 font-bold text-slate-800 transition hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
              >
                إلغاء
              </button>
            </div>
          }
        >
          <form id="contract-commission-form" onSubmit={handleSaveContractEdit} className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {editingContractComm.نوع_العمولة === 'Sale' ? 'الاتفاقية' : 'العقد'}:{' '}
              <b className="font-mono text-slate-800 dark:text-white" dir="ltr">
                #
                {formatContractNumberShort(
                  asString(
                    editingContractComm.نوع_العمولة === 'Sale'
                      ? editingContractComm.رقم_الاتفاقية
                      : editingContractComm.رقم_العقد
                  )
                )}
              </b>
            </div>
            <Input
              type="date"
              className={inputClass}
              value={asString(editingContractComm.تاريخ_العقد) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, تاريخ_العقد: e.target.value })
              }
            />

            <select
              className={inputClass}
              value={asString(editingContractComm.اسم_المستخدم) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, اسم_المستخدم: e.target.value })
              }
              title="الموظف المسؤول عن هذه العمولة"
            >
              <option value="">(بدون تحديد موظف)</option>
              {systemUsers
                .filter((u) => !!u?.isActive)
                .map((u) => {
                  const username = String(u?.اسم_المستخدم || '').trim();
                  const display = String(u?.اسم_للعرض || u?.اسم_المستخدم || '').trim();
                  return (
                    <option key={username} value={username}>
                      {display || username}
                    </option>
                  );
                })}
            </select>

            <input
              type="text"
              placeholder="رقم الفرصة (اختياري)"
              className={inputClass}
              value={asString(editingContractComm.رقم_الفرصة) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, رقم_الفرصة: e.target.value })
              }
            />

            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">يوجد إدخال عقار</span>
              <input
                type="checkbox"
                checked={!!editingContractComm.يوجد_ادخال_عقار}
                onChange={(e) =>
                  setEditingContractComm({
                    ...editingContractComm,
                    يوجد_ادخال_عقار: e.target.checked,
                  })
                }
              />
            </label>

            <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
              <div className="text-xs font-bold text-orange-700 dark:text-orange-300">
                عمولة إدخال عقار (5%) — محسوبة تلقائياً
              </div>
              <div className="mt-1 text-lg font-bold text-orange-700 dark:text-orange-300">
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300" dir="rtl">
                المعادلة: {formatCurrencyJOD(contractEmployeeBreakdown?.officeTotal || 0)} × 5% ={' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                الشريحة (حسب إجمالي الإيجار لهذا الشهر):{' '}
                {String(contractEmployeeBreakdown?.tierId || '—')} — قبل الإدخال:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.baseEarned || 0)} — الإجمالي:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.finalEarned || 0)}
              </div>
            </div>
            <MoneyInput
              placeholder={editingContractComm.نوع_العمولة === 'Sale' ? 'عمولة البائع' : 'عمولة المالك'}
              className={inputClass}
              value={
                editingContractComm.نوع_العمولة === 'Sale'
                  ? typeof editingContractComm.عمولة_البائع === 'number'
                    ? editingContractComm.عمولة_البائع
                    : Number(editingContractComm.عمولة_البائع ?? 0)
                  : typeof editingContractComm.عمولة_المالك === 'number'
                    ? editingContractComm.عمولة_المالك
                    : Number(editingContractComm.عمولة_المالك ?? 0)
              }
              onValueChange={(v) =>
                setEditingContractComm({
                  ...editingContractComm,
                  ...(editingContractComm.نوع_العمولة === 'Sale'
                    ? { عمولة_البائع: v ?? 0 }
                    : { عمولة_المالك: v ?? 0 }),
                })
              }
            />
            <MoneyInput
              placeholder={editingContractComm.نوع_العمولة === 'Sale' ? 'عمولة المشتري' : 'عمولة المستأجر'}
              className={inputClass}
              value={
                editingContractComm.نوع_العمولة === 'Sale'
                  ? typeof editingContractComm.عمولة_المشتري === 'number'
                    ? editingContractComm.عمولة_المشتري
                    : Number(editingContractComm.عمولة_المشتري ?? 0)
                  : typeof editingContractComm.عمولة_المستأجر === 'number'
                    ? editingContractComm.عمولة_المستأجر
                    : Number(editingContractComm.عمولة_المستأجر ?? 0)
              }
              onValueChange={(v) =>
                setEditingContractComm({
                  ...editingContractComm,
                  ...(editingContractComm.نوع_العمولة === 'Sale'
                    ? { عمولة_المشتري: v ?? 0 }
                    : { عمولة_المستأجر: v ?? 0 }),
                })
              }
            />
          </form>
        </AppModal>
      ) : null}
    </>
  );
};

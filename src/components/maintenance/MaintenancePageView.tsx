import {
  Wrench,
  CheckCircle,
  Clock,
  User,
  Home,
  ChevronDown,
  Key,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { MaintenanceSmartFilterBar } from './MaintenanceSmartFilterBar';
import { DatePicker } from '@/components/ui/DatePicker';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import type { useMaintenance } from '@/hooks/useMaintenance';
import { تذاكر_الصيانة_tbl } from '@/types';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { PageLayout } from '@/components/shared/PageLayout';
import { StatsCardRow } from '@/components/shared/StatsCardRow';

interface MaintenancePageViewProps {
  page: ReturnType<typeof useMaintenance>;
}

export const MaintenancePageView: React.FC<MaintenancePageViewProps> = ({ page }) => {
  const {
    visibleTickets,
    filteredTickets,
    showDynamicColumns,
    isModalOpen,
    setIsModalOpen,
    filter,
    setFilter,
    formData,
    setFormData,
    dynamicValues,
    setDynamicValues,
    dynamicFields,
    editingId,
    canEdit,
    canClose,
    openPanel,
    page: currentPage,
    setPage,
    pageCount,
    handleOpenModal,
    handleSubmit,
    handleFinishTicket,
    handleDeleteTicket,
    getPropName,
    getPropertyContext,
    searchTerm,
    setSearchTerm,
    refreshData,
    people,
  } = page;

  const selectClass =
    'w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer';
  const selectWrapper = 'relative';
  const selectIcon =
    'absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 dark:text-slate-400';

  return (
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="الصيانة والدعم الفني"
        description="إدارة طلبات الصيانة وتكاليف الإصلاح"
        icon={Wrench}
      />

      <MaintenanceSmartFilterBar
        statusFilter={filter}
        setStatusFilter={(v) => setFilter(v as 'all' | 'open' | 'closed')}
        searchQuery={searchTerm}
        setSearchQuery={setSearchTerm}
        totalResults={filteredTickets.length}
        currentPage={currentPage}
        totalPages={pageCount}
        onPageChange={setPage}
        onRefresh={refreshData}
        onNewTicket={() => handleOpenModal()}
      />

      <StatsCardRow>
        <StatCard
          label="إجمالي التذاكر"
          value={page.tickets.length}
          icon={Wrench}
          color="indigo"
        />
        <StatCard
          label="مفتوحة"
          value={page.tickets.filter((t) => t.الحالة !== 'مغلق').length}
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          label="مغلقة"
          value={page.tickets.filter((t) => t.الحالة === 'مغلق').length}
          icon={CheckCircle}
          color="emerald"
        />
      </StatsCardRow>

      <div className="space-y-6">


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleTickets.map((ticket) => {
          const context = getPropertyContext(ticket.رقم_العقار);
          return (
            <div key={ticket.رقم_التذكرة} className="app-card p-5 hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${ticket.الأولوية === 'عالية' ? 'bg-red-100 text-red-600' : ticket.الأولوية === 'متوسطة' ? 'bg-yellow-100 text-yellow-600' : 'bg-indigo-100 text-indigo-600'}`}
                >
                  {ticket.الأولوية}
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-bold ${ticket.الحالة === 'مغلق' ? 'text-green-600' : 'text-orange-600'}`}
                >
                  {ticket.الحالة === 'مغلق' ? <CheckCircle size={14} /> : <Clock size={14} />}{' '}
                  {ticket.الحالة}
                </span>
              </div>

              <h3
                className="font-bold text-slate-800 dark:text-white mb-2 line-clamp-2 cursor-pointer hover:text-indigo-600"
                onClick={() => handleOpenModal(ticket)}
              >
                {ticket.الوصف}
              </h3>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2">
                <Home size={14} />
                <span
                  className="font-bold cursor-pointer hover:text-indigo-600 transition"
                  onClick={() =>
                    context?.prop && openPanel('PROPERTY_DETAILS', context.prop.رقم_العقار)
                  }
                >
                  {getPropName(ticket.رقم_العقار)}
                </span>
              </div>

              {/* Owner & Tenant Context */}
              <div className="flex flex-col gap-1 mb-4 text-xs text-slate-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/40 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Key size={12} className="text-purple-500" />
                  <span>
                    المالك:
                    <span
                      className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 cursor-pointer transition mr-1"
                      onClick={() =>
                        context?.owner && openPanel('PERSON_DETAILS', context.owner.رقم_الشخص)
                      }
                    >
                      {context?.ownerName}
                    </span>
                  </span>
                </div>
                {context?.tenantName && (
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-indigo-500" />
                    <span>
                      المستأجر:
                      <span
                        className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 cursor-pointer transition mr-1"
                        onClick={() =>
                          context?.tenant && openPanel('PERSON_DETAILS', context.tenant.رقم_الشخص)
                        }
                      >
                        {context.tenantName}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {showDynamicColumns && dynamicFields.length > 0
                ? (() => {
                    const values = ticket.حقول_ديناميكية || {};
                    const visible = dynamicFields
                      .map((f) => ({ f, v: values?.[f.name] }))
                      .filter(({ v }) => !isEmptyDynamicValue(v));

                    if (!visible.length) return null;

                    return (
                      <div className="mb-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                          حقول إضافية
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {visible.map(({ f, v }) => (
                            <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-bold text-slate-500 dark:text-slate-400">
                                {f.label}:
                              </span>{' '}
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {formatDynamicValue(f.type, v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                : null}

              <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-400">
                <span>{ticket.تاريخ_الطلب}</span>
                <div className="flex items-center gap-2">
                  {ticket.التكلفة_الفعلية ? (
                    <span className="font-bold text-slate-700 dark:text-white">
                      {ticket.التكلفة_الفعلية} د.أ
                    </span>
                  ) : (
                    <span>--</span>
                  )}
                  <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                    {ticket.الجهة_المسؤولة}
                  </span>
                  <RBACGuard requiredPermission="CLOSE_MAINTENANCE">
                    <button
                      type="button"
                      onClick={() => handleFinishTicket(ticket.رقم_التذكرة)}
                      disabled={ticket.الحالة === 'مغلق'}
                      className="px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="إنهاء"
                    >
                      <CheckCircle size={14} /> إنهاء
                    </button>
                  </RBACGuard>
                  <RBACGuard requiredPermission="DELETE_MAINTENANCE">
                    <button
                      type="button"
                      onClick={() => handleDeleteTicket(ticket.رقم_التذكرة)}
                      className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-bold transition flex items-center gap-1"
                      title="حذف"
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                  </RBACGuard>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <AppModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          size="lg"
          title={editingId ? 'تعديل تذكرة' : 'طلب صيانة جديد'}
          bodyClassName="p-6"
          footer={
            <div className="flex justify-end gap-3">
              {editingId && (
                <div className="flex-1 flex items-center gap-2">
                  <RBACGuard requiredPermission="CLOSE_MAINTENANCE">
                    <button
                      type="button"
                      onClick={() => handleFinishTicket(editingId)}
                      disabled={formData.الحالة === 'مغلق'}
                      className="px-4 py-2.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle size={18} /> إنهاء
                    </button>
                  </RBACGuard>
                  <RBACGuard requiredPermission="DELETE_MAINTENANCE">
                    <button
                      type="button"
                      onClick={() => handleDeleteTicket(editingId)}
                      className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-bold transition flex items-center gap-2"
                    >
                      <Trash2 size={18} /> حذف
                    </button>
                  </RBACGuard>
                </div>
              )}
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                إلغاء
              </Button>
              <RBACGuard requiredPermission="EDIT_MAINTENANCE">
                <div className="flex gap-2">
                  {editingId && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const reporterId = formData.رقم_المستاجر;
                        const reporter = people.find((p) => p.رقم_الشخص === reporterId);
                        openPanel('CONTRACT_WHATSAPP_SEND', undefined, {
                          personId: reporterId,
                          messageContext: `بخصوص طلب الصيانة (تذكرة رقم ${editingId}): ${formData.الوصف}`,
                          prefilledPhone: reporter?.رقم_الهاتف,
                        });
                        setIsModalOpen(false);
                      }}
                    >
                      إرسال إشعار
                    </Button>
                  )}
                  <Button type="submit" variant="primary" form="maintenance-ticket-form">
                    حفظ التذكرة
                  </Button>
                </div>
              </RBACGuard>
            </div>
          }
        >
          <form id="maintenance-ticket-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                العقار <span className="text-red-500">*</span>
              </label>

              <PropertyPicker
                value={formData.رقم_العقار}
                onChange={(id) => setFormData({ ...formData, رقم_العقار: id })}
                required
                placeholder="اختر العقار لفتح تذكرة صيانة..."
                disabled={!canEdit && !canClose}
              />

              {/* Property Context Info */}
              {formData.رقم_العقار && (
                <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 text-xs">
                  {(() => {
                    const ctx = getPropertyContext(formData.رقم_العقار);
                    return (
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="block text-slate-500 dark:text-slate-400">المالك</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {ctx?.ownerName}
                          </span>
                        </div>
                        {ctx?.tenantName && (
                          <div className="text-left">
                            <span className="block text-slate-500 dark:text-slate-400">
                              المستأجر الحالي
                            </span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-300">
                              {ctx.tenantName}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                المستأجر (إن وجد)
              </label>
              <PersonPicker
                value={formData.رقم_المستاجر}
                onChange={(id) => setFormData({ ...formData, رقم_المستاجر: id })}
                defaultRole="مستأجر"
                placeholder="يمكن اختيار مستأجر لربطه بالتذكرة (اختياري)"
                disabled={!canEdit && !canClose}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                وصف المشكلة <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                value={formData.الوصف}
                onChange={(e) => setFormData({ ...formData, الوصف: e.target.value })}
                disabled={!canEdit && !canClose}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  تاريخ الطلب
                </label>
                <DatePicker
                  value={formData.تاريخ_الطلب}
                  onChange={(d) => setFormData({ ...formData, تاريخ_الطلب: d })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  الأولوية
                </label>
                <div className={selectWrapper}>
                  <select
                    className={selectClass}
                    value={formData.الأولوية}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        الأولوية: e.target.value as unknown as تذاكر_الصيانة_tbl['الأولوية'],
                      })
                    }
                  >
                    <option value="منخفضة">منخفضة</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="عالية">عالية</option>
                  </select>
                  <div className={selectIcon}>
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-700/30 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الحالة</label>
                <div className={selectWrapper}>
                  <select
                    className={selectClass}
                    value={formData.الحالة}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        الحالة: e.target.value as unknown as تذاكر_الصيانة_tbl['الحالة'],
                      })
                    }
                    disabled={!canEdit && !canClose}
                  >
                    <option value="مفتوح">مفتوح</option>
                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                    <option value="مغلق">مغلق (تم الإنجاز)</option>
                  </select>
                  <div className={selectIcon}>
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  المسؤول عن الدفع
                </label>
                <div className={selectWrapper}>
                  <select
                    className={selectClass}
                    value={formData.الجهة_المسؤولة}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        الجهة_المسؤولة: e.target
                          .value as unknown as تذاكر_الصيانة_tbl['الجهة_المسؤولة'],
                      })
                    }
                  >
                    <option value="المالك">المالك</option>
                    <option value="المستأجر">المستأجر</option>
                    <option value="مشترك">مشترك</option>
                  </select>
                  <div className={selectIcon}>
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  التكلفة الفعلية
                </label>
                <MoneyInput
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={formData.التكلفة_الفعلية || undefined}
                  onValueChange={(v) =>
                    setFormData({ ...formData, التكلفة_الفعلية: Number(v ?? 0) })
                  }
                  placeholder="0.00"
                  disabled={!canEdit && !canClose}
                />
              </div>
            </div>

            {(formData.الحالة === 'مغلق' ||
              !!formData.تاريخ_الإغلاق ||
              !!formData.ملاحظات_الإنهاء) && (
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-green-700 dark:text-green-300">
                    بيانات الإنهاء
                  </span>
                  {formData.تاريخ_الإغلاق && (
                    <span className="text-slate-600 dark:text-slate-300">
                      تاريخ الإغلاق: {formData.تاريخ_الإغلاق}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    ملاحظات الإنهاء (اختياري)
                  </label>
                  <textarea
                    className="w-full border border-green-200 dark:border-green-900/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none h-20"
                    value={formData.ملاحظات_الإنهاء || ''}
                    onChange={(e) => setFormData({ ...formData, ملاحظات_الإنهاء: e.target.value })}
                    disabled={!canEdit && !canClose}
                    placeholder="اكتب ملاحظات الإنهاء هنا (إن وجدت)"
                  />
                </div>
              </div>
            )}

            <DynamicFieldsSection
              formId="maintenance"
              values={dynamicValues}
              onChange={setDynamicValues}
            />
          </form>
        </AppModal>
      )}
      </div>
    </PageLayout>
  );
};

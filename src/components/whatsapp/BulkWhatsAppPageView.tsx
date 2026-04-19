import React from 'react';
import { MessageCircle, PauseCircle, PlayCircle, Users } from 'lucide-react';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { UseBulkWhatsAppReturn, normalizePhoneLoose } from '@/hooks/useBulkWhatsApp';

interface BulkWhatsAppPageViewProps {
  page: UseBulkWhatsAppReturn;
}

export const BulkWhatsAppPageView: React.FC<BulkWhatsAppPageViewProps> = ({ page }) => {
  const {
    contacts, selectedIds, selected, toggleSelect, toggleSelectAll, visibleContacts,
    message, setMessage, delaySeconds, setDelaySeconds, useJitter, setUseJitter, maxPerRun, setMaxPerRun,
    templates, selectedTemplateId, handleSelectTemplate, templateName, setTemplateName,
    isRunning, progress, handleStart, handleStop, handleInsertToken, handleSaveTemplate, handleNewMessage,
    contactsPage, setContactsPage, contactsPageCount
  } = page;

  return (
    <div className="space-y-6" dir="rtl">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>إرسال واتساب جماعي</h2>
          <p className={DS.components.pageSubtitle}>
            اكتب رسالة وافتح محادثات واتساب لعدة جهات اتصال مع مهلة بين كل فتح
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Users size={16} />
          {selectedIds.length} / {contacts.length}
        </div>
      </div>

      <div className="app-card p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">
              نص الرسالة
            </label>

            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <select
                className="w-full md:w-72 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                disabled={isRunning}
              >
                <option value="">رسائل محفوظة (اختياري)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <input
                className="w-full md:flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="اسم الرسالة (اختياري)"
                disabled={isRunning}
              />

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSaveTemplate} disabled={isRunning}>
                  حفظ
                </Button>
                <Button variant="secondary" onClick={handleNewMessage} disabled={isRunning}>
                  رسالة جديدة
                </Button>
              </div>
            </div>

            <textarea
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none h-28 text-right"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="مثال: تهنئة ..."
              disabled={isRunning}
            />

            <div className="mt-3 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                متغيرات يمكنك استخدامها داخل الرسالة
              </div>
              <div className="flex flex-wrap gap-2">
                {['{name}', '{phone}', '{index}', '{total}', '{date}'].map(token => (
                  <Button
                    key={token}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleInsertToken(token)}
                    disabled={isRunning}
                  >
                    {token}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                مثال: مرحباً {'{name}'} — هذا تذكير رقم {'{index}'}/{'{total}'} بتاريخ {'{date}'}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              ملاحظة: النظام يفتح المحادثات مع الرسالة (يدعم الإيموجي ✅)، وواتساب يتطلب منك الضغط
              على زر الإرسال.
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">
              المهلة بين كل فتح (ثواني)
            </label>
            <Input
              type="number"
              min={8}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              disabled={isRunning}
            />

            <label className="block text-sm font-bold text-slate-800 dark:text-white mt-4 mb-2">
              الحد الأقصى لكل دفعة
            </label>
            <Input
              type="number"
              min={1}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={maxPerRun}
              onChange={(e) => setMaxPerRun(Number(e.target.value))}
              disabled={isRunning}
            />

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={useJitter}
                onChange={(e) => setUseJitter(e.target.checked)}
                disabled={isRunning}
              />
              تذبذب عشوائي للمهلة (موصى به)
            </label>

            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              هذه إعدادات لتقليل المخاطر، ولا يوجد ضمان ضد تقييد واتساب.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={handleStart}
                leftIcon={<PlayCircle size={18} />}
                disabled={isRunning}
              >
                بدء
              </Button>
              <Button
                variant="secondary"
                onClick={handleStop}
                leftIcon={<PauseCircle size={18} />}
                disabled={!isRunning}
              >
                إيقاف
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">التقدم</div>
              <div className="font-bold text-slate-800 dark:text-white">
                {progress.done} / {progress.total}
              </div>
              {progress.currentName ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  الحالي: {progress.currentName}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="app-card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <MessageCircle size={18} />
            جهات الاتصال
          </div>
          <div className="flex items-center gap-2">
            <PaginationControls
              page={contactsPage}
              pageCount={contactsPageCount}
              onPageChange={setContactsPage}
            />
            <Button
              variant="secondary"
              onClick={toggleSelectAll}
              disabled={isRunning || contacts.length === 0}
            >
              تحديد/إلغاء الكل
            </Button>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">
            لا توجد بيانات أشخاص لعرضها
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[520px] overflow-auto">
            {visibleContacts.map((c) => {
              const phone = normalizePhoneLoose(c.phone) || normalizePhoneLoose(c.extraPhone);
              const disabled = !phone;
              const checked = !!selected[c.id];

              return (
                <label
                  key={c.id}
                  className={`flex items-center justify-between gap-3 p-4 cursor-pointer ${
                    disabled ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => (!disabled && !isRunning ? toggleSelect(c.id) : undefined)}
                      disabled={disabled || isRunning}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-white truncate">
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr truncate">
                        {c.phone || c.extraPhone || 'لا يوجد رقم'}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                    {disabled ? 'بدون رقم' : 'جاهز'}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

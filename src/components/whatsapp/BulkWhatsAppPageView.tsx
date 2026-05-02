import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileEdit, MessageCircle, PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BulkWhatsAppSmartFilterBar } from './BulkWhatsAppSmartFilterBar';
import { UseBulkWhatsAppReturn, normalizePhoneLoose } from '@/hooks/useBulkWhatsApp';
import { PageLayout } from '@/components/shared/PageLayout';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { ROUTE_PATHS } from '@/routes/paths';
import { buildSettingsMessageTemplatesHref } from '@/services/messageTemplateSourceGroups';

interface BulkWhatsAppPageViewProps {
  page: UseBulkWhatsAppReturn;
}

export const BulkWhatsAppPageView: React.FC<BulkWhatsAppPageViewProps> = ({ page }) => {
  const {
    contacts, q, setQ, selectedIds, selected, toggleSelect, toggleSelectAll, visibleContacts,
    message, setMessage, delaySeconds, setDelaySeconds, useJitter, setUseJitter, maxPerRun, setMaxPerRun,
    templates, selectedTemplateId, handleSelectTemplate, templateName, setTemplateName,
    isRunning, progress, handleStart, handleStop, handleInsertToken, handleSaveTemplate, handleNewMessage,
    contactsPage, setContactsPage, contactsPageCount
  } = page;

  /** قوالب النظام (KV) — منفصلة عن «رسائل محفوظة» المحلية (`bulk_whatsapp_templates_v1`). */
  const settingsKvTemplatesHref = useMemo(() => buildSettingsMessageTemplatesHref({}), []);

  return (
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="إرسال واتساب جماعي"
        description="اكتب رسالة وافتح محادثات واتساب لعدة جهات اتصال مع مهلة بين كل فتح"
        icon={<MessageCircle size={32} />}
      />

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-300">
          «رسائل محفوظة» أعلاه تُحفظ محلياً لهذه الشاشة. قوالب التنبيهات والواتساب الموحّدة (تذكير، تحصيل، تجديد، …)
          تُعدَّل من الإعدادات أو من تبويب القوالب في مركز التنبيهات.
        </p>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Link
            to={settingsKvTemplatesHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <FileEdit size={13} />
            الإعدادات → قوالب الرسائل
          </Link>
          <Link
            to={ROUTE_PATHS.ALERTS_TEMPLATES}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-black text-indigo-800 transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
          >
            <ExternalLink size={13} />
            محرّر القوالب (التنبيهات)
          </Link>
        </div>
      </div>

      <BulkWhatsAppSmartFilterBar
        q={q}
        setQ={setQ}
        onToggleSelectAll={toggleSelectAll}
        selectedCount={selectedIds.length}
        totalCount={contacts.length}
        currentPage={contactsPage}
        pageCount={contactsPageCount}
        onPageChange={setContactsPage}
        isRunning={isRunning}
      />

      <div className="mt-6 space-y-6">
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
    </PageLayout>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { Download, MessageCircle, Phone, Users } from 'lucide-react';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ExpandableText } from '@/components/ui/ExpandableText';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { UseContactsReturn, PersonRow, normalizePhone, contactRoleLabelKey } from '@/hooks/useContacts';

const ContactsGroupCard: React.FC<{
  title: string;
  titleRaw?: string;
  list: PersonRow[];
  onCall: (phone?: string, extraPhone?: string) => void;
  onWhatsApp: (phone?: string, extraPhone?: string) => void;
  t: (s: string) => string;
}> = ({ title, titleRaw, list, onCall, onWhatsApp, t }) => {
  const pageSize = useResponsivePageSize({ base: 8, sm: 10, md: 12, lg: 16, xl: 20, '2xl': 24 });
  const [page, setPage] = useState(1);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((list?.length || 0) / pageSize)),
    [list?.length, pageSize]
  );

  const groupKey = titleRaw ?? title;
  useEffect(() => {
    setPage(1);
  }, [groupKey, list?.length, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (list || []).slice(start, start + pageSize);
  }, [list, page, pageSize]);

  return (
    <div className="app-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-slate-700">
        <div className="font-black text-slate-800 dark:text-white" title={titleRaw || title}>
          {title}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Users size={16} />
            {list.length}
          </div>
          <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="p-6 text-center text-slate-600 dark:text-slate-400">
          {t('لا توجد بيانات')}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {visible.map((r) => {
            const hasPhone = !!(normalizePhone(r.phone) || normalizePhone(r.extraPhone));
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-white">
                    <ExpandableText
                      value={r.name}
                      title={t('الاسم')}
                      dir="auto"
                      previewChars={38}
                    />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr">
                    <ExpandableText
                      value={r.phone || t('لا يوجد رقم')}
                      title={t('رقم الهاتف')}
                      dir="ltr"
                      previewChars={22}
                    />
                  </div>
                  {r.extraPhone ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr">
                      <ExpandableText
                        value={r.extraPhone}
                        title={t('رقم إضافي')}
                        dir="ltr"
                        previewChars={22}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onCall(r.phone, r.extraPhone)}
                    disabled={!hasPhone}
                    className={`px-3 py-2 rounded-lg border text-sm font-bold transition flex items-center gap-2 ${
                      hasPhone
                        ? 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        : 'border-gray-200 dark:border-slate-700 opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-400'
                    }`}
                    title={hasPhone ? t('اتصال') : t('لا يوجد رقم هاتف')}
                  >
                    <Phone size={16} />
                    {t('اتصال')}
                  </button>

                  <button
                    type="button"
                    onClick={() => onWhatsApp(r.phone, r.extraPhone)}
                    disabled={!hasPhone}
                    className={`px-3 py-2 rounded-lg border text-sm font-bold transition flex items-center gap-2 ${
                      hasPhone
                        ? 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        : 'border-gray-200 dark:border-slate-700 opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-400'
                    }`}
                    title={hasPhone ? t('إرسال رسالة واتساب') : t('لا يوجد رقم هاتف')}
                  >
                    <MessageCircle size={16} />
                    {t('واتساب')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ContactsPageViewProps {
  page: UseContactsReturn;
}

export const ContactsPageView: React.FC<ContactsPageViewProps> = ({ page }) => {
  const {
    t, rows, grouped, importRef,
    handleCall, handleWhatsApp, handleExport, handleDownloadTemplate, handlePickImportFile, handleImportChange, handleOpenBulkWhatsApp
  } = page;

  return (
    <div className="space-y-6">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>{t('اتصالات')}</h2>
          <p className={DS.components.pageSubtitle}>
            {t('سجل هاتف مُستمد من الأشخاص مع اتصال وواتساب')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            aria-label={t('استيراد ملف الاتصالات')}
            title={t('استيراد ملف الاتصالات')}
            onChange={handleImportChange}
          />

          <Button
            variant="secondary"
            onClick={handlePickImportFile}
            leftIcon={<Download size={18} />}
          >
            {t('استيراد')}
          </Button>
          <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18} />}>
            {t('تصدير')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            leftIcon={<Download size={18} />}
          >
            {t('نموذج الاستيراد')}
          </Button>

          <Button
            variant="secondary"
            onClick={handleOpenBulkWhatsApp}
            leftIcon={<MessageCircle size={18} />}
          >
            {t('واتساب جماعي')}
          </Button>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 ms-2">
            <Users size={16} />
            {rows.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {grouped.roleSections.map((sec) => (
          <ContactsGroupCard
            key={sec.role}
            title={t(contactRoleLabelKey(sec.role) || sec.role)}
            titleRaw={sec.role}
            list={sec.list}
            onCall={handleCall}
            onWhatsApp={handleWhatsApp}
            t={t}
          />
        ))}
        <ContactsGroupCard
          title={t('بدون دور')}
          list={grouped.noRole}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          t={t}
        />
        <ContactsGroupCard
          title={t('محليين')}
          list={grouped.locals}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          t={t}
        />
      </div>
    </div>
  );
};

/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Contacts - phonebook-like view powered by People
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, MessageCircle, Phone, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { useSmartModal } from '@/context/ModalContext';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ExpandableText } from '@/components/ui/ExpandableText';

type PersonRow = {
  id: string;
  name: string;
  phone?: string;
  extraPhone?: string;
  source?: 'person' | 'local';
  roles?: string[];
};

const toRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

const normalizePhone = (raw?: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';

  // Remove control chars (incl. bidi control chars) and whitespace
  const controlAndBidiChars = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
  const noControls = value.replace(controlAndBidiChars, '');
  const compact = noControls.replace(/\s+/g, '');

  // Keep digits and a single leading + only
  const cleaned = compact.replace(/(?!^)\+/g, '').replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // E.164 max is 15 digits; minimum here is conservative to avoid junk.
  if (digits.length < 6 || digits.length > 15) return '';

  return cleaned.startsWith('+') ? `+${digits}` : digits;
};

const contactRoleLabelKey = (roleRaw: unknown): string => {
  const raw = String(roleRaw ?? '').trim();
  if (!raw) return '';

  // Preserve Arabic roles as-is.
  if (/\p{Script=Arabic}/u.test(raw)) return raw;

  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    owner: 'مالك',
    landlord: 'مالك',
    tenant: 'مستأجر',
    guarantor: 'كفيل',
    broker: 'وسيط',
    agent: 'وسيط',
    client: 'عميل',
    customer: 'عميل',
    supplier: 'مورد',
  };

  if (map[key]) return map[key];

  // Humanize common code-ish formats.
  const humanized = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return humanized || raw;
};

const ContactsGroupCard: React.FC<{
  title: string;
  titleRaw?: string;
  list: PersonRow[];
  onCall: (phone?: string, extraPhone?: string) => void;
  onWhatsApp: (phone?: string, extraPhone?: string) => void;
}> = ({ title, titleRaw, list, onCall, onWhatsApp }) => {
  const { t } = useTranslation();
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
        <div
          className="font-black text-slate-800 dark:text-white"
          title={titleRaw || title}
        >
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
        <div className="p-6 text-center text-slate-600 dark:text-slate-400">{t('لا توجد بيانات')}</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {visible.map((r) => {
            const hasPhone = !!(normalizePhone(r.phone) || normalizePhone(r.extraPhone));
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-white">
                    <ExpandableText value={r.name} title={t('الاسم')} dir="auto" previewChars={38} />
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

export const Contacts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [directory, setDirectory] = useState<PersonRow[]>([]);
  const importRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const dbSignal = useDbSignal();

  const reload = () => {
    try {
      const rows = (DbService.getContactsDirectory?.() || []) as PersonRow[];
      setDirectory(rows);
    } catch {
      setDirectory([]);
    }
  };

  useEffect(() => {
    reload();
  }, [dbSignal]);

  const rows: PersonRow[] = useMemo(() => {
    return (directory || [])
      .map((r) => {
        const rec = toRecord(r);
        const sourceRaw = String(rec.source || '').trim();
        const source: PersonRow['source'] | undefined =
          sourceRaw === 'local' ? 'local' : sourceRaw === 'person' ? 'person' : undefined;
        const rolesRaw = rec.roles;
        const roles = Array.isArray(rolesRaw)
          ? (rolesRaw as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
          : undefined;
        return {
          id: String(rec.id ?? rec.phone ?? rec.name ?? ''),
          name: String(rec.name || '').trim() || t('غير محدد'),
          phone: String(rec.phone || '').trim() || undefined,
          extraPhone: String(rec.extraPhone || '').trim() || undefined,
          source,
          roles,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [directory, t]);

  const grouped = useMemo(() => {
    const locals: PersonRow[] = [];
    const noRole: PersonRow[] = [];
    const roleGroups = new Map<string, PersonRow[]>();

    const addToRole = (role: string, row: PersonRow) => {
      const key = String(role || '').trim();
      if (!key) return;
      const list = roleGroups.get(key) || [];
      list.push(row);
      roleGroups.set(key, list);
    };

    for (const r of rows) {
      if (r.source === 'local') {
        locals.push(r);
        continue;
      }

      const roles = (r.roles || []).map((x) => String(x || '').trim()).filter(Boolean);
      if (roles.length === 0) {
        noRole.push(r);
        continue;
      }

      // A person may have multiple roles; show them under each role.
      for (const role of roles) addToRole(role, r);
    }

    const roleSections = Array.from(roleGroups.entries())
      .map(([role, list]) => ({ role, list: list.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.role.localeCompare(b.role));

    return {
      roleSections,
      locals: locals.sort((a, b) => a.name.localeCompare(b.name)),
      noRole: noRole.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [rows]);

  const handleCall = (phone?: string, extraPhone?: string) => {
    const normalized = normalizePhone(phone) || normalizePhone(extraPhone);
    if (!normalized) {
      toast.warning(t('رقم الهاتف غير صالح'));
      return;
    }
    // In desktop environments, this will use the OS handler if available.
    window.location.href = `tel:${normalized}`;
  };

  const handleWhatsApp = (phone?: string, extraPhone?: string) => {
    const p1 = normalizePhone(phone);
    const p2 = normalizePhone(extraPhone);
    if (!p1 && !p2) return;
    void openWhatsAppForPhones('', [p1, p2], { defaultCountryCode: getDefaultWhatsAppCountryCodeSync(), delayMs: 10_000 });
  };

  const handleExport = async () => {
    if (rows.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    const outRows = rows.map((r) => ({
      Name: r.name,
      Phone: r.phone || '',
      ExtraPhone: r.extraPhone || '',
    }));

    await exportToXlsx(
      'Contacts',
      [
        { key: 'Name', header: 'Name' },
        { key: 'Phone', header: 'Phone' },
        { key: 'ExtraPhone', header: 'ExtraPhone' },
      ],
      outRows,
      `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );

    DbService.logEvent('User', 'Export', 'Contacts', `Exported ${rows.length} records`);
    toast.success(t('تم تصدير البيانات بنجاح'));
  };

  const handleDownloadTemplate = async () => {
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    const isEn = String(i18n.language || '').toLowerCase().startsWith('en');
    await exportToXlsx(
      'Contacts',
      [
        { key: 'Name', header: 'Name' },
        { key: 'Phone', header: 'Phone' },
        { key: 'ExtraPhone', header: 'ExtraPhone' },
      ],
      [
        {
          Name: isEn ? 'Example: Ahmed Mohammad' : 'مثال: أحمد محمد',
          Phone: '0790000000',
          ExtraPhone: '',
        },
      ],
      'contacts_template.xlsx',
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );
    toast.success(t('تم تنزيل قالب الاستيراد'));
  };

  const handlePickImportFile = () => {
    importRef.current?.click();
  };

  const handleImportFile = async (file: File) => {
    const ok = await toast.confirm({
      title: t('استيراد الاتصالات'),
      message: t(
        'سيتم استيراد الأسماء وأرقام الهواتف وإضافة الجديد وتحديث الموجود حسب رقم الهاتف. هل تريد المتابعة؟'
      ),
      confirmText: t('متابعة'),
      cancelText: t('إلغاء'),
    });
    if (!ok) return;

    let sheetRows: Array<Record<string, string>> = [];
    try {
      sheetRows = await readSpreadsheet(file);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(toRecord(e).message || '').trim();
      toast.error(msg || t('فشل قراءة ملف الاستيراد'));
      return;
    }

    if (!sheetRows.length) {
      toast.warning(t('الملف فارغ'));
      return;
    }

    const pick = (row: Record<string, string>, keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of sheetRows) {
      const name = pick(row, ['Name', 'الاسم', 'اسم']);
      const phoneRaw = pick(row, ['Phone', 'رقم_الهاتف', 'الهاتف']);
      const extraPhoneRaw = pick(row, [
        'ExtraPhone',
        'رقم_هاتف_اضافي',
        'الهاتف_الاضافي',
        'رقم_هاتف_آخر',
      ]);

      const phone = normalizePhone(phoneRaw);
      const extraPhone = normalizePhone(extraPhoneRaw);

      if (!name || !phone) {
        skipped++;
        continue;
      }

      const res = DbService.upsertContact?.({
        name,
        phone,
        extraPhone: extraPhone || undefined,
      });
      const resRec = toRecord(res);
      if (!resRec.success) {
        skipped++;
        continue;
      }
      const dataRec = toRecord(resRec.data);
      if (dataRec.created) created++;
      else updated++;
    }

    reload();
    toast.success(
      t('تم الاستيراد: إضافة {{created}} • تحديث {{updated}} • تخطي {{skipped}}', {
        created,
        updated,
        skipped,
      })
    );
  };

  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) void handleImportFile(file);
    e.target.value = '';
  };

  const handleOpenBulkWhatsApp = () => {
    openPanel('BULK_WHATSAPP');
  };

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
          />
        ))}
        <ContactsGroupCard
          title={t('بدون دور')}
          list={grouped.noRole}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
        />
        <ContactsGroupCard
          title={t('محليين')}
          list={grouped.locals}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
        />
      </div>
    </div>
  );
};

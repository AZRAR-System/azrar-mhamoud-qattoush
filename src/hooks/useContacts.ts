import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { useSmartModal } from '@/context/ModalContext';
import { useDbSignal } from '@/hooks/useDbSignal';

export type PersonRow = {
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
  const controlAndBidiChars = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
  const noControls = value.replace(controlAndBidiChars, '');
  const compact = noControls.replace(/\s+/g, '');
  const cleaned = compact.replace(/(?!^)\+/g, '').replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 6 || digits.length > 15) return '';
  return cleaned.startsWith('+') ? `+${digits}` : digits;
};

const contactRoleLabelKey = (roleRaw: unknown): string => {
  const raw = String(roleRaw ?? '').trim();
  if (!raw) return '';
  if (/\p{Script=Arabic}/u.test(raw)) return raw;
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    owner: 'مالك', landlord: 'مالك', tenant: 'مستأجر', guarantor: 'كفيل',
    broker: 'وسيط', agent: 'وسيط', client: 'عميل', customer: 'عميل', supplier: 'مورد',
  };
  if (map[key]) return map[key];
  const humanized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return humanized || raw;
};

export function useContacts() {
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

  useEffect(() => { reload(); }, [dbSignal]);

  const rows = useMemo(() => {
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
          source, roles,
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
      if (r.source === 'local') { locals.push(r); continue; }
      const roles = (r.roles || []).map((x) => String(x || '').trim()).filter(Boolean);
      if (roles.length === 0) { noRole.push(r); continue; }
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
    if (!normalized) { toast.warning(t('رقم الهاتف غير صالح')); return; }
    window.location.href = `tel:${normalized}`;
  };

  const handleWhatsApp = (phone?: string, extraPhone?: string) => {
    const p1 = normalizePhone(phone);
    const p2 = normalizePhone(extraPhone);
    if (!p1 && !p2) return;
    void openWhatsAppForPhones('', [p1, p2], {
      defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
      delayMs: 10_000,
    });
  };

  const handleExport = async () => {
    if (rows.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    const outRows = rows.map((r) => ({
      Name: r.name, Phone: r.phone || '', ExtraPhone: r.extraPhone || '',
    }));
    await exportToXlsx(
      'Contacts',
      [{ key: 'Name', header: 'Name' }, { key: 'Phone', header: 'Phone' }, { key: 'ExtraPhone', header: 'ExtraPhone' }],
      outRows,
      `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      { extraSheets: companySheet ? [companySheet] : [] }
    );
    DbService.logEvent('User', 'Export', 'Contacts', `Exported ${rows.length} records`, 'export');
    toast.success(t('تم تصدير البيانات بنجاح'));
  };

  const handleDownloadTemplate = async () => {
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    const isEn = String(i18n.language || '').toLowerCase().startsWith('en');
    await exportToXlsx(
      'Contacts',
      [{ key: 'Name', header: 'Name' }, { key: 'Phone', header: 'Phone' }, { key: 'ExtraPhone', header: 'ExtraPhone' }],
      [{
        Name: isEn ? 'Example: Ahmed Mohammad' : 'مثال: أحمد محمد',
        Phone: '0790000000', ExtraPhone: '',
      }],
      'contacts_template.xlsx',
      { extraSheets: companySheet ? [companySheet] : [] }
    );
    toast.success(t('تم تنزيل قالب الاستيراد'));
  };

  const handlePickImportFile = () => { importRef.current?.click(); };

  const handleImportFile = async (file: File) => {
    const ok = await toast.confirm({
      title: t('استيراد الاتصالات'),
      message: t('سيتم استيراد الأسماء وأرقام الهواتف وإضافة الجديد وتحديث الموجود حسب رقم الهاتف. هل تريد المتابعة؟'),
      confirmText: t('متابعة'), cancelText: t('إلغاء'),
    });
    if (!ok) return;
    let sheetRows: Array<Record<string, string>> = [];
    try { sheetRows = await readSpreadsheet(file); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(toRecord(e).message || '').trim();
      toast.error(msg || t('فشل قراءة ملف الاستيراد')); return;
    }
    if (!sheetRows.length) { toast.warning(t('الملف فارغ')); return; }
    const pick = (row: Record<string, string>, keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    let created = 0, updated = 0, skipped = 0;
    for (const row of sheetRows) {
      const name = pick(row, ['Name', 'الاسم', 'اسم']);
      const phoneRaw = pick(row, ['Phone', 'رقم_الهاتف', 'الهاتف']);
      const extraPhoneRaw = pick(row, ['ExtraPhone', 'رقم_هاتف_اضافي', 'الهاتف_الاضافي', 'رقم_هاتف_آخر']);
      const phone = normalizePhone(phoneRaw);
      const extraPhone = normalizePhone(extraPhoneRaw);
      if (!name || !phone) { skipped++; continue; }
      const res = DbService.upsertContact?.({ name, phone, extraPhone: extraPhone || undefined });
      const resRec = toRecord(res);
      if (!resRec.success) { skipped++; continue; }
      const dataRec = toRecord(resRec.data);
      if (dataRec.created) created++; else updated++;
    }
    reload();
    toast.success(t('تم الاستيراد: إضافة {{created}} • تحديث {{updated}} • تخطي {{skipped}}', { created, updated, skipped }));
  };

  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) void handleImportFile(file);
    e.target.value = '';
  };

  const handleOpenBulkWhatsApp = () => { openPanel('BULK_WHATSAPP'); };

  return {
    t, i18n, rows, grouped, importRef,
    handleCall, handleWhatsApp, handleExport, handleDownloadTemplate, handlePickImportFile, handleImportChange, handleOpenBulkWhatsApp,
  };
}

export type UseContactsReturn = ReturnType<typeof useContacts>;

export { normalizePhone, contactRoleLabelKey };

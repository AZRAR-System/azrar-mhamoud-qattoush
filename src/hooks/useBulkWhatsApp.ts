import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DbService } from '@/services/mockDb';
import { buildWhatsAppLink, collectWhatsAppPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { openExternalUrl } from '@/utils/externalLink';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';

export type ContactItem = {
  id: string;
  name: string;
  phone?: string;
  extraPhone?: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
};

const STORAGE_KEYS = {
  templates: 'bulk_whatsapp_templates_v1',
  draft: 'bulk_whatsapp_draft_v1',
} as const;

/* ── Helpers extracted from the original file ── */

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizePhoneLoose = (raw?: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';
  const cleaned = value
    .replace(/\s+/g, '')
    .replace(/(?!^)\+/g, '')
    .replace(/[^\d+]/g, '');
  return cleaned;
};

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

const clampInt = (n: unknown, min: number, max: number): number => {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.trunc(x)));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getValue = (obj: unknown, key: string): unknown => (isRecord(obj) ? obj[key] : undefined);

const randBetween = (min: number, max: number): number => {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.random() * (b - a);
};

const formatYmd = (d: Date): string => {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const applyTemplateVars = (template: string, vars: Record<string, string | number>): string => {
  let out = String(template ?? '');
  const entries = Object.entries(vars);
  for (const [k, v] of entries) {
    const value = String(v ?? '');
    // Support {key} and Arabic aliases for common ones.
    const tokens = [
      `{${k}}`,
      k === 'name' ? '{الاسم}' : '',
      k === 'phone' ? '{الهاتف}' : '',
      k === 'index' ? '{الترتيب}' : '',
      k === 'total' ? '{الاجمالي}' : '',
      k === 'date' ? '{التاريخ}' : '',
    ].filter(Boolean);

    for (const t of tokens) {
      out = out.split(t).join(value);
    }
  }
  return out;
};

/* ── Hook ── */

export function useBulkWhatsApp() {
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const dbSignal = useDbSignal();

  // Guard
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    const allowed = ['superadmin', 'admin', 'manager'];
    if (!allowed.includes(role)) {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const [contactsList, setContactsList] = useState<ContactItem[]>([]);
  const [q, setQ]              = useState<string>('');
  const [message, setMessage]              = useState<string>('');
  const [delaySeconds, setDelaySeconds]    = useState<number>(10);
  const [useJitter, setUseJitter]          = useState<boolean>(true);
  const [maxPerRun, setMaxPerRun]          = useState<number>(30);
  const [selected, setSelected]            = useState<Record<string, boolean>>({});

  const [templates, setTemplates]                  = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName]            = useState<string>('');

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress]   = useState({ total: 0, done: 0, currentName: '' });

  const cancelRef = useRef(false);

  useEffect(() => {
    try {
      const dir = (DbService.getContactsDirectory?.() || []) as ContactItem[];
      setContactsList(dir);
    } catch {
      setContactsList([]);
    }
  }, [dbSignal]);

  useEffect(() => {
    const loadedTemplates = safeJsonParse<MessageTemplate[]>(
      localStorage.getItem(STORAGE_KEYS.templates),
      []
    );
    setTemplates(Array.isArray(loadedTemplates) ? loadedTemplates : []);

    const draft = String(localStorage.getItem(STORAGE_KEYS.draft) || '');
    if (draft && !message) setMessage(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.draft, String(message ?? ''));
    } catch {
      // ignore
    }
  }, [message]);

  const contacts = useMemo(() => {
    const raw = (contactsList || [])
      .map((c: unknown) => {
        const idLike = getValue(c, 'id') ?? getValue(c, 'phone') ?? getValue(c, 'name') ?? '';
        const nameLike = getValue(c, 'name') ?? '';
        const phoneLike = getValue(c, 'phone') ?? '';
        const extraPhoneLike = getValue(c, 'extraPhone') ?? '';

        return {
          id: String(idLike),
          name: String(nameLike).trim() || 'غير محدد',
          phone: String(phoneLike).trim() || undefined,
          extraPhone: String(extraPhoneLike).trim() || undefined,
        } as ContactItem;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!q.trim()) return raw;
    const search = q.toLowerCase().trim();
    return raw.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.phone && c.phone.includes(search)) || 
      (c.extraPhone && c.extraPhone.includes(search))
    );
  }, [contactsList, q]);

  const contactsPageSize = useResponsivePageSize({
    base: 10, sm: 14, md: 20, lg: 24, xl: 30, '2xl': 40,
  });
  const [contactsPage, setContactsPage] = useState(1);
  const contactsPageCount = useMemo(
    () => Math.max(1, Math.ceil((contacts.length || 0) / contactsPageSize)),
    [contacts.length, contactsPageSize]
  );

  useEffect(() => { setContactsPage(1); }, [contactsPageSize, contacts.length]);
  useEffect(() => { setContactsPage((p) => Math.min(Math.max(1, p), contactsPageCount)); }, [contactsPageCount]);

  const visibleContacts = useMemo(() => {
    const start = (contactsPage - 1) * contactsPageSize;
    return contacts.slice(start, start + contactsPageSize);
  }, [contacts, contactsPage, contactsPageSize]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const allIds = contacts.map((c) => c.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected[id]);
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const id of allIds) next[id] = true;
    setSelected(next);
  };

  const buildRecipientList = () => {
    const idSet = new Set(selectedIds);
    const chosen = contacts.filter((c) => idSet.has(c.id));
    const seen = new Set<string>();
    const recipients: Array<{ name: string; phone: string }> = [];

    for (const c of chosen) {
      const p1 = normalizePhoneLoose(c.phone);
      const p2 = normalizePhoneLoose(c.extraPhone);
      const normalized = collectWhatsAppPhones([p1, p2], {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
      });
      const ph = normalized[0] || '';
      if (!ph) continue;
      if (seen.has(ph)) continue;
      seen.add(ph);
      recipients.push({ name: c.name, phone: ph });
    }
    return recipients;
  };

  const persistTemplates = (next: MessageTemplate[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateName(t.name);
    setMessage(t.text);
  };

  const handleNewMessage = () => {
    setSelectedTemplateId('');
    setTemplateName('');
    setMessage('');
  };

  const handleSaveTemplate = () => {
    const text = String(message || '').trim();
    if (!text) {
      toast.warning('لا يمكن حفظ رسالة فارغة');
      return;
    }
    const name = String(templateName || '').trim() || `رسالة ${new Date().toISOString().slice(0, 10)}`;
    const now = Date.now();
    const existingIndex = templates.findIndex((t) => t.id === selectedTemplateId);
    if (existingIndex >= 0) {
      const next = [...templates];
      next[existingIndex] = { ...next[existingIndex], name, text, updatedAt: now };
      persistTemplates(next);
      toast.success('تم تحديث الرسالة المحفوظة');
      return;
    }
    const id = `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const next = [{ id, name, text, updatedAt: now }, ...templates];
    persistTemplates(next);
    setSelectedTemplateId(id);
    toast.success('تم حفظ الرسالة');
  };

  const handleStart = async () => {
    if (isRunning) return;
    if (!message.trim()) {
      toast.warning('اكتب نص الرسالة أولاً');
      return;
    }
    const allRecipients = buildRecipientList();
    if (allRecipients.length === 0) {
      toast.warning('اختر جهات اتصال لديها رقم واتساب صالح');
      return;
    }
    const effectiveDelaySeconds = clampInt(delaySeconds, 8, 600);
    const cap = clampInt(maxPerRun, 1, 500);
    const recipients = allRecipients.slice(0, cap);

    if (effectiveDelaySeconds !== delaySeconds) {
      toast.info(`تم ضبط المهلة إلى ${effectiveDelaySeconds} ثانية كحد أدنى للسلامة`);
    }

    if (allRecipients.length > cap) {
      const okCap = await toast.confirm({
        title: 'تقسيم الحملة لتقليل المخاطر',
        message: `تم تحديد ${allRecipients.length} شخص. لتقليل خطر التقييد، سيتم تنفيذ هذه الدفعة لأول ${cap} فقط الآن. هل تريد المتابعة؟`,
        confirmText: 'متابعة',
        cancelText: 'إلغاء',
      });
      if (!okCap) return;
    }

    const baseDelayMs = effectiveDelaySeconds * 1000;
    const jitterMinMs = useJitter ? Math.max(0, Math.round(baseDelayMs * 0.8)) : baseDelayMs;
    const jitterMaxMs = useJitter ? Math.max(0, Math.round(baseDelayMs * 1.25)) : baseDelayMs;

    const ok = await toast.confirm({
      title: 'إرسال واتساب جماعي',
      message: `سيتم فتح ${recipients.length} محادثة واتساب بالتتابع مع مهلة ${effectiveDelaySeconds} ثانية${useJitter ? ' (مع تذبذب عشوائي بسيط)' : ''}. ستحتاج للضغط على زر الإرسال داخل واتساب. هل تريد المتابعة؟`,
      confirmText: 'بدء',
      cancelText: 'إلغاء',
    });
    if (!ok) return;

    cancelRef.current = false;
    setIsRunning(true);
    setProgress({ total: recipients.length, done: 0, currentName: '' });

    let opened = 0;
    try {
      for (let i = 0; i < recipients.length; i++) {
        if (cancelRef.current) break;
        const r = recipients[i];
        setProgress({ total: recipients.length, done: opened, currentName: r.name });
        const rendered = applyTemplateVars(message, {
          name: r.name, phone: r.phone, index: i + 1, total: recipients.length, date: formatYmd(new Date()),
        });
        const link = buildWhatsAppLink(rendered, r.phone, { defaultCountryCode: undefined, target: 'auto' });
        if (link) {
          openExternalUrl(link);
          opened++;
          setProgress({ total: recipients.length, done: opened, currentName: r.name });
        }
        if (i < recipients.length - 1 && baseDelayMs > 0) {
          const waitMs = useJitter ? Math.round(randBetween(jitterMinMs, jitterMaxMs)) : baseDelayMs;
          await sleep(waitMs);
        }
      }
    } finally {
      setIsRunning(false);
      setProgress((p) => ({ ...p, done: opened, currentName: '' }));
      cancelRef.current = false;
      if (opened > 0) DbService.logEvent('User', 'BulkWhatsApp', 'Contacts', `Opened ${opened} chats`, 'whatsapp_batch');
      if (opened > 0) toast.success(`تم فتح ${opened} محادثة واتساب`);
    }
  };

  const handleStop = () => { cancelRef.current = true; };

  const handleInsertToken = (token: string) => {
    const t = String(token || '').trim();
    if (!t) return;
    setMessage((prev) => {
      const base = String(prev ?? '');
      if (!base.trim()) return t;
      return base.endsWith(' ') ? `${base}${t}` : `${base} ${t}`;
    });
  };

  return {
    contacts, q, setQ, selectedIds, selected, toggleSelect, toggleSelectAll, visibleContacts,
    message, setMessage, delaySeconds, setDelaySeconds, useJitter, setUseJitter, maxPerRun, setMaxPerRun,
    templates, selectedTemplateId, handleSelectTemplate, templateName, setTemplateName,
    isRunning, progress, handleStart, handleStop, handleInsertToken, handleSaveTemplate, handleNewMessage,
    contactsPage, setContactsPage, contactsPageCount,
  };
}

export type UseBulkWhatsAppReturn = ReturnType<typeof useBulkWhatsApp>;

/* ── Exported helpers needed for View ── */
export { normalizePhoneLoose };

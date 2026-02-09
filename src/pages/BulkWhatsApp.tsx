/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Bulk WhatsApp - open multiple chats with a custom message
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, PauseCircle, PlayCircle, Users } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import { buildWhatsAppLink, collectWhatsAppPhones } from '@/utils/whatsapp';
import { openExternalUrl } from '@/utils/externalLink';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { PaginationControls } from '@/components/shared/PaginationControls';

type ContactItem = {
  id: string;
  name: string;
  phone?: string;
  extraPhone?: string;
};

type MessageTemplate = {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
};

const STORAGE_KEYS = {
  templates: 'bulk_whatsapp_templates_v1',
  draft: 'bulk_whatsapp_draft_v1',
} as const;

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
  const cleaned = value.replace(/\s+/g, '').replace(/(?!^)\+/g, '').replace(/[^\d+]/g, '');
  return cleaned;
};

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

const clampInt = (n: unknown, min: number, max: number): number => {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.trunc(x)));
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

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

const applyTemplateVars = (
  template: string,
  vars: Record<string, string | number>
): string => {
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

export const BulkWhatsApp: React.FC = () => {
  const toast = useToast();

  const dbSignal = useDbSignal();

  const [contactsList, setContactsList] = useState<ContactItem[]>([]);
  const [message, setMessage] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [useJitter, setUseJitter] = useState<boolean>(true);
  const [maxPerRun, setMaxPerRun] = useState<number>(30);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ total: 0, done: 0, currentName: '' });

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
    const loadedTemplates = safeJsonParse<MessageTemplate[]>(localStorage.getItem(STORAGE_KEYS.templates), []);
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

  const contacts: ContactItem[] = useMemo(() => {
    return (contactsList || [])
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
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contactsList]);

  const contactsPageSize = useResponsivePageSize({ base: 10, sm: 14, md: 20, lg: 24, xl: 30, '2xl': 40 });
  const [contactsPage, setContactsPage] = useState(1);
  const contactsPageCount = useMemo(
    () => Math.max(1, Math.ceil((contacts.length || 0) / contactsPageSize)),
    [contacts.length, contactsPageSize]
  );

  useEffect(() => {
    setContactsPage(1);
  }, [contactsPageSize, contacts.length]);

  useEffect(() => {
    setContactsPage((p) => Math.min(Math.max(1, p), contactsPageCount));
  }, [contactsPageCount]);

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

    // One chat per contact (use primary phone, else extra phone).
    const seen = new Set<string>();
    const recipients: Array<{ name: string; phone: string }> = [];

    for (const c of chosen) {
      const p1 = normalizePhoneLoose(c.phone);
      const p2 = normalizePhoneLoose(c.extraPhone);
      const normalized = collectWhatsAppPhones([p1, p2], { defaultCountryCode: '962' });
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

    // Safeguards (risk reduction only; WhatsApp may still limit accounts).
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
          name: r.name,
          phone: r.phone,
          index: i + 1,
          total: recipients.length,
          date: formatYmd(new Date()),
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
      if (opened > 0) DbService.logEvent('User', 'BulkWhatsApp', 'Contacts', `Opened ${opened} chats`);
      if (opened > 0) toast.success(`تم فتح ${opened} محادثة واتساب`);
    }
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const handleInsertToken = (token: string) => {
    const t = String(token || '').trim();
    if (!t) return;
    setMessage((prev) => {
      const base = String(prev ?? '');
      if (!base.trim()) return t;
      return base.endsWith(' ') ? `${base}${t}` : `${base} ${t}`;
    });
  };

  return (
    <div className="space-y-6">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>إرسال واتساب جماعي</h2>
          <p className={DS.components.pageSubtitle}>اكتب رسالة وافتح محادثات واتساب لعدة جهات اتصال مع مهلة بين كل فتح</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Users size={16} />
          {selectedIds.length} / {contacts.length}
        </div>
      </div>

      <div className="app-card p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">نص الرسالة</label>

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
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none h-28"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="مثال: تهنئة ..."
              disabled={isRunning}
            />

            <div className="mt-3 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">متغيرات يمكنك استخدامها داخل الرسالة</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleInsertToken('{name}')} disabled={isRunning}>
                  {'{name}'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleInsertToken('{phone}')} disabled={isRunning}>
                  {'{phone}'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleInsertToken('{index}')} disabled={isRunning}>
                  {'{index}'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleInsertToken('{total}')} disabled={isRunning}>
                  {'{total}'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleInsertToken('{date}')} disabled={isRunning}>
                  {'{date}'}
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                مثال: مرحباً {"{name}"} — هذا تذكير رقم {"{index}"}/{"{total}"} بتاريخ {"{date}"}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              ملاحظة: النظام يفتح المحادثات مع الرسالة (يدعم الإيموجي ✅)، وواتساب يتطلب منك الضغط على زر الإرسال.
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">المهلة بين كل فتح (ثواني)</label>
            <Input
              type="number"
              min={8}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              disabled={isRunning}
            />

            <label className="block text-sm font-bold text-slate-800 dark:text-white mt-4 mb-2">الحد الأقصى لكل دفعة</label>
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
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">الحالي: {progress.currentName}</div>
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
            <PaginationControls page={contactsPage} pageCount={contactsPageCount} onPageChange={setContactsPage} />
            <Button variant="secondary" onClick={toggleSelectAll} disabled={isRunning || contacts.length === 0}>
              تحديد/إلغاء الكل
            </Button>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">لا توجد بيانات أشخاص لعرضها</div>
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
                      <div className="font-bold text-slate-800 dark:text-white truncate">{c.name}</div>
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

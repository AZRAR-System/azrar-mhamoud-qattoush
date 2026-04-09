import { get, save } from '../kv';
import { KEYS } from '../keys';
import { 
  LegalNoticeTemplate, 
  LegalNoticeRecord, 
  العقود_tbl, 
  العقارات_tbl, 
  الأشخاص_tbl, 
  الكمبيالات_tbl, 
  DbResult 
} from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { toDateOnly, parseDateOnly, daysBetweenDateOnly } from '../utils/dates';
import { getInstallmentPaidAndRemaining } from '../installments';
import { getMessageGlobalContext } from '@/utils/messageGlobalContext';

export type LegalDeps = {
  logOperation: (user: string, action: string, table: string, id: string, msg: string) => void;
};

export const getLegalTemplates = () => get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES);

export const getLegalNoticeHistory = () => get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);

export function createLegalHandlers(deps: LegalDeps) {
  const { logOperation } = deps;
  const fail = dbFail;
  const ok = dbOk;

  const addLegalTemplate = (t: Partial<LegalNoticeTemplate>): DbResult<null> => {
    const all = getLegalTemplates();
    save(KEYS.LEGAL_TEMPLATES, [...all, { ...t, id: `LNT-${Date.now()}` } as LegalNoticeTemplate]);
    return ok();
  };

  const deleteLegalTemplate = (id: string) => {
    const all = getLegalTemplates();
    save(KEYS.LEGAL_TEMPLATES, all.filter((t) => t.id !== id));
  };

  const updateLegalTemplate = (id: string, patch: Partial<LegalNoticeTemplate>) => {
    const all = getLegalTemplates();
    const idx = all.findIndex((t) => t.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.LEGAL_TEMPLATES, all);
    }
  };

  const generateLegalNotice = (
    tmplId: string,
    contractId: string,
    ctx?: {
      date?: string;
      time?: string;
      extra?: Record<string, string | number | null | undefined>;
    }
  ): string | null => {
    const tmpl = getLegalTemplates().find((t) => t.id === tmplId);
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
    if (!tmpl || !contract) return null;

    const property = get<العقارات_tbl>(KEYS.PROPERTIES).find((p) => p.رقم_العقار === contract.رقم_العقار);
    const tenant = get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const owner = property?.رقم_المالك ? get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === property.رقم_المالك) : undefined;

    const today = toDateOnly(new Date());
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد === contractId);
    const installmentsWithRemaining = installments.map((inst) => {
      const due = parseDateOnly(String(inst.تاريخ_استحقاق || ''));
      const remaining = getInstallmentPaidAndRemaining(inst).remaining;
      return { inst, due, remaining };
    }).filter((x) => x.remaining > 0);

    const overdue = installmentsWithRemaining.filter((x) => x.due && daysBetweenDateOnly(x.due, today) > 0).sort((a, b) => (a.due?.getTime() || 0) - (b.due?.getTime() || 0));
    const totalRemaining = Math.round(installmentsWithRemaining.reduce((sum, x) => sum + (x.remaining || 0), 0));
    const overdueCount = overdue.length;
    const overdueTotal = Math.round(overdue.reduce((sum, x) => sum + (x.remaining || 0), 0));
    const overdueOldestDueDate = overdue[0]?.inst?.تاريخ_استحقاق || '';
    const overdueMaxDaysLate = overdue.length ? Math.max(0, ...overdue.map((x) => (x.due ? daysBetweenDateOnly(x.due, today) : 0))) : 0;

    const replacements: Record<string, string> = {
      ...getMessageGlobalContext(),
      contract_id: String(contract.رقم_العقد || ''),
      tenant_name: String(tenant?.الاسم || ''),
      property_code: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
      total_remaining_amount: String(totalRemaining || 0),
      overdue_amount_total: String(overdueTotal || 0),
    };

    let text = String(tmpl.content || '');
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      text = text.replace(regex, value);
    }
    return text;
  };

  const saveLegalNoticeHistory = (rec: Partial<LegalNoticeRecord>) => {
    const all = getLegalNoticeHistory();
    save(KEYS.LEGAL_HISTORY, [...all, { ...rec, id: `LNH-${Date.now()}` } as LegalNoticeRecord]);
  };

  const updateLegalNoticeHistory = (id: string, patch: Partial<LegalNoticeRecord>) => {
    const all = getLegalNoticeHistory();
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.LEGAL_HISTORY, all);
    }
  };

  const deleteLegalNoticeHistory = (id: string): DbResult<null> => {
    const all = getLegalNoticeHistory();
    save(KEYS.LEGAL_HISTORY, all.filter((r) => r.id !== id));
    return ok();
  };

  return { 
    addLegalTemplate, updateLegalTemplate, deleteLegalTemplate, 
    generateLegalNotice, saveLegalNoticeHistory, updateLegalNoticeHistory, deleteLegalNoticeHistory 
  };
}

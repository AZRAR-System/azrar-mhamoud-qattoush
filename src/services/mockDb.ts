import { getMessageGlobalContext } from '@/utils/messageGlobalContext';
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion, no-control-regex, no-useless-escape */

import {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  SystemLookup,
  LookupCategory,
  RoleType,
  المستخدمين_tbl,
  تذاكر_الصيانة_tbl,
  عروض_البيع_tbl,
  عروض_الشراء_tbl,
  اتفاقيات_البيع_tbl,
  العمليات_tbl,
  tbl_Alerts,
  BlacklistRecord,
  DynamicTable,
  DynamicRecord,
  DynamicFormField,
  ReportDefinition,
  LegalNoticeTemplate,
  LegalNoticeRecord,
  ActivityRecord,
  NoteRecord,
  Attachment,
  SystemHealth,
  PredictiveInsight,
  ClearanceRecord,
  شخص_دور_tbl,
  مستخدم_صلاحية_tbl,
  العمولات_tbl,
  العمولات_الخارجية_tbl,
  MarqueeMessage,
  DbResult,
  ContractDetailsResult,
  SystemSettings,
  DashboardNote,
  SystemReminder,
  ClientInteraction,
  FollowUpTask,
  PropertyInspection,
  ReferenceType,
  سجل_الملكية_tbl,
  المنشآت_tbl,
} from '../types';
import { storage } from '@/services/storage';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { computeEmployeeCommission, getRentalTier } from '@/utils/employeeCommission';
import { isSuperAdmin, normalizeRole } from '@/utils/roles';
import { formatCurrencyJOD } from '@/utils/format';
import { hashPassword, isHashedPassword, verifyPassword } from '@/services/passwordHash';

export { INSTALLMENT_STATUS, type InstallmentStatusType } from './db/installmentConstants';
import { INSTALLMENT_STATUS } from './db/installmentConstants';
import { buildCache, DbCache } from './dbCache';
import { KEYS } from './db/keys';
import { get, save } from './db/kv';
import {
  createContractWrites,
  getContracts,
  getContractDetails,
} from './db/contracts';
import {
  createInstallmentPaymentHandlers,
  generateContractInstallmentsInternal,
  getInstallmentPaymentSummary,
} from './db/installments';
import { getSettings, saveSettings } from './db/settings';
import {
  getSalesListings,
  createSalesListing,
  cancelOpenSalesListingsForProperty,
  getSalesOffers,
  submitSalesOffer,
  updateOfferStatus,
  getSalesAgreements,
  updateSalesAgreement,
  deleteSalesAgreement,
  createSalesAgreement,
} from './db/sales';
import { SmartEngine } from './smartEngine';
import { validateAllData } from '@/services/dataValidation';
import { purgeRefs, isDesktop, getDesktopBridge } from './db/refs';
import { makeCascadeDeletes } from './db/cascade';

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const asUnknownRecord = (value: unknown): UnknownRecord => {
  return (isUnknownRecord(value) ? value : Object.create(null)) as UnknownRecord;
};

/** Shared by addMarqueeAd / updateMarqueeAd / getMarqueeMessages — single implementation. */
type MarqueePlainJson =
  | null
  | string
  | number
  | boolean
  | MarqueePlainJson[]
  | { [key: string]: MarqueePlainJson };

const sanitizeMarqueeTextForDb = (raw: unknown, maxLen = 300): string => {
  const s = String(raw ?? '')
    // Strip bidi controls and other invisible directional markers (spoofing risk)
    .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '')
    // Strip ASCII control chars except \n/\t, then normalize whitespace
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const createMarqueeActionSanitizers = (allowedPanels: readonly string[]) => {
  const isAllowedPanel = (p: unknown): p is string =>
    typeof p === 'string' && (allowedPanels as readonly string[]).includes(p);

  const toPlainJsonValue = (input: unknown, depth = 0): MarqueePlainJson | undefined => {
    if (depth > 3) return undefined;
    if (input === null) return null;
    if (typeof input === 'string') return sanitizeMarqueeTextForDb(input, 200);
    if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
    if (typeof input === 'boolean') return input;
    if (Array.isArray(input)) {
      const out: MarqueePlainJson[] = [];
      for (const v of input.slice(0, 50)) {
        const vv = toPlainJsonValue(v, depth + 1);
        if (typeof vv !== 'undefined') out.push(vv);
      }
      return out;
    }
    if (typeof input === 'object') {
      const rec = asUnknownRecord(input);
      const out: { [key: string]: MarqueePlainJson } = Object.create(null);
      const keys = Object.keys(rec).slice(0, 50);
      for (const k of keys) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
        const vv = toPlainJsonValue(rec[k], depth + 1);
        if (typeof vv !== 'undefined') out[k] = vv;
      }
      return out;
    }
    return undefined;
  };

  const sanitizeOptions = (v: unknown): Record<string, unknown> | undefined => {
    const plain = toPlainJsonValue(v, 0);
    return plain && typeof plain === 'object' && !Array.isArray(plain)
      ? (plain as Record<string, unknown>)
      : undefined;
  };

  const sanitizeHash = (h: unknown): string | null => {
    const s = sanitizeMarqueeTextForDb(h, 200);
    if (!s) return null;
    if (!s.startsWith('/')) return null;
    if (/\s/.test(s)) return null;
    return s;
  };

  const sanitizeAction = (a: unknown): MarqueeMessage['action'] | undefined => {
    const rec = asUnknownRecord(a);
    const kind = typeof rec['kind'] === 'string' ? rec['kind'].trim() : '';
    if (kind === 'hash') {
      const hash = sanitizeHash(rec['hash']);
      return hash ? { kind: 'hash', hash } : undefined;
    }
    if (kind === 'panel') {
      const panel = typeof rec['panel'] === 'string' ? rec['panel'].trim() : '';
      if (!isAllowedPanel(panel)) return undefined;
      const id = sanitizeMarqueeTextForDb(rec['id'], 80);
      const options =
        typeof rec['options'] !== 'undefined' ? sanitizeOptions(rec['options']) : undefined;
      return {
        kind: 'panel',
        panel,
        ...(id ? { id } : {}),
        ...(typeof options !== 'undefined' ? { options } : {}),
      };
    }
    return undefined;
  };

  return { sanitizeMarqueeText: sanitizeMarqueeTextForDb, sanitizeAction };
};

const normKeySimple = (v: unknown) => String(v ?? '').trim().toLowerCase();

const stableHash32 = (input: string): string => {
  // Simple deterministic 32-bit hash (djb2) for stable keys.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
};

const lookupKeyFor = (category: unknown, label: unknown): string => {
  const c = normKeySimple(category);
  const l = normKeySimple(label);
  if (!c || !l) return '';
  return `${c}_${stableHash32(l)}`;
};

// Phase 3A: Import domain-specific services
import {
  getProperties,
  addProperty,
  updateProperty,
  getPropertyDetails,
} from './db/properties';
import {
  addPersonWithAutoLinkInternal,
  updatePersonWithAutoLinkInternal,
  upsertContactBookInternal,
  getContactsDirectoryInternal,
  getContactsBook,
  getPeople,
  getPersonRoles,
  updatePersonRoles,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,
} from './db/people';

export {
  getPeople,
  getPersonRoles,
  updatePersonRoles,
  addPerson,
  updatePerson,
  deletePerson,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,
} from './db/people';

export {
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  getPropertyDetails,
} from './db/properties';

// Merged Constants from previous mockData.ts
const MOCK_REPORTS: ReportDefinition[] = [
  {
    id: 'financial_summary',
    title: 'الملخص المالي',
    category: 'Financial',
    description: 'ملخص شامل للإيرادات والمصروفات',
  },
  {
    id: 'late_installments',
    title: 'الأقساط المتأخرة',
    category: 'Financial',
    description: 'عرض جميع الأقساط التي تجاوزت تاريخ استحقاقها.',
  },
  {
    id: 'employee_commissions',
    title: 'عمولات الموظفين (مع رقم الفرصة)',
    category: 'Financial',
    description:
      'تفصيل عمولة الموظف للإيجار والبيع حسب الشرائح + 40% بيع + 5% إدخال عقار، مع رقم الفرصة.',
  },
  {
    id: 'tenant_list',
    title: 'قائمة المستأجرين',
    category: 'Tenants',
    description: 'قائمة بجميع المستأجرين الحاليين والسابقين',
  },
  {
    id: 'tenant_risk_analysis',
    title: 'تحليل مخاطر المستأجرين',
    category: 'Tenants',
    description: 'تصنيف المستأجرين بناءً على سلوك الدفع.',
  },
  {
    id: 'contracts_active',
    title: 'العقود السارية',
    category: 'Contracts',
    description: 'جميع العقود النشطة حالياً.',
  },
  {
    id: 'contracts_expiring',
    title: 'العقود التي ستنتهي قريباً',
    category: 'Contracts',
    description: 'العقود التي ستنتهي خلال 30 يومًا.',
  },
  {
    id: 'properties_vacant',
    title: 'العقارات الشاغرة',
    category: 'Properties',
    description: 'قائمة بجميع العقارات المتاحة للإيجار.',
  },
  {
    id: 'properties_data_quality',
    title: 'جودة بيانات العقارات',
    category: 'Properties',
    description: 'العقارات التي ينقصها بيانات مهمة (كهرباء, مياه).',
  },
  {
    id: 'maintenance_open_tickets',
    title: 'طلبات الصيانة المفتوحة',
    category: 'Maintenance',
    description: 'جميع طلبات الصيانة التي لم يتم إغلاقها.',
  },
];

const MOCK_LEGAL_TEMPLATES: LegalNoticeTemplate[] = [
  {
    id: 'late_payment_friendly',
    title: 'إشعار تأخير دفع (ودي)',
    category: 'Warning',
    content: `إشعار تذكير بدفع الإيجار\n----------------------------------------\nالسيد/ة: {{tenant_name}}\n\nنود تذكيركم بوجود دفعات إيجار مستحقة للعقار رقم ({{property_code}}) لم تُسدّد بعد. نرجو منكم المبادرة بالسداد في أقرب وقت لضمان استمرارية العلاقة الإيجارية الطيبة.\n\nشاكرين تعاونكم،\nإدارة الأملاك`,
  },
  {
    id: 'late_payment_legal',
    title: 'إشعار تأخير دفع (قانوني)',
    category: 'Warning',
    content: `إنذار نهائي قبل اتخاذ إجراءات قانونية\n----------------------------------------\nالمستأجر: {{tenant_name}}\nالعقار: {{property_code}}\n\nنلفت عنايتكم إلى أن دفعات الإيجار المستحقة لم تُسدّد في مواعيدها، وهذا يُعدّ مخالفة صريحة لبنود العقد المبرم. يرجى السداد فورًا خلال (3 أيام) من تاريخه، وإلا سنضطر آسفين لتحويل الملف للدائرة القانونية للمطالبة بالإخلاء وتحصيل الذمم.\n\nإدارة الأملاك`,
  },
  {
    id: 'eviction_notice',
    title: 'إخطار بالإخلاء',
    category: 'Eviction',
    content: `إخطار رسمي بطلب إخلاء المأجور\n----------------------------------------\nالسيد/ة: {{tenant_name}}\n\nنظراً لمخالفتكم شروط العقد (بند: عدم السداد / سوء الاستخدام)، يُطلب منكم رسمياً إخلاء العقار وتسليمه فارغاً من الشواغل بحالة سليمة خلال مدة أقصاها [التاريخ]، وإلا سيتم تنفيذ الإخلاء جبراً بواسطة السلطات المختصة.\n\nإدارة الأملاك`,
  },
  {
    id: 'renewal_notice',
    title: 'إخطار مبدئي قبل التجديد',
    category: 'Renewal',
    content: `إشعار بقرب انتهاء عقد الإيجار\n----------------------------------------\nالسيد/ة: {{tenant_name}}\n\nنود إعلامكم بأن عقد الإيجار للعقار {{property_code}} سينتهي بتاريخ: {{contract_end_date}}.\n\nيرجى مراجعة المكتب خلال أسبوع لتحديد رغبتكم بتجديد العقد بشروط جديدة أو تسليم العقار عند انتهاء المدة.\n\nإدارة الأملاك`,
  },
  {
    id: 'maintenance_entry',
    title: 'إشعار دخول للصيانة',
    category: 'General',
    content: `إشعار زيارة صيانة\n----------------------------------------\nالسيد/ة: {{tenant_name}}\n\nنحيطكم علماً بأن فريق الصيانة سيقوم بزيارة العقار لإجراء أعمال ضرورية (صيانة دورية / طارئة) وذلك بتاريخ [التاريخ] في تمام الساعة [الوقت].\n\nيرجى التفضل بالتواجد أو تفويض من ينوب عنكم.\n\nإدارة الأملاك`,
  },
  {
    id: 'mutual_termination',
    title: 'اتفاقية إنهاء بالتراضي',
    category: 'General',
    content: `ملحق إنهاء عقد إيجار بالتراضي\n----------------------------------------\nتم الاتفاق بين إدارة العقار والمستأجر {{tenant_name}} على إنهاء العقد رقم {{contract_id}} قبل انتهاء مدته، وذلك بتاريخ [التاريخ].\n\nيقر المستأجر بتسليم العقار ودفع كافة الذمم المترتبة حتى تاريخ التسليم، وتعتبر هذه الوثيقة براءة ذمة مشروطة بالتسليم الفعلي.\n\nتوقيع الطرفين:`,
  },

  // رسائل انتهاء وتجديد العقود (نصوص ثابتة)
  {
    id: 'contract_expiry_pre_notice_owner_fixed',
    title: 'إخطار مبدئي قبل نهاية العقد (للمالك) – ثابت',
    category: 'Renewal',
    content: `📌 للمالك\nالسيد {{اسم_المالك}}\nتحية طيبة وبعد،\n\nنود إعلامكم بأن عقد الإيجار الخاص بالعقار الكائن في\n{{عنوان_العقار}}\nوالمسجل بالكود الداخلي رقم {{الكود_الداخلي}}\nسينتهي بتاريخ {{تاريخ_نهاية_العقد}}.\n\nيرجى منكم التكرم بتحديد موقفكم من تجديد العقد أو إنهائه خلال مدة لا تتجاوز 7 أيام من تاريخ هذا الإشعار.`,
  },
  {
    id: 'contract_expiry_pre_notice_tenant_fixed',
    title: 'إخطار مبدئي قبل نهاية العقد (للمستأجر) – ثابت',
    category: 'Renewal',
    content: `📌 للمستأجر\nالسيد {{اسم_المستأجر}}\nتحية طيبة وبعد،\n\nنود إعلامكم بأن عقد الإيجار الخاص بالعقار الكائن في\n{{عنوان_العقار}}\nوالمسجل بالكود الداخلي رقم {{الكود_الداخلي}}\nسينتهي بتاريخ {{تاريخ_نهاية_العقد}}.\n\nسيتم إعلامكم بقرار المالك بخصوص التجديد أو عدمه حسب الأصول القانونية المعتمدة.`,
  },
  {
    id: 'contract_renewal_approved_owner_fixed',
    title: 'إخطار بالموافقة على التجديد (للمالك) – ثابت',
    category: 'Renewal',
    content: `📌 للمالك\nالسيد {{اسم_المالك}}\nتحية طيبة وبعد،\nتم توثيق موافقتكم على تجديد عقد الإيجار للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}}.\nيرجى مراجعة المكتب لاستكمال إجراءات توقيع عقد التجديد حسب الأصول.`,
  },
  {
    id: 'contract_renewal_approved_tenant_fixed',
    title: 'إخطار بالموافقة على التجديد (للمستأجر) – ثابت',
    category: 'Renewal',
    content: `📌 للمستأجر\nالسيد {{اسم_المستأجر}}\nتحية طيبة وبعد،\nنود إعلامكم بأن المالك قد وافق على تجديد عقد الإيجار للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}} حتى تاريخ {{تاريخ_نهاية_العقد}}.\nيرجى مراجعة المكتب لاستكمال توقيع عقد التجديد.`,
  },
  {
    id: 'contract_renewal_rejected_owner_fixed',
    title: 'إخطار بعدم التجديد (للمالك) – ثابت',
    category: 'Renewal',
    content: `📌 للمالك\nالسيد {{اسم_المالك}}\nتحية طيبة وبعد،\nتم تسجيل قراركم بعدم تجديد عقد الإيجار للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}} والمنتهي بتاريخ {{تاريخ_نهاية_العقد}}.\nتم إخطار المستأجر رسميًا وفق الإجراءات القانونية.`,
  },
  {
    id: 'contract_renewal_rejected_tenant_fixed',
    title: 'إخطار بعدم التجديد (للمستأجر) – ثابت',
    category: 'Renewal',
    content: `📌 للمستأجر\nالسيد {{اسم_المستأجر}}\nتحية طيبة وبعد،\nنود إعلامكم بأن المالك قرر عدم تجديد عقد الإيجار للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}} والمنتهي بتاريخ {{تاريخ_نهاية_العقد}}.\nيرجى إخلاء العقار وتسليمه حسب الأصول القانونية خلال المدة المحددة قانونًا.`,
  },
  {
    id: 'contract_renewal_auto_owner_fixed',
    title: 'إخطار بالتجديد التلقائي (للمالك) – ثابت',
    category: 'Renewal',
    content: `📌 للمالك\nالسيد {{اسم_المالك}}\nتحية طيبة وبعد،\nنود إعلامكم بأنه تم تجديد عقد الإيجار تلقائيًا للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}} حتى تاريخ {{تاريخ_نهاية_العقد}}.\nوذلك استنادًا إلى بند التجديد التلقائي الوارد في العقد.`,
  },
  {
    id: 'contract_renewal_auto_tenant_fixed',
    title: 'إخطار بالتجديد التلقائي (للمستأجر) – ثابت',
    category: 'Renewal',
    content: `📌 للمستأجر\nالسيد {{اسم_المستأجر}}\nتحية طيبة وبعد،\nنود إعلامكم بأنه تم تجديد عقد الإيجار تلقائيًا للعقار الكائن في {{عنوان_العقار}} والمسجل بالكود الداخلي رقم {{الكود_الداخلي}} حتى تاريخ {{تاريخ_نهاية_العقد}} وفق الشروط السابقة المبرمة في العقد.`,
  },
  {
    id: 'manual_message_fixed',
    title: 'رسالة يدوية (قالب عام) – ثابت',
    category: 'General',
    content: `{{نص_الرسالة_اليدوية}}`,
  },
];

type MarqueeAdRecord = {
  id: string;
  content: string;
  priority: 'Normal' | 'High';
  type: 'alert' | 'info' | 'success';
  createdAt: string;
  expiresAt?: string; // ISO
  enabled?: boolean;
  action?: MarqueeMessage['action'];
};

const getNonExpiredMarqueeAdsInternal = (): MarqueeAdRecord[] => {
  const all = get<MarqueeAdRecord>(KEYS.MARQUEE);
  const now = Date.now();
  const kept: MarqueeAdRecord[] = [];
  let changed = false;

  for (const a of all) {
    const exp = String(asUnknownRecord(a)['expiresAt'] ?? '').trim();
    if (exp) {
      const t = new Date(exp).getTime();
      if (!Number.isFinite(t) || t <= now) {
        changed = true;
        continue;
      }
    }
    kept.push(a);
  }

  if (changed) {
    save(KEYS.MARQUEE, kept);
  }

  return kept;
};

const getActiveMarqueeAdsInternal = (): MarqueeAdRecord[] => {
  return getNonExpiredMarqueeAdsInternal().filter((a) => asUnknownRecord(a)['enabled'] !== false);
};

const sanitizeFolderName = (input: string, maxLen = 80): string => {
  const raw = String(input ?? '').trim();
  if (!raw) return 'غير_معروف';
  const cleaned = raw
    .replace(/[\\/]+/g, '-')
    .replace(/[<>:"|?*]+/g, '-')
    .replace(/[\u0000-\u001F]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned || 'غير_معروف';
  return safe.length > maxLen ? safe.slice(0, maxLen).trim() : safe;
};

const _toDateOnlySafe = (d: unknown): string => {
  try {
    if (!d) return '';
    const input =
      d instanceof Date || typeof d === 'string' || typeof d === 'number' ? d : String(d);
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const buildAttachmentEntityFolder = (referenceType: string, referenceId: string): string => {
  const t = String(referenceType || '');

  if (t === 'Person') {
    // المطلوب: مرفقات الشخص تحفظ برقم الشخص
    return sanitizeFolderName(referenceId, 110);
  }

  if (t === 'Property') {
    const prop = get<العقارات_tbl>(KEYS.PROPERTIES).find((p) => p.رقم_العقار === referenceId);
    // المطلوب: مرفقات العقار تحفظ بالكود الداخلي
    const code = String(prop?.الكود_الداخلي || referenceId);
    return sanitizeFolderName(code, 110);
  }

  if (t === 'Contract') {
    // المطلوب: مرفقات العقد تحفظ برقم العقد
    return sanitizeFolderName(referenceId, 140);
  }

  if (t === 'Clearance') {
    // المطلوب: مرفقات مخالصة العقد تحفظ برقم العقد + العقار
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((x) => x.رقم_العقد === referenceId);
    const property = contract
      ? get<العقارات_tbl>(KEYS.PROPERTIES).find((p) => p.رقم_العقار === contract.رقم_العقار)
      : undefined;
    const propertyToken = String(property?.الكود_الداخلي || contract?.رقم_العقار || '');
    const parts = [String(referenceId || ''), propertyToken].filter(Boolean);
    return sanitizeFolderName(parts.join('__'), 140);
  }

  return sanitizeFolderName(`${t || 'Other'} - ${referenceId}`, 120);
};

type LogMeta = {
  ipAddress?: string;
  deviceInfo?: string;
};

const logOperationInternal = (
  user: string,
  action: string,
  table: string,
  recordId: string,
  details: string,
  meta?: LogMeta
) => {
  const logs = get<العمليات_tbl>(KEYS.LOGS);
  const newLog: العمليات_tbl = {
    id: Math.random().toString(36).substr(2, 9),
    اسم_المستخدم: user || 'System',
    نوع_العملية: action,
    اسم_الجدول: table,
    رقم_السجل: recordId,
    تاريخ_العملية: new Date().toISOString(),
    details: details,
    ipAddress: meta?.ipAddress,
    deviceInfo: meta?.deviceInfo,
  };
  save(KEYS.LOGS, [...logs, newLog]);
};

const {
  deletePersonCascadeInternal,
  deletePropertyCascadeInternal,
  deleteContractCascadeInternal,
} = makeCascadeDeletes(logOperationInternal);

const stableAlertId = (dateISO: string, type: string, message: string, category: string) => {
  // Deterministic, non-crypto hash to prevent duplicate alerts for the same day/content
  const input = `${dateISO}|${category}|${type}|${message}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ALR-GEN-${category}-${(hash >>> 0).toString(36)}`;
};

const buildContractAlertContext = (
  contractIdRaw: string
): Partial<
  Pick<tbl_Alerts, 'tenantName' | 'phone' | 'propertyCode' | 'مرجع_الجدول' | 'مرجع_المعرف'>
> => {
  const contractId = String(contractIdRaw || '').trim();
  if (!contractId) return {};

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

  const contract = contracts.find((c) => String(c?.رقم_العقد) === contractId);
  if (!contract) {
    return { مرجع_الجدول: 'العقود_tbl', مرجع_المعرف: contractId };
  }

  const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
  const property = properties.find((p) => String(p?.رقم_العقار) === String(contract.رقم_العقار));

  return {
    tenantName: tenant?.الاسم,
    phone: tenant?.رقم_الهاتف,
    propertyCode: property?.الكود_الداخلي,
    مرجع_الجدول: 'العقود_tbl',
    مرجع_المعرف: contractId,
  };
};

// --- INTERNAL HELPERS ---
const handleSmartEngine = (category: 'person' | 'property' | 'contract', data: unknown) => {
  const record = asUnknownRecord(data);
  SmartEngine.track(category, record);
  const anomalyMessages = SmartEngine.detectAnomalies(category, record);
  if (anomalyMessages.length > 0) {
    const todayISO = new Date().toISOString().split('T')[0];
    const msg = anomalyMessages.join(' ');

    const contractId =
      category === 'contract' ? String(record['رقم_العقد'] ?? '').trim() : '';
    const context = contractId ? buildContractAlertContext(contractId) : {};

    const newAlert: tbl_Alerts = {
      id: stableAlertId(todayISO, 'سلوك غير اعتيادي', msg, 'SmartBehavior'),
      نوع_التنبيه: 'سلوك غير اعتيادي',
      الوصف: msg,
      category: 'SmartBehavior',
      تاريخ_الانشاء: todayISO,
      تم_القراءة: false,
      ...context,
      details: anomalyMessages.map((note, idx) => ({
        id: `smart-${todayISO}-${idx}`,
        note,
      })),
    };
    upsertAlert(newAlert);
  }
};

const fail = <T>(message: string): DbResult<T> => ({ success: false, message });
const ok = <T>(data?: T, message = 'تمت العملية بنجاح'): DbResult<T> => ({
  success: true,
  message,
  data,
});

// --- DATE HELPERS (installments reminders) ---
const formatDateOnly = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDateOnly = (iso: string) => {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};
const daysBetweenDateOnly = (from: Date, to: Date) => {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const addMonthsDateOnly = (isoDate: string, months: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setMonth(next.getMonth() + months);
  return next;
};

const addDaysIso = (isoDate: string, days: number) => {
  const d = parseDateOnly(isoDate);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
};

const contractWrites = createContractWrites({
  logOperation: logOperationInternal,
  handleSmartEngine,
  formatDateOnly,
  addDaysIso,
  addMonthsDateOnly,
});

const getInstallmentPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const norm = (v: unknown) => String(v ?? '').trim();

  // 1) If explicitly marked as PAID, treat it as fully paid even if payment history is missing.
  if (norm(inst.حالة_الكمبيالة) === INSTALLMENT_STATUS.PAID) {
    return { paid: Math.max(0, inst.القيمة), remaining: 0 };
  }

  // 2) Prefer the stored remaining amount if available (it reflects UI/payment operations).
  const rawRemaining = asUnknownRecord(inst)['القيمة_المتبقية'];
  if (typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)) {
    const total = Math.max(0, inst.القيمة);
    const remaining = Math.max(0, Math.min(total, rawRemaining));
    const paid = Math.max(0, Math.min(total, total - remaining));
    return { paid, remaining };
  }

  // 3) Fallback to payment history.
  const paidFromHistory =
    inst.سجل_الدفعات?.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0) || 0;
  const paid = Math.max(0, Math.min(inst.القيمة, paidFromHistory));
  const remaining = Math.max(0, inst.القيمة - paid);
  return { paid, remaining };
};

type PaymentDueBucket = 'overdue' | 'today' | 'upcoming';

export interface PaymentDueItem {
  installmentId: string;
  contractId: string;
  dueDate: string;
  amountRemaining: number;
  daysUntilDue: number;
  bucket: PaymentDueBucket;
  installmentType?: string;
}

export interface PaymentNotificationTarget {
  key: string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  extraPhone?: string;
  contractId: string;
  propertyId?: string;
  propertyCode?: string;
  items: PaymentDueItem[];
}

export interface NotificationSendLogRecord {
  id: string;
  category: string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  contractId?: string;
  propertyId?: string;
  propertyCode?: string;
  installmentIds?: string[];
  sentAt: string;
  message?: string;
  note?: string;
  reply?: string;
}

const getPaymentNotificationTargetsInternal = (daysAhead: number) => {
  const norm = (v: unknown) => String(v ?? '').trim();
  const today = toDateOnly(new Date());
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

  const targetsByKey = new Map<string, PaymentNotificationTarget>();

  for (const contract of contracts) {
    const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);

    const contractInstallments = installments
      .filter((i) => i.رقم_العقد === contract.رقم_العقد)
      .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
      .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
      .filter((i) => {
        const status = norm(i.حالة_الكمبيالة);
        return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
      });

    const dueItems: PaymentDueItem[] = [];
    for (const inst of contractInstallments) {
      const { remaining } = getInstallmentPaidAndRemaining(inst);
      if (remaining <= 0) continue;
      const due = parseDateOnly(inst.تاريخ_استحقاق);
      if (!due) continue;
      const daysUntilDue = daysBetweenDateOnly(today, due);
      // المطلوب: فقط تذكير قبل الاستحقاق (بدون مستحقة اليوم/متأخرة).
      if (daysUntilDue <= 0) continue;
      if (daysUntilDue > daysAhead) continue;
      const bucket: PaymentDueBucket = 'upcoming';

      dueItems.push({
        installmentId: inst.رقم_الكمبيالة,
        contractId: contract.رقم_العقد,
        dueDate: inst.تاريخ_استحقاق,
        amountRemaining: remaining,
        daysUntilDue,
        bucket,
        installmentType: inst.نوع_الكمبيالة,
      });
    }

    if (dueItems.length === 0) continue;

    const key = `${contract.رقم_العقد}`;
    const existing = targetsByKey.get(key);
    if (!existing) {
      targetsByKey.set(key, {
        key,
        tenantId: tenant?.رقم_الشخص,
        tenantName: tenant?.الاسم || 'مستأجر',
        phone: tenant?.رقم_الهاتف,
        extraPhone: tenant?.رقم_هاتف_اضافي,
        contractId: contract.رقم_العقد,
        propertyId: property?.رقم_العقار,
        propertyCode: property?.الكود_الداخلي,
        items: dueItems,
      });
    } else {
      existing.items.push(...dueItems);
    }
  }

  return Array.from(targetsByKey.values()).map((t) => ({
    ...t,
    items: t.items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
  }));
};

const addNotificationSendLogInternal = (log: Omit<NotificationSendLogRecord, 'id'>) => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const rec: NotificationSendLogRecord = {
    id: `NSL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...log,
  };
  save(KEYS.NOTIFICATION_SEND_LOGS, [rec, ...all]);
  return rec;
};

const updateNotificationSendLogInternal = (
  id: string,
  patch: Partial<Pick<NotificationSendLogRecord, 'note' | 'reply'>>
) => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) return fail('Not found');
  all[idx] = { ...all[idx], ...patch };
  save(KEYS.NOTIFICATION_SEND_LOGS, all);
  return ok(all[idx]);
};

const deleteNotificationSendLogInternal = (id: string) => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const next = all.filter((x) => x.id !== id);
  if (next.length === all.length) return ok(null);
  save(KEYS.NOTIFICATION_SEND_LOGS, next);
  return ok(null);
};

function upsertAlert(alert: tbl_Alerts) {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  const indices: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i]?.id === alert.id) indices.push(i);
  }

  if (indices.length > 0) {
    // Preserve "read" flag if the user dismissed it.
    const wasRead = indices.some((i) => !!all[i]?.تم_القراءة);
    const primaryIdx = indices[0];
    const prev = all[primaryIdx];
    all[primaryIdx] = { ...prev, ...alert, تم_القراءة: wasRead };

    // Remove any duplicate records with the same id (legacy data).
    if (indices.length > 1) {
      const keep = new Set<number>([primaryIdx]);
      const deduped: tbl_Alerts[] = [];
      for (let i = 0; i < all.length; i++) {
        if (all[i]?.id !== alert.id || keep.has(i)) {
          deduped.push(all[i]);
        }
      }
      save(KEYS.ALERTS, deduped);
      return;
    }

    save(KEYS.ALERTS, all);
    return;
  }

  save(KEYS.ALERTS, [alert, ...all]);
}

const markAlertsReadByPrefix = (prefix: string) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  let changed = false;
  for (const a of all) {
    if (a.id.startsWith(prefix) && !a.تم_القراءة) {
      a.تم_القراءة = true;
      changed = true;
    }
  }
  if (changed) save(KEYS.ALERTS, all);
};

const updateTenantRatingImpl = (tenantId: string, paymentType: 'full' | 'partial' | 'late') => {
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const idx = people.findIndex((p) => p.رقم_الشخص === tenantId);
  if (idx === -1) return;

  const person = people[idx];
  const oldPoints = person.تصنيف_السلوك?.points ?? 100;
  const oldType = person.تصنيف_السلوك?.type ?? 'جديد';

  if (!person.تصنيف_السلوك) {
    person.تصنيف_السلوك = { type: 'جيد', points: 100, history: [] };
  }

  let pointsChange = 0;
  if (paymentType === 'full') {
    pointsChange = 5;
    person.تصنيف_السلوك.points = Math.min(100, person.تصنيف_السلوك.points + 5);
  } else if (paymentType === 'partial') {
    pointsChange = -10;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 10);
  } else if (paymentType === 'late') {
    pointsChange = -20;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 20);
  }

  const pts = person.تصنيف_السلوك.points;
  if (pts >= 90) person.تصنيف_السلوك.type = 'ممتاز';
  else if (pts >= 70) person.تصنيف_السلوك.type = 'جيد';
  else if (pts >= 50) person.تصنيف_السلوك.type = 'متوسط';
  else if (pts >= 30) person.تصنيف_السلوك.type = 'ضعيف';
  else person.تصنيف_السلوك.type = 'سيء';

  if (!Array.isArray(person.تصنيف_السلوك.history)) person.تصنيف_السلوك.history = [];
  person.تصنيف_السلوك.history.push({
    date: formatDateOnly(toDateOnly(new Date())),
    paymentType,
    pointsChange,
    points: person.تصنيف_السلوك.points,
  });

  people[idx] = person;
  save(KEYS.PEOPLE, people);

  const ratingDesc = `تحديث تصنيف السلوك - من ${oldType} (${oldPoints}) إلى ${person.تصنيف_السلوك.type} (${person.تصنيف_السلوك.points}) - التغيير: ${pointsChange > 0 ? '+' : ''}${pointsChange} نقاط (${paymentType === 'full' ? 'سداد كامل' : paymentType === 'partial' ? 'سداد جزئي' : 'سداد متأخر'})`;
  logOperationInternal('System', 'تحديث التصنيف', 'People', tenantId, ratingDesc);
};

const installmentPayments = createInstallmentPaymentHandlers({
  logOperation: logOperationInternal,
  markAlertsReadByPrefix,
  updateTenantRating: updateTenantRatingImpl,
});

// One-time/always-safe migration: remove duplicate alert records and suppress stale financial alerts.
// This runs on startup so users don't have to wait for the daily reminder scan to clean old data.
const dedupeAndCleanupAlertsInternal = () => {
  const alerts = get<tbl_Alerts>(KEYS.ALERTS) || [];
  if (alerts.length === 0) return;

  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS) || [];
  const byInstallmentId = new Map<string, الكمبيالات_tbl>();
  for (const inst of installments) byInstallmentId.set(inst.رقم_الكمبيالة, inst);

  const today = toDateOnly(new Date());
  const seen = new Map<string, tbl_Alerts>();
  const deduped: tbl_Alerts[] = [];
  let changed = false;

  const inferAndPatchAlertContext = (a: tbl_Alerts): boolean => {
    // Only patch missing context; never overwrite explicit refs.
    if (a?.مرجع_الجدول && a?.مرجع_المعرف) return false;
    if (a?.نوع_التنبيه !== 'تأجيل تحصيل') return false;

    const msg = String(a?.الوصف || '');
    const m = msg.match(/عقد\s*#?\s*([A-Za-z0-9_\-]+)/);
    const contractId = String(m?.[1] || '').trim();
    if (!contractId) return false;

    const ctx = buildContractAlertContext(contractId);
    const before = JSON.stringify({
      tenantName: a.tenantName,
      phone: a.phone,
      propertyCode: a.propertyCode,
      مرجع_الجدول: a.مرجع_الجدول,
      مرجع_المعرف: a.مرجع_المعرف,
    });
    Object.assign(a, ctx);
    const after = JSON.stringify({
      tenantName: a.tenantName,
      phone: a.phone,
      propertyCode: a.propertyCode,
      مرجع_الجدول: a.مرجع_الجدول,
      مرجع_المعرف: a.مرجع_المعرف,
    });
    return before !== after;
  };

  for (const a of alerts) {
    if (!a?.id) continue;

    const existing = seen.get(a.id);
    if (existing) {
      // Merge read state (if any duplicate was read, keep it read).
      if (!!a.تم_القراءة && !existing.تم_القراءة) existing.تم_القراءة = true;
      changed = true;
      continue;
    }

    // Financial cleanup
    if (!a.تم_القراءة) {
      const payPrefix = 'ALR-FIN-PAY-';
      const remPrefix = 'ALR-FIN-REM7-';
      const legalPrefix = 'ALR-FIN-LEGAL-';

      // Feature change: we no longer send/keep payment-due reminders.
      // Mark existing ones as read so they disappear immediately.
      if (
        a.نوع_التنبيه === 'إخطار بالدفع' ||
        a.نوع_التنبيه === 'إخطار قانوني بالدفع' ||
        a.id.startsWith(payPrefix) ||
        a.id.startsWith(legalPrefix)
      ) {
        a.تم_القراءة = true;
        changed = true;
      }

      if (a.id.startsWith(payPrefix)) {
        // handled above
      } else if (a.id.startsWith(remPrefix)) {
        const instId = a.id.slice(remPrefix.length);
        const inst = byInstallmentId.get(instId);
        if (inst) {
          const status = String(inst.حالة_الكمبيالة ?? '').trim();
          const { remaining } = getInstallmentPaidAndRemaining(inst);
          if (status === INSTALLMENT_STATUS.PAID || remaining <= 0) {
            a.تم_القراءة = true;
            changed = true;
          } else {
            const due = parseDateOnly(inst.تاريخ_استحقاق);
            if (due) {
              const daysUntilDue = daysBetweenDateOnly(today, due);
              if (daysUntilDue <= 0) {
                // Once due/overdue, hide the 7-day reminder to avoid duplicates.
                a.تم_القراءة = true;
                changed = true;
              }
            }
          }
        }
      }
    }

    // Context patching (best-effort)
    if (inferAndPatchAlertContext(a)) {
      changed = true;
    }

    seen.set(a.id, a);
    deduped.push(a);
  }

  if (changed || deduped.length !== alerts.length) {
    save(KEYS.ALERTS, deduped);
  }
};

const runInstallmentReminderScanInternal = () => {
  const today = toDateOnly(new Date());

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
  if (contracts.length === 0) return;

  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const norm = (v: unknown) => String(v ?? '').trim();

  for (const contract of contracts) {
    const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
    const contractInstallmentsAll = installments
      .filter((i) => i.رقم_العقد === contract.رقم_العقد)
      .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
      .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
      .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

    // Exclude PAID status from reminder generation (even if payment history is missing)
    const contractInstallments = contractInstallmentsAll.filter(
      (i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.PAID
    );

    // Normalize installment status using payment history.
    const unpaid = contractInstallments
      .map((i) => ({ inst: i, ...getInstallmentPaidAndRemaining(i) }))
      .filter((x) => x.remaining > 0);

    // Cleanup: mark our old alerts as read for installments that are now paid.
    // Note: Some installments can be marked as PAID without a payment history (e.g., down payment).
    // In that case, remaining might still look > 0, but we should still suppress financial alerts.
    const nowPaid = contractInstallmentsAll
      .map((i) => ({
        inst: i,
        status: norm(i.حالة_الكمبيالة),
        ...getInstallmentPaidAndRemaining(i),
      }))
      .filter((x) => x.status === INSTALLMENT_STATUS.PAID || x.remaining <= 0);
    for (const p of nowPaid) {
      markAlertsReadByPrefix(`ALR-FIN-REM7-${p.inst.رقم_الكمبيالة}`);
      markAlertsReadByPrefix(`ALR-FIN-PAY-${p.inst.رقم_الكمبيالة}`);
    }

    // Feature change: retire all payment-due / legal alerts. We only keep the pre-due reminder.
    markAlertsReadByPrefix(`ALR-FIN-LEGAL-${contract.رقم_العقد}`);

    // 1) Reminder: only for upcoming installments (1..7 days before due).
    // Policy: pre-due reminders only (no due-today / overdue / payment reminders).
    for (const u of unpaid) {
      const due = parseDateOnly(u.inst.تاريخ_استحقاق);
      if (!due) continue;
      const daysUntilDue = daysBetweenDateOnly(today, due);
      if (daysUntilDue > 7) continue;
      if (daysUntilDue <= 0) continue;

      const alertId = `ALR-FIN-REM7-${u.inst.رقم_الكمبيالة}`;
      upsertAlert({
        id: alertId,
        تاريخ_الانشاء: today.toISOString().split('T')[0],
        نوع_التنبيه: 'تذكير قبل الاستحقاق (7 أيام)',
        الوصف: `دفعة ستستحق خلال ${daysUntilDue} أيام. المبلغ: ${formatCurrencyJOD(u.remaining)} — تاريخ الاستحقاق: ${u.inst.تاريخ_استحقاق}`,
        category: 'Financial',
        تم_القراءة: false,
        tenantName: tenant?.الاسم,
        phone: tenant?.رقم_الهاتف,
        propertyCode: property?.الكود_الداخلي,
        مرجع_الجدول: 'الكمبيالات_tbl',
        مرجع_المعرف: u.inst.رقم_الكمبيالة,
      });
    }

    // ملاحظة: تم إلغاء تنبيهات (مستحقة/متأخرة) نهائياً حسب المطلوب.
  }
};

const runAutoRenewContractsInternal = () => {
  const todayIso = formatDateOnly(toDateOnly(new Date()));
  const today = parseDateOnly(todayIso);
  if (!today) return;

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
  const expirable = contracts.filter((c) => !c.isArchived && c.autoRenew === true);
  if (expirable.length === 0) return;

  for (const c of expirable) {
    if (c.linkedContractId) continue; // already renewed
    const end = parseDateOnly(c.تاريخ_النهاية);
    if (!end) continue;
    if (toDateOnly(end).getTime() >= toDateOnly(today).getTime()) continue; // not expired yet

    // Auto renew by creating a new contract starting the day after end date
    try {
      const newStart = addDaysIso(c.تاريخ_النهاية, 1);
      if (!newStart) continue;
      const endCandidate = addMonthsDateOnly(newStart, c.مدة_العقد_بالاشهر);
      if (!endCandidate) continue;
      endCandidate.setDate(endCandidate.getDate() - 1);
      const newEnd = formatDateOnly(endCandidate);

      const prevCommission = get<العمولات_tbl>(KEYS.COMMISSIONS).find(
        (x) => x.رقم_العقد === c.رقم_العقد
      );
      const commOwner = prevCommission?.عمولة_المالك ?? 0;
      const commTenant = prevCommission?.عمولة_المستأجر ?? 0;
      const commissionPaidMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(newStart))
        ? String(newStart).slice(0, 7)
        : undefined;

      // Create new contract
      const { رقم_العقد: _omitId, ...base } = c;
      const result = DbService.createContract(
        {
          ...base,
          تاريخ_البداية: newStart,
          تاريخ_النهاية: newEnd,
          حالة_العقد: 'نشط',
          isArchived: false,
          عقد_مرتبط: c.رقم_العقد,
          linkedContractId: undefined,
        },
        commOwner,
        commTenant,
        commissionPaidMonth
      );

      if (result.success && result.data) {
        const newId = result.data.رقم_العقد;
        const all = get<العقود_tbl>(KEYS.CONTRACTS);
        const idx = all.findIndex((x) => x.رقم_العقد === c.رقم_العقد);
        if (idx > -1) {
          all[idx].linkedContractId = newId;
          all[idx].حالة_العقد = 'مجدد';
          save(KEYS.CONTRACTS, all);
        }
        logOperationInternal(
          'System',
          'تجديد تلقائي',
          'Contracts',
          c.رقم_العقد,
          `تم التجديد التلقائي وإنشاء عقد جديد: ${newId}`
        );
      }
    } catch (e) {
      console.warn('Auto renew failed', e);
    }
  }
};

const markAlertsReadIfNotInSet = (prefix: string, alive: Set<string>) => {
  const all = get<tbl_Alerts>(KEYS.ALERTS);
  let changed = false;
  for (const a of all) {
    const id = String(asUnknownRecord(a)['id'] ?? '');
    if (!id.startsWith(prefix)) continue;
    if (alive.has(id)) continue;
    if (!a.تم_القراءة) {
      a.تم_القراءة = true;
      changed = true;
    }
  }
  if (changed) save(KEYS.ALERTS, all);
};

const runDataQualityScanInternal = () => {
  const norm = (v: unknown) => String(v ?? '').trim();

  // 1) Properties: missing utility subscription numbers
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  if (properties.length === 0) {
    markAlertsReadByPrefix('ALR-DQ-PROP-');
  } else {
    const issues = properties
      .map((p) => {
        const missing: string[] = [];
        if (!norm(asUnknownRecord(p)['رقم_اشتراك_الكهرباء'])) missing.push('رقم_اشتراك_الكهرباء');
        if (!norm(asUnknownRecord(p)['رقم_اشتراك_المياه'])) missing.push('رقم_اشتراك_المياه');
        return {
          id: p.رقم_العقار,
          name: `${p.الكود_الداخلي || p.رقم_العقار} — ${p.العنوان || ''}`.trim(),
          missingFields: missing,
        };
      })
      .filter((x) => x.missingFields.length > 0);

    const alertId = 'ALR-DQ-PROP-UTILS';
    if (issues.length === 0) {
      markAlertsReadByPrefix('ALR-DQ-PROP-');
    } else {
      upsertAlert({
        id: alertId,
        تاريخ_الانشاء: new Date().toISOString().split('T')[0],
        نوع_التنبيه: 'نقص بيانات العقارات',
        الوصف: `يوجد ${issues.length} عقارات ينقصها بيانات مهمة (كهرباء/مياه).`,
        category: 'DataQuality',
        تم_القراءة: false,
        count: issues.length,
        details: issues,
        مرجع_الجدول: 'العقارات_tbl',
        مرجع_المعرف: 'batch',
      });
    }
  }

  // 2) People: missing phone / national id (highest priority)
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  if (people.length === 0) {
    markAlertsReadByPrefix('ALR-DQ-PEOPLE-');
    return;
  }

  const peopleIssues = people
    .map((p) => {
      const missing: string[] = [];
      if (!norm(p.رقم_الهاتف)) missing.push('رقم_الهاتف');
      if (!norm(p.الرقم_الوطني)) missing.push('الرقم_الوطني');
      return {
        id: p.رقم_الشخص,
        name: `${p.الاسم || p.رقم_الشخص}`.trim(),
        missingFields: missing,
      };
    })
    .filter((x) => x.missingFields.length > 0);

  const peopleAlertId = 'ALR-DQ-PEOPLE-IDPHONE';
  if (peopleIssues.length === 0) {
    markAlertsReadByPrefix('ALR-DQ-PEOPLE-');
    return;
  }

  upsertAlert({
    id: peopleAlertId,
    تاريخ_الانشاء: new Date().toISOString().split('T')[0],
    نوع_التنبيه: 'نقص بيانات الأشخاص',
    الوصف: `يوجد ${peopleIssues.length} أشخاص ينقصهم رقم الهاتف أو الرقم الوطني.`,
    category: 'DataQuality',
    تم_القراءة: false,
    count: peopleIssues.length,
    details: peopleIssues,
    مرجع_الجدول: 'الأشخاص_tbl',
    مرجع_المعرف: 'batch',
  });
};

const runExpiryScanInternal = () => {
  const today = toDateOnly(new Date());
  const todayIso = formatDateOnly(today);

  const settings = DbService.getSettings?.();
  const threshold = Math.max(1, Number(settings?.alertThresholdDays ?? 30));

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
    .filter((c) => isTenancyRelevant(c))
    .filter((c) => !c.isArchived);

  const alive = new Set<string>();

  for (const c of contracts) {
    const end = parseDateOnly(String(asUnknownRecord(c)['تاريخ_النهاية'] || ''));
    if (!end) continue;
    const daysLeft = daysBetweenDateOnly(today, end);
    if (daysLeft < 0) continue; // already ended
    if (daysLeft > threshold) continue;

    const id = `ALR-EXP-${c.رقم_العقد}`;
    alive.add(id);
    const ctx = buildContractAlertContext(c.رقم_العقد);
    upsertAlert({
      id,
      تاريخ_الانشاء: todayIso,
      نوع_التنبيه: 'قرب انتهاء العقد',
      الوصف: `عقد الإيجار سينتهي خلال ${daysLeft} يوم — تاريخ الانتهاء: ${String(asUnknownRecord(c)['تاريخ_النهاية'] ?? '')}`,
      category: 'Expiry',
      تم_القراءة: false,
      ...ctx,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: c.رقم_العقد,
    });
  }

  markAlertsReadIfNotInSet('ALR-EXP-', alive);
};

const runRiskScanInternal = () => {
  const today = toDateOnly(new Date());
  const todayIso = formatDateOnly(today);

  const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
    .filter((c) => isTenancyRelevant(c))
    .filter((c) => !c.isArchived);
  if (contracts.length === 0) {
    markAlertsReadByPrefix('ALR-RISK-');
    return;
  }

  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const blacklist = get<BlacklistRecord>(KEYS.BLACKLIST).filter((b) => b.isActive);
  const blacklistByPerson = new Map<string, BlacklistRecord>();
  for (const b of blacklist) blacklistByPerson.set(String(b.personId), b);

  const norm = (v: unknown) => String(v ?? '').trim();
  const alive = new Set<string>();

  for (const c of contracts) {
    const tenantId = String(asUnknownRecord(c)['رقم_المستاجر'] ?? '').trim();
    const tenant = tenantId ? people.find((p) => String(p.رقم_الشخص) === tenantId) : undefined;
    const propertyId = String(asUnknownRecord(c)['رقم_العقار'] ?? '').trim();
    const property = properties.find((p) => String(p.رقم_العقار) === propertyId);
    const ctx = {
      tenantName: tenant?.الاسم,
      phone: tenant?.رقم_الهاتف,
      propertyCode: property?.الكود_الداخلي,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: c.رقم_العقد,
    } as Partial<tbl_Alerts>;

    // 1) Blacklist risk
    const bl = tenantId ? blacklistByPerson.get(tenantId) : undefined;
    if (bl) {
      const id = `ALR-RISK-BL-${c.رقم_العقد}`;
      alive.add(id);
      upsertAlert({
        id,
        تاريخ_الانشاء: todayIso,
        نوع_التنبيه: 'مستأجر ضمن القائمة السوداء',
        الوصف: `المستأجر مدرج بالقائمة السوداء (${bl.severity}). السبب: ${bl.reason}`,
        category: 'Risk',
        تم_القراءة: false,
        details: tenant ? [{ id: tenantId, name: tenant.الاسم, note: bl.reason }] : undefined,
        ...ctx,
      });
    }

    // 2) Overdue installments risk (conservative threshold to avoid spam)
    const overdueThresholdDays = 14;
    const contractInstallments = installments
      .filter((i) => String(i.رقم_العقد) === String(c.رقم_العقد))
      .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
      .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
      .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

    const overdue = contractInstallments
      .map((i) => {
        const due = parseDateOnly(String(i.تاريخ_استحقاق || ''));
        const { remaining } = getInstallmentPaidAndRemaining(i);
        if (!due) return null;
        if (remaining <= 0) return null;
        const daysLate = daysBetweenDateOnly(due, today);
        if (daysLate < overdueThresholdDays) return null;
        return { inst: i, due: formatDateOnly(due), remaining, daysLate };
      })
      .filter(Boolean) as Array<{
      inst: الكمبيالات_tbl;
      due: string;
      remaining: number;
      daysLate: number;
    }>;

    if (overdue.length > 0) {
      const id = `ALR-RISK-OD-${c.رقم_العقد}`;
      alive.add(id);

      const total = overdue.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);
      upsertAlert({
        id,
        تاريخ_الانشاء: todayIso,
        نوع_التنبيه: 'مخاطر تحصيل (دفعات متأخرة)',
        الوصف: `يوجد ${overdue.length} دفعات متأخرة (${overdueThresholdDays}+ يوم). إجمالي المتبقي: ${formatCurrencyJOD(total)}`,
        category: 'Risk',
        تم_القراءة: false,
        count: overdue.length,
        details: overdue.slice(0, 20).map((x) => ({
          id: x.inst.رقم_الكمبيالة,
          name: `كمبيالة ${x.inst.رقم_الكمبيالة}`,
          note: `متأخر ${x.daysLate} يوم — تاريخ الاستحقاق: ${x.due} — المتبقي: ${formatCurrencyJOD(Number(x.remaining || 0))}`,
        })),
        ...ctx,
      });
    }
  }

  markAlertsReadIfNotInSet('ALR-RISK-', alive);
};

// --- INITIALIZATION ---

const CONTRACT_NUMBER_MIGRATION_KEY = 'migration_contract_numbers_cot_v1';

const isCanonicalContractNumber = (id: string) => /^cot_\d+$/i.test(String(id || '').trim());

const normalizeCotContractNumber = (id: string): string => {
  const raw = String(id || '').trim();
  const m = /^cot_(\d+)$/i.exec(raw);
  if (!m) return raw;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return `cot_${String(n).padStart(3, '0')}`;
};

const toYyyyMmDdKey = (raw: string): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '19700101';

  // Common formats: YYYY-MM-DD, YYYY/MM/DD, or ISO.
  const m1 = /^(\d{4})[-\/](\d{2})[-\/](\d{2})/.exec(s);
  if (m1) return `${m1[1]}${m1[2]}${m1[3]}`;

  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return '19700101';
  const d = new Date(ts);
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

const migrateLegacyContractNumbersOnce = () => {
  try {
    if (localStorage.getItem(CONTRACT_NUMBER_MIGRATION_KEY) === '1') return;
  } catch {
    // ignore
  }

  try {
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    if (!Array.isArray(contracts) || contracts.length === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    const usedIds = new Set<string>();
    const usedSeq = new Set<number>();
    let maxSeq = 0;

    const mapping = new Map<string, string>();

    for (const c of contracts) {
      const raw = String(c?.رقم_العقد ?? '').trim();
      if (!raw) continue;
      if (isCanonicalContractNumber(raw)) {
        const normalized = normalizeCotContractNumber(raw);
        const m = /^cot_(\d+)$/i.exec(normalized);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n)) {
            usedSeq.add(n);
            if (n > maxSeq) maxSeq = n;
          }
        }
        usedIds.add(normalized);
        if (normalized !== raw) mapping.set(raw, normalized);
      }
    }

    const legacy = contracts
      .map((c) => ({
        c,
        oldId: String(c?.رقم_العقد ?? '').trim(),
        dateKey: toYyyyMmDdKey(String(c?.تاريخ_البداية ?? '')),
      }))
      .filter((x) => x.oldId && !isCanonicalContractNumber(x.oldId));

    if (legacy.length === 0 && mapping.size === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    legacy.sort((a, b) => {
      const cmp = String(a.dateKey).localeCompare(String(b.dateKey));
      if (cmp) return cmp;
      return String(a.oldId).localeCompare(String(b.oldId), 'en', {
        numeric: true,
        sensitivity: 'base',
      });
    });

    let seq = maxSeq + 1;
    for (const item of legacy) {
      if (!item.oldId) continue;
      // If multiple records share oldId, they will share newId (legacy data ambiguity).
      if (mapping.has(item.oldId)) continue;

      while (usedSeq.has(seq) || usedIds.has(`cot_${String(seq).padStart(3, '0')}`)) {
        seq++;
      }
      const newId = `cot_${String(seq).padStart(3, '0')}`;
      mapping.set(item.oldId, newId);
      usedSeq.add(seq);
      usedIds.add(newId);
      seq++;
    }

    if (mapping.size === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    // 1) Contracts (primary)
    const nextContracts = contracts.map((c) => {
      const oldId = String(c?.رقم_العقد ?? '').trim();
      const nextId = mapping.get(oldId);
      if (!nextId) {
        // Still may reference other contract IDs.
        const linked = String(asUnknownRecord(c)['linkedContractId'] ?? '').trim();
        const rel = String(asUnknownRecord(c)['عقد_مرتبط'] ?? '').trim();
        const patch = { ...c } as العقود_tbl;
        if (linked && mapping.has(linked)) asUnknownRecord(patch)['linkedContractId'] = mapping.get(linked);
        if (rel && mapping.has(rel)) asUnknownRecord(patch)['عقد_مرتبط'] = mapping.get(rel);
        return patch;
      }

      const patch = { ...c, رقم_العقد: nextId } as العقود_tbl;
      const linked = String(asUnknownRecord(c)['linkedContractId'] ?? '').trim();
      const rel = String(asUnknownRecord(c)['عقد_مرتبط'] ?? '').trim();
      if (linked && mapping.has(linked)) asUnknownRecord(patch)['linkedContractId'] = mapping.get(linked);
      if (rel && mapping.has(rel)) asUnknownRecord(patch)['عقد_مرتبط'] = mapping.get(rel);
      return patch;
    });
    save(KEYS.CONTRACTS, nextContracts);

    // 2) Installments
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    if (Array.isArray(installments) && installments.length) {
      const nextInstallments = installments.map((i) => {
        const oldId = String(i?.رقم_العقد ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...i, رقم_العقد: nextId } as الكمبيالات_tbl) : i;
      });
      save(KEYS.INSTALLMENTS, nextInstallments);
    }

    // 3) Commissions
    const commissions = get<العمولات_tbl>(KEYS.COMMISSIONS);
    if (Array.isArray(commissions) && commissions.length) {
      const nextCommissions = commissions.map((r) => {
        const oldId = String(r?.رقم_العقد ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...r, رقم_العقد: nextId } as العمولات_tbl) : r;
      });
      save(KEYS.COMMISSIONS, nextCommissions);
    }

    // 4) Attachments (Contract)
    const atts = get<Attachment>(KEYS.ATTACHMENTS);
    if (Array.isArray(atts) && atts.length) {
      const nextAtts = atts.map((a) => {
        if (a?.referenceType !== 'Contract') return a;
        const oldId = String(a?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...a, referenceId: nextId } as Attachment) : a;
      });
      save(KEYS.ATTACHMENTS, nextAtts);
    }

    // 5) Activities/Notes (Contract)
    const acts = get<ActivityRecord>(KEYS.ACTIVITIES);
    if (Array.isArray(acts) && acts.length) {
      const nextActs = acts.map((a) => {
        if (a?.referenceType !== 'Contract') return a;
        const oldId = String(a?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...a, referenceId: nextId } as ActivityRecord) : a;
      });
      save(KEYS.ACTIVITIES, nextActs);
    }
    const notes = get<NoteRecord>(KEYS.NOTES);
    if (Array.isArray(notes) && notes.length) {
      const nextNotes = notes.map((n) => {
        if (n?.referenceType !== 'Contract') return n;
        const oldId = String(n?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...n, referenceId: nextId } as NoteRecord) : n;
      });
      save(KEYS.NOTES, nextNotes);
    }

    // 6) Clearance records
    const crs = get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS);
    if (Array.isArray(crs) && crs.length) {
      const nextCrs = crs.map((r) => {
        const oldId = String(r?.contractId ?? '').trim();
        const nextId = mapping.get(oldId);
        if (!nextId) return r;
        const nextRec: ClearanceRecord = { ...r, contractId: nextId };
        if (String(asUnknownRecord(r)['id'] ?? '') === `CLR-${oldId}`) {
          asUnknownRecord(nextRec)['id'] = `CLR-${nextId}`;
        }
        return nextRec;
      });
      save(KEYS.CLEARANCE_RECORDS, nextCrs);
    }

    // 7) Legal history
    const legal = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    if (Array.isArray(legal) && legal.length) {
      const nextLegal = legal.map((r) => {
        const oldId = String(r?.contractId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...r, contractId: nextId } as LegalNoticeRecord) : r;
      });
      save(KEYS.LEGAL_HISTORY, nextLegal);
    }

    // 8) Notification send logs
    const nlogs = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
    if (Array.isArray(nlogs) && nlogs.length) {
      const nextLogs = nlogs.map((l) => {
        const oldId = String(asUnknownRecord(l)['contractId'] ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...l, contractId: nextId } as NotificationSendLogRecord) : l;
      });
      save(KEYS.NOTIFICATION_SEND_LOGS, nextLogs);
    }

    try {
      localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('Contract number migration failed', e);
  }
};

const initData = async () => {
  // Production-only: ensure no legacy demo flags remain.
  try {
    localStorage.removeItem('demo_data_loaded');
  } catch {
    // ignore
  }
  try {
    await storage.removeItem('demo_data_loaded');
  } catch {
    // ignore
  }

  // SECURITY: Do not auto-seed a default admin in production.
  // For dev/automation only, you may opt-in via:
  // - VITE_SEED_DEFAULT_ADMIN=true (and DEV mode)
  // - Optional: VITE_SEED_DEFAULT_ADMIN_USERNAME / VITE_SEED_DEFAULT_ADMIN_PASSWORD
  try {
    const env = import.meta.env;
    const isDev = !!env?.DEV;
    const seedEnabled = String(env?.VITE_SEED_DEFAULT_ADMIN || '').toLowerCase() === 'true';
    if (isDev && seedEnabled) {
      const usersFromStorage = await storage.getItem(KEYS.USERS).catch(() => null);
      const usersFromLocalStorage = localStorage.getItem(KEYS.USERS);
      const usersSerialized = usersFromStorage ?? usersFromLocalStorage;

      let shouldSeedAdmin = false;
      if (!usersSerialized) {
        shouldSeedAdmin = true;
      } else {
        try {
          const parsed = JSON.parse(usersSerialized);
          // Seed if empty or invalid shape
          shouldSeedAdmin = !Array.isArray(parsed) || parsed.length === 0;
        } catch {
          // If corrupted/unparseable, repair by seeding admin.
          shouldSeedAdmin = true;
        }
      }

      if (shouldSeedAdmin) {
        const username = String(env?.VITE_SEED_DEFAULT_ADMIN_USERNAME || 'admin');
        const passwordPlain = String(env?.VITE_SEED_DEFAULT_ADMIN_PASSWORD || '123456');
        const passwordStored = await hashPassword(passwordPlain);
        save(KEYS.USERS, [
          {
            id: '1',
            اسم_المستخدم: username,
            كلمة_المرور: passwordStored,
            الدور: 'SuperAdmin',
            isActive: true,
          },
        ]);
      }
    }
  } catch {
    // ignore
  }

  // Ensure system lookup categories exist (even on upgraded/old DBs).
  // This powers dropdowns like المدينة/المنطقة/الطابق/صفة العقار in PropertyForm.
  {
    const normKey = normKeySimple;

    const normalizeCategory = (c: LookupCategory): LookupCategory | null => {
      const name = String((c as LookupCategory)?.name || (c as LookupCategory)?.id || '').trim();
      if (!name) return null;
      const id = String((c as LookupCategory)?.id || name).trim();
      const label = String((c as LookupCategory)?.label || name).trim();
      const key = String((c as LookupCategory)?.key || name).trim();
      return {
        ...c,
        id,
        name,
        label,
        key,
      };
    };

    const normalizeLookup = (l: SystemLookup, ensureId: () => string): SystemLookup | null => {
      const category = String((l as SystemLookup)?.category || '').trim();
      const label = String((l as SystemLookup)?.label || '').trim();
      if (!category || !label) return null;
      const id = String((l as SystemLookup)?.id || ensureId()).trim();
      const key = String((l as SystemLookup)?.key || lookupKeyFor(category, label)).trim();
      return {
        ...l,
        id,
        category,
        label,
        key,
      };
    };

    const dedupeCategories = (items: LookupCategory[]) => {
      const byKey = new Map<string, LookupCategory>();
      const idxByKey = new Map<string, number>();
      const out: LookupCategory[] = [];

      for (const c of items) {
        const normalized = normalizeCategory(c);
        if (!normalized) continue;
        const key = normKey(normalized?.key || normalized?.name || normalized?.id);
        if (!key) continue;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, normalized);
          idxByKey.set(key, out.length);
          out.push(normalized);
          continue;
        }

        // Prefer system category if there is a conflict.
        const prevSystem = prev.isSystem === true;
        const curSystem = normalized.isSystem === true;
        if (!prevSystem && curSystem) {
          byKey.set(key, normalized);
          const idx = idxByKey.get(key);
          if (typeof idx === 'number') out[idx] = normalized;
        }
      }
      return out;
    };

    const dedupeLookups = (items: SystemLookup[]) => {
      const byKey = new Map<string, SystemLookup>();
      const idxByKey = new Map<string, number>();
      const out: SystemLookup[] = [];

      const ensureId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (const l of items) {
        const normalized = normalizeLookup(l, ensureId);
        if (!normalized) continue;

        const dkey = `${normKey(normalized?.category)}||${normKey(normalized?.key) || normKey(normalized?.label)}`;
        if (!dkey || dkey === '||') continue;
        const prev = byKey.get(dkey);
        if (!prev) {
          byKey.set(dkey, normalized);
          idxByKey.set(dkey, out.length);
          out.push(normalized);
          continue;
        }

        // Prefer system lookup if there is a conflict.
        const prevSystem = prev.isSystem === true;
        const curSystem = normalized.isSystem === true;
        if (!prevSystem && curSystem) {
          byKey.set(dkey, normalized);
          const idx = idxByKey.get(dkey);
          if (typeof idx === 'number') out[idx] = normalized;
        }
      }
      return out;
    };

    const requiredCategories: LookupCategory[] = [
      { id: 'person_roles', name: 'person_roles', label: 'أدوار الأشخاص', isSystem: true },
      { id: 'company_nature', name: 'company_nature', label: 'طبيعة المنشأة', isSystem: true },
      { id: 'prop_type', name: 'prop_type', label: 'أنواع العقارات', isSystem: true },
      { id: 'prop_status', name: 'prop_status', label: 'حالات العقار', isSystem: true },
      { id: 'prop_city', name: 'prop_city', label: 'المدن', isSystem: true },
      { id: 'prop_region', name: 'prop_region', label: 'المناطق', isSystem: true },
      { id: 'prop_floor', name: 'prop_floor', label: 'الطوابق', isSystem: true },
      { id: 'prop_furnishing', name: 'prop_furnishing', label: 'صفة العقار', isSystem: true },
      { id: 'contract_duration_text', name: 'contract_duration_text', label: 'مدة الإيجار (كتابة)', isSystem: true },
      {
        id: 'contract_rent_payment_text',
        name: 'contract_rent_payment_text',
        label: 'كيفية أداء البدل (كتابة)',
        isSystem: true,
      },
      {
        id: 'ext_comm_type',
        name: 'ext_comm_type',
        label: 'أنواع العمولات الخارجية',
        isSystem: true,
      },
    ];

    const ensureId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const existingCategoriesRaw = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const existingCategories = dedupeCategories(existingCategoriesRaw);
    const mergedCategories = [...existingCategories];
    let categoriesChanged = false;

    if (existingCategories.length !== existingCategoriesRaw.length) categoriesChanged = true;

    for (const c of requiredCategories) {
      const idx = mergedCategories.findIndex((x) => x.id === c.id || x.name === c.name);
      if (idx === -1) {
        mergedCategories.push(c);
        categoriesChanged = true;
        continue;
      }

      // Keep system categories labels in sync across upgrades
      const existing = mergedCategories[idx];
      const shouldUpdateLabel = existing.isSystem && c.isSystem && existing.label !== c.label;
      const shouldUpdateName = existing.isSystem && c.isSystem && existing.name !== c.name;
      if (shouldUpdateLabel || shouldUpdateName) {
        mergedCategories[idx] = {
          ...existing,
          name: shouldUpdateName ? c.name : existing.name,
          label: shouldUpdateLabel ? c.label : existing.label,
        };
        categoriesChanged = true;
      }
    }

    const mergedCategoriesFinal = dedupeCategories(mergedCategories);
    if (mergedCategoriesFinal.length !== mergedCategories.length) categoriesChanged = true;

    // Migration: consolidate legacy/duplicate categories into the canonical ones used by Contract modal.
    // This removes extra categories from Settings while preserving their items (items are remapped below).
    const categoryAliases: Record<string, string> = {
      contract_duration: 'contract_duration_text',
      contract_rent_payment_clause: 'contract_rent_payment_text',
      contract_payment_terms: 'contract_rent_payment_text',
    };

    const isAliasCategory = (c: LookupCategory) => {
      const id = String(c?.id || '').trim();
      const name = String(c?.name || id).trim();
      return Boolean(categoryAliases[id] || categoryAliases[name]);
    };

    const mergedCategoriesClean = mergedCategoriesFinal.filter((c) => !isAliasCategory(c));
    if (mergedCategoriesClean.length !== mergedCategoriesFinal.length) categoriesChanged = true;

    if (categoriesChanged || !localStorage.getItem(KEYS.LOOKUP_CATEGORIES)) {
      save(KEYS.LOOKUP_CATEGORIES, mergedCategoriesClean);
    }

    const requiredLookups: Array<Omit<SystemLookup, 'id'> & { id?: string }> = [
      { category: 'person_roles', label: 'مالك', id: '1' },
      { category: 'person_roles', label: 'مستأجر', id: '2' },
      { category: 'person_roles', label: 'كفيل', id: '3' },
      { category: 'company_nature', label: 'شركة' },
      { category: 'company_nature', label: 'مؤسسة' },
      { category: 'prop_type', label: 'شقة', id: '4' },
      { category: 'prop_type', label: 'محل تجاري', id: '5' },
      { category: 'prop_status', label: 'شاغر', id: '6' },
      { category: 'prop_status', label: 'مؤجر', id: '7' },

      // Defaults for PropertyForm initial values
      { category: 'prop_city', label: 'عمان' },
      { category: 'prop_furnishing', label: 'فارغ' },
      { category: 'prop_furnishing', label: 'مفروش' },
      { category: 'prop_floor', label: 'أرضي' },
      { category: 'prop_floor', label: 'الأول' },
      { category: 'prop_floor', label: 'الثاني' },
      { category: 'prop_floor', label: 'الثالث' },

      // External income types (editable via DynamicSelect)
      { category: 'ext_comm_type', label: 'عمولة خدمة' },
      { category: 'ext_comm_type', label: 'رسوم خدمة' },
      { category: 'ext_comm_type', label: 'إحالة (Referral)' },

      // Contracts: duration text (editable in Settings > الجداول المساعدة)
      { category: 'contract_duration_text', label: 'سنة واحدة تجدد تلقائي برضى الطرفين' },
    ];

    const existingLookupsRaw = get<SystemLookup>(KEYS.LOOKUPS);
    const existingLookups = dedupeLookups(existingLookupsRaw);
    const mergedLookups = [...existingLookups];
    let lookupsChanged = false;

    if (existingLookups.length !== existingLookupsRaw.length) lookupsChanged = true;

    for (const l of requiredLookups) {
      const requiredKey = lookupKeyFor(l.category, l.label);
      const exists = mergedLookups.some(
        (x) =>
          x.category === l.category &&
          (normKey(x.label) === normKey(l.label) || (requiredKey && normKey(x.key) === normKey(requiredKey)))
      );
      if (!exists) {
        mergedLookups.push({
          id: l.id ?? ensureId(),
          category: l.category,
          label: l.label,
          key: requiredKey || undefined,
        });
        lookupsChanged = true;
      }
    }

    const mergedLookupsFinal = dedupeLookups(mergedLookups);
    if (mergedLookupsFinal.length !== mergedLookups.length) lookupsChanged = true;

    // Migration continued: remap lookups from legacy categories into canonical categories.
    const remappedLookups = mergedLookupsFinal.map((l) => {
      const fromCat = String(l?.category || '').trim();
      const toCat = categoryAliases[fromCat] || fromCat;
      if (!fromCat || toCat === fromCat) return l;
      const nextKey = lookupKeyFor(toCat, String(l?.label || ''));
      return {
        ...l,
        category: toCat,
        key: nextKey || l.key,
      };
    });

    const remappedLookupsFinal = dedupeLookups(remappedLookups);
    if (remappedLookupsFinal.length !== mergedLookupsFinal.length) lookupsChanged = true;
    if (remappedLookupsFinal.some((x, i) => x.category !== mergedLookupsFinal[i]?.category)) lookupsChanged = true;

    if (lookupsChanged || !localStorage.getItem(KEYS.LOOKUPS)) {
      save(KEYS.LOOKUPS, remappedLookupsFinal);
    }
  }

  // Initialize / merge Legal Templates
  // - If empty: seed defaults
  // - If exists: merge missing defaults by id (do not overwrite existing content)
  try {
    const existing = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES);
    if (
      !Array.isArray(existing) ||
      existing.length === 0 ||
      !localStorage.getItem(KEYS.LEGAL_TEMPLATES)
    ) {
      save(KEYS.LEGAL_TEMPLATES, MOCK_LEGAL_TEMPLATES);
    } else {
      const byId = new Set(existing.map((t) => String(t.id)));
      const merged = [...existing];
      let changed = false;
      for (const t of MOCK_LEGAL_TEMPLATES) {
        if (!byId.has(String(t.id))) {
          merged.push(t);
          changed = true;
        }
      }
      if (changed) save(KEYS.LEGAL_TEMPLATES, merged);
    }
  } catch {
    // Fallback to safe seed
    save(KEYS.LEGAL_TEMPLATES, MOCK_LEGAL_TEMPLATES);
  }

  // Cleanup legacy duplicates/stale financial alerts before building in-memory cache.
  dedupeAndCleanupAlertsInternal();

  // Legacy migration: unify old Companies registry into People to avoid architecture fragmentation.
  // Maps company national number into person.الرقم_الوطني and marks record as نوع_الملف='منشأة'.
  try {
    const legacyCompaniesRaw = localStorage.getItem(KEYS.COMPANIES);
    const legacyCompanies: المنشآت_tbl[] = legacyCompaniesRaw ? JSON.parse(legacyCompaniesRaw) : [];
    if (Array.isArray(legacyCompanies) && legacyCompanies.length > 0) {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);

      const peopleByNationalId = new Map<string, الأشخاص_tbl>();
      const peopleByPhone = new Map<string, الأشخاص_tbl>();
      for (const p of people) {
        const nid = String(p.الرقم_الوطني || '').trim();
        const phone = String(p.رقم_الهاتف || '').trim();
        if (nid) peopleByNationalId.set(nid, p);
        if (phone) peopleByPhone.set(phone, p);
      }

      let changed = false;
      const nextPeople = [...people];
      const nextRoles = [...roles];

      for (const c of legacyCompanies) {
        if (!c) continue;
        const cRec = asUnknownRecord(c);
        const name = String(cRec['الاسم'] || '').trim();
        const phone = String(cRec['رقم_الهاتف'] || '').trim();
        const reg = String(cRec['الرقم_الوطني_للمنشأة'] || '').trim();
        const nature = String(cRec['طبيعة_الشركة'] || '').trim();
        const companyRoles: string[] = Array.isArray(cRec['الأدوار']) ? (cRec['الأدوار'] as unknown[]).map(String) : [];

        if (!name || !phone) continue;

        const existing = (reg && peopleByNationalId.get(reg)) || peopleByPhone.get(phone);

        if (existing) {
          const idx = nextPeople.findIndex((p) => p.رقم_الشخص === existing.رقم_الشخص);
          if (idx > -1) {
            const updated: الأشخاص_tbl & { طبيعة_الشركة?: string } = {
              ...nextPeople[idx],
              الاسم: nextPeople[idx].الاسم || name,
              رقم_الهاتف: nextPeople[idx].رقم_الهاتف || phone,
              الرقم_الوطني: nextPeople[idx].الرقم_الوطني || reg || undefined,
              العنوان: nextPeople[idx].العنوان || (String(cRec['العنوان'] || '').trim() || undefined),
              ملاحظات: nextPeople[idx].ملاحظات || (String(cRec['ملاحظات'] || '').trim() || undefined),
              نوع_الملف: 'منشأة',
              طبيعة_الشركة:
                String(asUnknownRecord(nextPeople[idx])['طبيعة_الشركة'] || '').trim() || nature || undefined,
            };
            nextPeople[idx] = updated;

            const mergedRoles = companyRoles.length ? companyRoles : ['مستأجر'];
            const existingRoles = new Set(
              nextRoles.filter((r) => r.رقم_الشخص === existing.رقم_الشخص).map((r) => r.الدور)
            );
            for (const r of mergedRoles) {
              if (r && !existingRoles.has(r)) {
                nextRoles.push({ رقم_الشخص: existing.رقم_الشخص, الدور: r });
              }
            }
            changed = true;
          }
          continue;
        }

        const newId =
          String(cRec['رقم_المنشأة'] || '').trim() ||
          `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const primaryRole = (companyRoles[0] || 'مستأجر') as string;

        const newPerson: الأشخاص_tbl & { طبيعة_الشركة?: string } = {
          رقم_الشخص: newId,
          الاسم: name,
          رقم_الهاتف: phone,
          الرقم_الوطني: reg || undefined,
          العنوان: String(cRec['العنوان'] || '').trim() || undefined,
          ملاحظات: String(cRec['ملاحظات'] || '').trim() || undefined,
          رقم_نوع_الشخص: primaryRole,
          نوع_الملف: 'منشأة',
          طبيعة_الشركة: nature || undefined,
        };

        nextPeople.push(newPerson);
        for (const r of companyRoles.length ? companyRoles : [primaryRole]) {
          if (r) nextRoles.push({ رقم_الشخص: newId, الدور: r });
        }

        changed = true;
      }

      if (changed) {
        save(KEYS.PEOPLE, nextPeople);
        save(KEYS.ROLES, nextRoles);
        // Clear legacy table after successful migration
        save(KEYS.COMPANIES, []);
      }
    }
  } catch (e) {
    console.warn('Legacy companies migration failed', e);
  }

  // One-time migration: normalize/migrate all contract IDs into cot_### and update cross-table references.
  migrateLegacyContractNumbersOnce();

  if (!DbCache.isInitialized) buildCache();
};

initData();

export const DbService = {
  refreshFromServer: () => initData(),

  logEvent: (user: string, action: string, table: string, details: string) => {
    logOperationInternal(user, action, table, 'N/A', details);
  },

  // People domain: ./db/people (+ cascade delete stays here)
  getPeople,
  getPersonRoles,
  updatePersonRoles,
  addPerson: (data: Omit<الأشخاص_tbl, 'رقم_الشخص'>, roles: string[]) =>
    addPersonWithAutoLinkInternal(data, roles),
  updatePerson: (id: string, patch: Partial<الأشخاص_tbl>) =>
    updatePersonWithAutoLinkInternal(id, patch),
  deletePerson: deletePersonCascadeInternal,
  getPersonDetails,
  getPersonBlacklistStatus,
  getBlacklist,
  getBlacklistRecord,
  addToBlacklist,
  updateBlacklistRecord,
  removeFromBlacklist,
  generateWhatsAppLink,

  // Contacts book (local-only phonebook entries that do NOT have to exist in People)
  getContacts: () => getContactsBook(),
  upsertContact: (payload: { name: string; phone: string; extraPhone?: string }) =>
    upsertContactBookInternal(payload),
  getContactsDirectory: () => getContactsDirectoryInternal(),

  // Phase 3A Part 2: Properties domain functions (re-exported from propertiesService.ts)
  getProperties,
  addProperty,
  updateProperty,
  deleteProperty: deletePropertyCascadeInternal,
  getPropertyDetails,

  // Contract writes / cascade remain in mockDb; reads in ./db/contracts
  getContracts,
  getInstallments: () => get<الكمبيالات_tbl>(KEYS.INSTALLMENTS),
  getCommissions: () => get<العمولات_tbl>(KEYS.COMMISSIONS),

  updateCommission: (id: string, patch: Partial<العمولات_tbl>): DbResult<العمولات_tbl> => {
    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const idx = all.findIndex((c) => c.رقم_العمولة === id);
    if (idx === -1) return fail('العمولة غير موجودة');

    const next: العمولات_tbl = {
      ...all[idx],
      ...patch,
    };

    // ✅ حسب المواصفة: اعتماد الحساب على شهر/تاريخ العمولة.
    // نُبقي شهر_دفع_العمولة بصيغة YYYY-MM فقط، ونشتقه من تاريخ_العقد (تاريخ العملية/العمولة) إذا كان فارغاً.
    const paidMonthRaw = String(next.شهر_دفع_العمولة ?? '').trim();
    if (paidMonthRaw && !/^\d{4}-\d{2}$/.test(paidMonthRaw)) {
      next.شهر_دفع_العمولة = undefined;
    }
    if (!String(next.شهر_دفع_العمولة ?? '').trim()) {
      const d = String(next.تاريخ_العقد ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) next.شهر_دفع_العمولة = d.slice(0, 7);
      else if (/^\d{4}-\d{2}$/.test(d)) next.شهر_دفع_العمولة = d;
    }

    next.عمولة_المالك = Number(next.عمولة_المالك || 0);
    next.عمولة_المستأجر = Number(next.عمولة_المستأجر || 0);
    next.المجموع = Number(next.عمولة_المالك || 0) + Number(next.عمولة_المستأجر || 0);

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.COMMISSIONS, updated);

    // Keep contract opportunity number in sync when edited from commissions UI
    if (Object.prototype.hasOwnProperty.call(patch, 'رقم_الفرصة')) {
      const contractId = String(next.رقم_العقد || '').trim();
      if (contractId) {
        const oppRaw = String(patch.رقم_الفرصة ?? '').trim();
        const allContracts = get<العقود_tbl>(KEYS.CONTRACTS);
        const cIdx = allContracts.findIndex((c) => c.رقم_العقد === contractId);
        if (cIdx > -1) {
          const nextContracts = [...allContracts];
          nextContracts[cIdx] = {
            ...nextContracts[cIdx],
            رقم_الفرصة: oppRaw || undefined,
          };
          save(KEYS.CONTRACTS, nextContracts);
        }
      }
    }

    logOperationInternal('Admin', 'تعديل', 'Commissions', id, `تعديل عمولة عقد: ${next.رقم_العقد}`);
    return ok(next);
  },

  postponeCommissionCollection: (
    commissionId: string,
    newDate: string,
    target?: 'Owner' | 'Tenant',
    note?: string
  ): DbResult<العمولات_tbl> => {
    const date = String(newDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('تاريخ غير صالح');

    const who: العمولات_tbl['جهة_تحصيل_مؤجل'] =
      target === 'Tenant' ? 'مستأجر' : target === 'Owner' ? 'مالك' : undefined;

    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const idx = all.findIndex((c) => c.رقم_العمولة === commissionId);
    if (idx === -1) return fail('العمولة غير موجودة');

    // ✅ حسب المطلوب: إذا صار التحصيل بشهر جديد، تُحسب ضمن الشهر الجديد.
    // لذلك نُحدّث شهر_دفع_العمولة وتاريخ_العقد (المستخدم كتاريخ عمولة/عملية).
    const next: العمولات_tbl = {
      ...all[idx],
      تاريخ_تحصيل_مؤجل: date,
      جهة_تحصيل_مؤجل: who,
      شهر_دفع_العمولة: date.slice(0, 7),
      تاريخ_العقد: date,
    };
    const updated = [...all];
    updated[idx] = next;
    save(KEYS.COMMISSIONS, updated);

    const contractId = String(next.رقم_العقد || '').trim();
    const title = `تحصيل عمولة${who ? ` (${who})` : ''} عقد #${contractId}`;
    DbService.addReminder({ title, date, type: 'Payment' });

    const msg = `تم تأجيل تحصيل عمولة${who ? ` (${who})` : ''} عقد #${contractId} إلى ${date}${note ? ` — ${String(note).trim()}` : ''}`;
    DbService.createAlert(
      'تأجيل تحصيل',
      msg,
      'Financial',
      undefined,
      buildContractAlertContext(contractId)
    );

    logOperationInternal('Admin', 'تأجيل تحصيل', 'Commissions', commissionId, msg);
    return ok(next);
  },

  postponeInstallmentCollection: (
    installmentId: string,
    newDueDate: string,
    note?: string
  ): DbResult<الكمبيالات_tbl> => {
    const date = String(newDueDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('تاريخ غير صالح');

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === installmentId);
    if (idx === -1) return fail('الكمبيالة غير موجودة');

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    const oldDate = String(inst.تاريخ_استحقاق || '').trim();
    inst.تاريخ_استحقاق = date;

    // Persist explicit deferral metadata
    const now = new Date().toISOString().split('T')[0];
    inst.تاريخ_التأجيل = now;
    inst.تاريخ_الاستحقاق_السابق = oldDate || undefined;
    const extra = (note || '').trim();
    const line = `تأجيل تحصيل: من ${oldDate || '-'} إلى ${date}${extra ? ` | ${extra}` : ''}`;
    inst.ملاحظات = (inst.ملاحظات || '').trim();
    inst.ملاحظات += (inst.ملاحظات ? '\n' : '') + `[${now}] ${line}`;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    const contractId = String(inst.رقم_العقد || '').trim();
    const title = `تحصيل دفعة مؤجلة (عقد #${contractId}) — مؤجل بتاريخ ${now}`;
    DbService.addReminder({ title, date, type: 'Payment' });

    const msg = `تم تأجيل تحصيل دفعة لعقد #${contractId} من ${oldDate || '-'} إلى ${date} (تاريخ التأجيل: ${now})${extra ? ` — ${extra}` : ''}`;
    DbService.createAlert('تأجيل تحصيل', msg, 'Financial', undefined, {
      ...buildContractAlertContext(contractId),
      مرجع_الجدول: 'الكمبيالات_tbl',
      مرجع_المعرف: String(installmentId),
    });

    logOperationInternal('Admin', 'تأجيل تحصيل', 'الكمبيالات', installmentId, msg);
    return ok(inst);
  },

  upsertCommissionForContract: (
    contractId: string,
    values: {
      commOwner: number;
      commTenant: number;
      commissionPaidMonth?: string;
      employeeUsername?: string;
    }
  ): DbResult<العمولات_tbl> => {
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
    if (!contract) return fail('العقد غير موجود');

    const commOwner = Number(values.commOwner || 0);
    const commTenant = Number(values.commTenant || 0);
    const now = new Date();
    const nowYMD = now.toISOString().slice(0, 10);
    const nowYM = now.toISOString().slice(0, 7);
    const month =
      values.commissionPaidMonth && /^\d{4}-\d{2}$/.test(String(values.commissionPaidMonth))
        ? String(values.commissionPaidMonth)
        : nowYM;

    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const existing = all.find((c) => c.رقم_العقد === contractId);

    const employeeUsername = String(values.employeeUsername || '').trim() || undefined;

    if (existing) {
      const patch: Partial<العمولات_tbl> & { اسم_المستخدم?: string } = {
        عمولة_المالك: commOwner,
        عمولة_المستأجر: commTenant,
        شهر_دفع_العمولة: month,
      };
      if (employeeUsername) patch.اسم_المستخدم = employeeUsername;
      return DbService.updateCommission(existing.رقم_العمولة, patch);
    }

    const record: العمولات_tbl & { اسم_المستخدم?: string } = {
      رقم_العمولة: `COM-${contractId}`,
      رقم_العقد: contractId,
      // تاريخ_العقد هنا = تاريخ العملية/العمولة (وليس تاريخ العقد)
      تاريخ_العقد: nowYMD,
      شهر_دفع_العمولة: month,
      عمولة_المالك: commOwner,
      عمولة_المستأجر: commTenant,
      المجموع: commOwner + commTenant,
    };
    if (employeeUsername) record.اسم_المستخدم = employeeUsername;

    save(KEYS.COMMISSIONS, [...all, record]);
    logOperationInternal(
      'Admin',
      'إضافة',
      'Commissions',
      record.رقم_العمولة,
      `إنشاء عمولة عقد: ${contractId}`
    );
    return ok(record);
  },

  deleteCommission: (id: string): DbResult<null> => {
    const all = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const target = all.find((c) => c.رقم_العمولة === id);
    if (!target) return ok();

    save(
      KEYS.COMMISSIONS,
      all.filter((c) => c.رقم_العمولة !== id)
    );
    logOperationInternal('Admin', 'حذف', 'Commissions', id, `حذف عمولة عقد: ${target.رقم_العقد}`);
    return ok();
  },

  getLogs: () => get<العمليات_tbl>(KEYS.LOGS),
  getSystemUsers: () =>
    get<unknown>(KEYS.USERS).filter(
      (u): u is المستخدمين_tbl => isUnknownRecord(u) && typeof u['id'] === 'string'
    ),
  getAlerts: () => get<tbl_Alerts>(KEYS.ALERTS),

  getPaymentNotificationTargets: (daysAhead: number = 7) =>
    getPaymentNotificationTargetsInternal(daysAhead),
  getNotificationSendLogs: () => get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS),
  addNotificationSendLog: (log: Omit<NotificationSendLogRecord, 'id'>) =>
    addNotificationSendLogInternal(log),
  updateNotificationSendLog: (
    id: string,
    patch: Partial<Pick<NotificationSendLogRecord, 'note' | 'reply'>>
  ) => updateNotificationSendLogInternal(id, patch),
  deleteNotificationSendLog: (id: string) => deleteNotificationSendLogInternal(id),

  // Create alert with optional callback for notifications
  createAlert: (
    type: string,
    message: string,
    category: string,
    onNotify?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
    ctx?: Partial<
      Pick<
        tbl_Alerts,
        | 'tenantName'
        | 'phone'
        | 'propertyCode'
        | 'مرجع_الجدول'
        | 'مرجع_المعرف'
        | 'details'
        | 'count'
      >
    >
  ): void => {
    const todayISO = new Date().toISOString().split('T')[0];
    const id = stableAlertId(todayISO, type, message, category);

    const existing = (get<tbl_Alerts>(KEYS.ALERTS) || []).some((a) => a.id === id);
    if (existing) return;

    const normalizedCtx: Partial<
      Pick<
        tbl_Alerts,
        | 'tenantName'
        | 'phone'
        | 'propertyCode'
        | 'مرجع_الجدول'
        | 'مرجع_المعرف'
        | 'details'
        | 'count'
      >
    > = {
      ...(ctx || {}),
    };

    const hasRef =
      !!String(normalizedCtx.مرجع_الجدول || '').trim() &&
      !!String(normalizedCtx.مرجع_المعرف || '').trim();
    if (!hasRef) {
      const text = String(message || '').trim();

      const contractMatch = text.match(/عقد\s*#?\s*([^\s،,.;]+)/);
      const installmentMatch = text.match(/كمبيالة\s*#?\s*([^\s،,.;]+)/);

      const contractId = String(contractMatch?.[1] || '').trim();
      const installmentId = String(installmentMatch?.[1] || '').trim();

      if (contractId) {
        Object.assign(normalizedCtx, buildContractAlertContext(contractId));
      } else if (installmentId) {
        normalizedCtx.مرجع_الجدول = 'الكمبيالات_tbl';
        normalizedCtx.مرجع_المعرف = installmentId;

        try {
          const inst = (get<الكمبيالات_tbl>(KEYS.INSTALLMENTS) || []).find(
            (x) => String(x?.رقم_الكمبيالة) === installmentId
          );
          const cId = String(inst?.رقم_العقد || '').trim();
          if (cId) Object.assign(normalizedCtx, buildContractAlertContext(cId));
        } catch {
          // ignore
        }
      }

      // Hard guarantee: every alert has a source.
      if (!String(normalizedCtx.مرجع_الجدول || '').trim()) normalizedCtx.مرجع_الجدول = 'System';
      if (!String(normalizedCtx.مرجع_المعرف || '').trim()) normalizedCtx.مرجع_المعرف = 'batch';
    }

    const alert: tbl_Alerts = {
      id,
      تاريخ_الانشاء: todayISO,
      نوع_التنبيه: type,
      الوصف: message,
      category: category as tbl_Alerts['category'],
      تم_القراءة: false,
      ...normalizedCtx,
    };

    upsertAlert(alert);

    if (onNotify) onNotify(message, type as 'success' | 'error' | 'warning' | 'info');

    logOperationInternal('System', 'إشعار جديد', category, alert.id, message);
  },

  clearOldAlerts: (daysOld: number = 30): void => {
    const alerts = get<tbl_Alerts>(KEYS.ALERTS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filtered = alerts.filter((a) => {
      const alertDate = new Date(a.تاريخ_الانشاء);
      return alertDate > cutoffDate;
    });

    save(KEYS.ALERTS, filtered);
  },

  getLookupsByCategory: (cat: string) => {
    const targetCat = String(cat || '').trim();
    if (!targetCat) return [];

    const rawAll = get<SystemLookup>(KEYS.LOOKUPS);
    const byKey = new Map<string, SystemLookup>();
    const outAll: SystemLookup[] = [];

    const ensureId = () => `LK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (const l of rawAll) {
      const category = String(l?.category || '').trim();
      const label = String(l?.label || '').trim();
      if (!category || !label) continue;

      const key = String(l?.key || lookupKeyFor(category, label) || '').trim() || undefined;
      const normalized: SystemLookup = {
        ...l,
        id: String(l?.id || '').trim() || ensureId(),
        category,
        label,
        key,
      };

      const dkey = `${normKeySimple(category)}||${normKeySimple(key) || normKeySimple(label)}`;
      if (!dkey || dkey === '||') continue;

      const prev = byKey.get(dkey);
      if (!prev) {
        byKey.set(dkey, normalized);
        outAll.push(normalized);
        continue;
      }

      // Prefer system lookup if there is a conflict.
      const prevSystem = prev.isSystem === true;
      const curSystem = normalized.isSystem === true;
      if (!prevSystem && curSystem) {
        byKey.set(dkey, normalized);
        const idx = outAll.findIndex((x) => x === prev);
        if (idx >= 0) outAll[idx] = normalized;
      }
    }

    if (outAll.length !== rawAll.length) {
      save(KEYS.LOOKUPS, outAll);
    }

    return outAll.filter((l) => l.category === targetCat);
  },
  addLookup: (category: string, label: string) => {
    const cat = String(category || '').trim();
    const lab = String(label || '').trim();
    if (!cat || !lab) return;
    const all = get<SystemLookup>(KEYS.LOOKUPS);

    const key = lookupKeyFor(cat, lab);
    const exists = all.some(
      (x) =>
        String(x.category || '').trim() === cat &&
        (normKeySimple(x.label) === normKeySimple(lab) ||
          (!!key && normKeySimple(x.key) === normKeySimple(key)))
    );
    if (exists) return;

    save(KEYS.LOOKUPS, [...all, { id: `LK-${Date.now()}`, category: cat, label: lab, key }]);
    logOperationInternal('Admin', 'إضافة', 'Lookups', category, `إضافة عنصر: ${label}`);
  },
  deleteLookup: (id: string) => {
    const all = get<SystemLookup>(KEYS.LOOKUPS).filter((l) => l.id !== id);
    save(KEYS.LOOKUPS, all);
    logOperationInternal('Admin', 'حذف', 'Lookups', id, 'حذف عنصر قائمة');
  },
  getLookupCategories: () => {
    const raw = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const byKey = new Map<string, LookupCategory>();
    const out: LookupCategory[] = [];

    for (const c of raw) {
      const id = String(c?.id || '').trim();
      const name = String(c?.name || id).trim();
      const label = String(c?.label || name).trim();
      const key = String(c?.key || name || id).trim();
      if (!name || !label) continue;

      const normalized: LookupCategory = {
        ...c,
        id: id || name,
        name,
        label,
        key,
      };

      const dkey = normKeySimple(key) || normKeySimple(name) || normKeySimple(id);
      if (!dkey) continue;

      const prev = byKey.get(dkey);
      if (!prev) {
        byKey.set(dkey, normalized);
        out.push(normalized);
        continue;
      }

      const prevSystem = prev.isSystem === true;
      const curSystem = normalized.isSystem === true;
      if (!prevSystem && curSystem) {
        byKey.set(dkey, normalized);
        const idx = out.findIndex((x) => x === prev);
        if (idx >= 0) out[idx] = normalized;
      }
    }

    if (out.length !== raw.length) {
      save(KEYS.LOOKUP_CATEGORIES, out);
    }

    return out;
  },
  addLookupCategory: (name: string, label: string): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    if (all.some((c) => c.name === name)) return fail('المعرف البرمجي موجود مسبقاً');
    save(KEYS.LOOKUP_CATEGORIES, [...all, { id: name, name, key: name, label, isSystem: false }]);
    logOperationInternal(
      'Admin',
      'إضافة فئة',
      'LookupCategories',
      name,
      `إنشاء جدول بيانات جديد: ${label}`
    );
    return ok();
  },
  updateLookupCategory: (id: string, data: Partial<LookupCategory>): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const idx = all.findIndex((c) => c.id === id);
    if (idx > -1) {
      const oldLabel = all[idx].label;
      all[idx] = { ...all[idx], ...data };
      save(KEYS.LOOKUP_CATEGORIES, all);
      logOperationInternal(
        'Admin',
        'تعديل فئة',
        'LookupCategories',
        id,
        `تحديث اسم الجدول من "${oldLabel}" إلى "${data.label}"`
      );
      return ok();
    }
    return fail('الجدول غير موجود');
  },
  deleteLookupCategory: (id: string): DbResult<null> => {
    const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES).filter((c) => c.id !== id);
    save(KEYS.LOOKUP_CATEGORIES, all);
    const lookups = get<SystemLookup>(KEYS.LOOKUPS).filter((l) => l.category !== id);
    save(KEYS.LOOKUPS, lookups);
    logOperationInternal(
      'Admin',
      'حذف فئة',
      'LookupCategories',
      id,
      `حذف جدول البيانات "${id}" وكافة عناصره`
    );
    return ok();
  },
  importLookups: (category: string, items: string[]) => {
    const cat = String(category || '').trim();
    if (!cat) return;
    const all = get<SystemLookup>(KEYS.LOOKUPS);
    const seen = new Set<string>();

    const incoming = (Array.isArray(items) ? items : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((lab) => {
        const k = normKeySimple(lab);
        if (!k) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    const existingKeys = new Set(
      all
        .filter((x) => String(x.category || '').trim() === cat)
        .map((x) => normKeySimple(x.key) || normKeySimple(x.label))
        .filter(Boolean)
    );

    const newItems = incoming
      .map((lab) => {
        const key = lookupKeyFor(cat, lab);
        const dkey = normKeySimple(key) || normKeySimple(lab);
        if (!dkey || existingKeys.has(dkey)) return null;
        existingKeys.add(dkey);
        return {
          id: `LK-${Math.random().toString(36).slice(2, 11)}`,
          category: cat,
          label: lab,
          key,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    if (newItems.length === 0) return;
    save(KEYS.LOOKUPS, [...all, ...newItems]);
    logOperationInternal('Admin', 'استيراد', 'Lookups', category, `استيراد ${items.length} عنصر`);
  },

  createContract: contractWrites.createContract,
  updateContract: contractWrites.updateContract,

  previewContractInstallments: (
    data: Partial<العقود_tbl>
  ): DbResult<{ installments: الكمبيالات_tbl[] }> => {
    const contractId = `PREVIEW-${Date.now()}`;
    const contract = {
      ...data,
      رقم_العقد: contractId,
    } as العقود_tbl;

    const res = generateContractInstallmentsInternal(contract, contractId);
    if (!res.success || !res.data) return fail(res.message || 'تعذر توليد الدفعات');
    return ok({ installments: res.data });
  },
  getContractDetails,
  archiveContract: contractWrites.archiveContract,
  terminateContract: contractWrites.terminateContract,

  setContractAutoRenew: (id: string, enabled: boolean): DbResult<null> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const idx = all.findIndex((c) => c.رقم_العقد === id);
    if (idx === -1) return fail('العقد غير موجود');
    all[idx].autoRenew = enabled;
    save(KEYS.CONTRACTS, all);
    logOperationInternal(
      'Admin',
      'تعديل',
      'Contracts',
      id,
      `تجديد تلقائي: ${enabled ? 'مفعل' : 'متوقف'}`
    );
    return ok();
  },

  renewContract: contractWrites.renewContract,

  deleteContract: deleteContractCascadeInternal,
  getClearanceRecord: (contractId: string) => {
    return get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS).find((r) => r.contractId === contractId);
  },

  markInstallmentPaid: installmentPayments.markInstallmentPaid,
  updateTenantRating: updateTenantRatingImpl,
  setInstallmentLateFee: installmentPayments.setInstallmentLateFee,

  updateInstallmentDynamicFields: (
    installmentId: string,
    userId: string,
    role: RoleType,
    dynamicFields: Record<string, unknown> | null | undefined
  ): DbResult<null> => {
    const ALLOWED_ROLES: RoleType[] = ['SuperAdmin', 'Admin'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(`الصلاحية غير كافية (${role}): يُسمح فقط بـ ${ALLOWED_ROLES.join(', ')}`);
    }

    const all = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const idx = all.findIndex((i) => i.رقم_الكمبيالة === installmentId);
    if (idx === -1) return fail('الكمبيالة غير موجودة');

    const inst = JSON.parse(JSON.stringify(all[idx])) as الكمبيالات_tbl;
    const cleaned: Record<string, unknown> =
      dynamicFields && typeof dynamicFields === 'object' ? dynamicFields : {};
    const hasAny = Object.keys(cleaned).length > 0;
    asUnknownRecord(inst)['حقول_ديناميكية'] = hasAny ? cleaned : undefined;

    all[idx] = inst;
    save(KEYS.INSTALLMENTS, all);

    logOperationInternal(
      userId,
      'تحديث حقول ديناميكية',
      'الكمبيالات',
      installmentId,
      `[${role}] ${userId} - تحديث الحقول الإضافية`
    );
    return ok();
  },

  reversePayment: installmentPayments.reversePayment,

  getInstallmentPaymentSummary,

  markAllAlertsAsRead: () => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    all.forEach((a) => (a.تم_القراءة = true));
    save(KEYS.ALERTS, all);
  },
  markAlertAsRead: (id: string) => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx > -1) {
      all[idx].تم_القراءة = true;
      save(KEYS.ALERTS, all);
    }
  },
  markMultipleAlertsAsRead: (ids: string[]) => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    all.forEach((a) => {
      if (ids.includes(a.id)) a.تم_القراءة = true;
    });
    save(KEYS.ALERTS, all);
  },

  getDashboardConfig: (userId: string) => {
    const configs = get<unknown>(KEYS.DASHBOARD_CONFIG).filter(isUnknownRecord);
    return configs.find((c) => String(c.userId) === userId) || null;
  },
  saveDashboardConfig: (userId: string, config: Record<string, unknown>) => {
    const configs = get<unknown>(KEYS.DASHBOARD_CONFIG)
      .filter(isUnknownRecord)
      .filter((c) => String(c.userId) !== userId);
    save(KEYS.DASHBOARD_CONFIG, [...configs, { userId, ...config }]);
  },
  getAdminAnalytics: () => DbCache.dashboardStats,

  // --- Security helpers (Marquee) ---
  // Marquee content is user-controlled (and may arrive via sync). Today it's rendered as plain text,
  // but we still sanitize to prevent:
  // - future HTML sinks (XSS)
  // - bidi/control-char spoofing
  // - prototype pollution via action.options
  // Keep this logic local and conservative.

  // Allowed panel IDs (matches src/context/ModalContext.tsx PanelType)
  // Note: keep in sync if new panels are added.
  // We intentionally do not allow arbitrary panel names from synced data.

  _marqueeAllowedPanels: [
    'PERSON_DETAILS',
    'PROPERTY_DETAILS',
    'CONTRACT_DETAILS',
    'INSTALLMENT_DETAILS',
    'MAINTENANCE_DETAILS',
    'GENERIC_ALERT',
    'REPORT_VIEWER',
    'LEGAL_NOTICE_GENERATOR',
    'BULK_WHATSAPP',
    'CONFIRM_MODAL',
    'SALES_LISTING_DETAILS',
    'CLEARANCE_REPORT',
    'CLEARANCE_WIZARD',
    'PERSON_FORM',
    'PROPERTY_FORM',
    'CONTRACT_FORM',
    'INSPECTION_FORM',
    'BLACKLIST_FORM',
    'SMART_PROMPT',
    'CALENDAR_EVENTS',
    'PAYMENT_NOTIFICATIONS',
    'SECTION_VIEW',
    'SERVER_DRAWER',
    'SQL_SYNC_LOG',
    'MARQUEE_ADS',
  ] as const,

  // --- Marquee Ads (Custom) ---
  getMarqueeAds: (): MarqueeAdRecord[] => {
    return getNonExpiredMarqueeAdsInternal().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
  addMarqueeAd: (data: {
    content: string;
    durationHours: number;
    priority?: 'Normal' | 'High';
    type?: 'alert' | 'info' | 'success';
    action?: MarqueeMessage['action'];
  }): DbResult<string> => {
    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(DbService._marqueeAllowedPanels);

    const content = sanitizeMarqueeText(data?.content, 300);
    if (!content) return fail('نص الإعلان مطلوب');

    const hours = Number(data?.durationHours);
    // Allow 0 => permanent (no expiry)
    if (!Number.isFinite(hours) || hours < 0) return fail('مدة الظهور غير صحيحة');
    const hoursClamped = Math.min(hours, 24 * 365 * 5); // cap at 5 years

    const now = Date.now();
    const expiresAt =
      hoursClamped > 0 ? new Date(now + hoursClamped * 60 * 60 * 1000).toISOString() : undefined;
    const ad: MarqueeAdRecord = {
      id: `MAR-${now}`,
      content,
      priority: data.priority || 'Normal',
      type: data.type || 'info',
      createdAt: new Date(now).toISOString(),
      expiresAt,
      enabled: true,
      action: sanitizeAction(data?.action),
    };

    const existing = getNonExpiredMarqueeAdsInternal();
    save(KEYS.MARQUEE, [ad, ...existing]);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok(ad.id);
  },
  updateMarqueeAd: (
    id: string,
    patch: Partial<
      Pick<MarqueeAdRecord, 'content' | 'priority' | 'type' | 'expiresAt' | 'enabled'>
    > & { action?: MarqueeMessage['action'] | null }
  ): DbResult<null> => {
    const all = getNonExpiredMarqueeAdsInternal();
    const idx = all.findIndex((a) => String(a.id) === String(id));
    if (idx < 0) return fail('الإعلان غير موجود');

    const next = { ...all[idx] } as MarqueeAdRecord;

    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(DbService._marqueeAllowedPanels);

    if (typeof patch.content === 'string') {
      const content = sanitizeMarqueeText(patch.content, 300);
      if (!content) return fail('نص الإعلان مطلوب');
      next.content = content;
    }
    if (patch.priority === 'Normal' || patch.priority === 'High') next.priority = patch.priority;
    if (patch.type === 'alert' || patch.type === 'info' || patch.type === 'success')
      next.type = patch.type;
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (typeof patch.expiresAt !== 'undefined') {
      const exp = String(patch.expiresAt || '').trim();
      next.expiresAt = exp ? exp : undefined;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'action')) {
      const a = patch.action as MarqueeMessage['action'] | null | undefined;
      if (a === null) {
        next.action = undefined;
      } else if (!a) {
        next.action = undefined;
      } else {
        next.action = sanitizeAction(a);
      }
    }

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.MARQUEE, updated);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok();
  },
  deleteMarqueeAd: (id: string): DbResult<null> => {
    const all = get<MarqueeAdRecord>(KEYS.MARQUEE);
    const next = all.filter((a) => String(a.id) !== String(id));
    save(KEYS.MARQUEE, next);
    try {
      window.dispatchEvent(new Event('azrar:marquee-changed'));
    } catch {
      void 0;
    }
    return ok();
  },

  getMarqueeMessages: (): MarqueeMessage[] => {
    const messages: MarqueeMessage[] = [];

    const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(DbService._marqueeAllowedPanels);

    // 0) Custom ads (user-added, time-bound)
    try {
      const ads = getActiveMarqueeAdsInternal();
      for (const ad of ads.slice(0, 10)) {
        const content = sanitizeMarqueeText(ad.content, 300);
        if (!content) continue;
        const action = ad.action ? sanitizeAction(ad.action) : undefined;
        messages.push({
          id: `ad_${ad.id}`,
          content,
          priority: ad.priority === 'High' ? 'High' : 'Normal',
          type: ad.type === 'alert' || ad.type === 'success' ? ad.type : 'info',
          ...(action ? { action } : {}),
        });
      }
    } catch {
      // ignore
    }

    const todayYMD = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    const isYmdBefore = (a: string, b: string) => String(a || '') < String(b || '');

    // 1) Urgent unread alerts
    try {
      const unreadCritical = (get<tbl_Alerts>(KEYS.ALERTS) || [])
        .filter((a) => !a.تم_القراءة)
        .filter((a) => a.category === 'Financial' || a.category === 'Risk');

      const criticalCount = unreadCritical.length;

      if (criticalCount > 0) {
        messages.push({
          id: 'alerts_unread',
          content: `🔔 لديك ${criticalCount} تنبيه حرِج غير مقروء`,
          priority: 'High',
          type: 'alert',
          action: { kind: 'hash', hash: '/alerts' },
        });

        // Show a couple of concrete examples for quick context
        const top = unreadCritical.slice(0, 2);
        for (const a of top) {
          const base: MarqueeMessage = {
            id: `alert_${a.id}`,
            content: `تنبيه: ${String(a.الوصف || '').trim()}`,
            priority: 'High',
            type: 'alert',
          };

          const refTable = String(a.مرجع_الجدول || '');
          const refId = String(a.مرجع_المعرف || '');
          if (refTable === 'العقود_tbl' && refId) {
            base.action = { kind: 'panel', panel: 'CONTRACT_DETAILS', id: refId };
          } else if (refTable === 'الكمبيالات_tbl') {
            base.action = { kind: 'hash', hash: '/installments?filter=all' };
          } else if (refTable === 'العقارات_tbl') {
            base.action =
              refId === 'batch'
                ? { kind: 'hash', hash: '/properties' }
                : { kind: 'panel', panel: 'PROPERTY_DETAILS', id: refId };
          } else if (refTable === 'الأشخاص_tbl') {
            base.action =
              refId === 'batch'
                ? { kind: 'hash', hash: '/people' }
                : { kind: 'panel', panel: 'PERSON_DETAILS', id: refId };
          } else {
            base.action = { kind: 'hash', hash: '/alerts' };
          }

          if (base.content !== 'تنبيه:') messages.push(base);
        }
      }
    } catch {
      // ignore
    }

    // 2) Open follow-up tasks (show ALL until completed)
    try {
      const allOpen = (get<FollowUpTask>(KEYS.FOLLOW_UPS) || [])
        .filter((f) => f.status === 'Pending')
        .slice();

      // Sort by due date (earliest first), then createdAt (newest last)
      allOpen.sort((a, b) => {
        const ad = String(a.dueDate || '');
        const bd = String(b.dueDate || '');
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }
        const ac = new Date(String(a.createdAt || '')).getTime();
        const bc = new Date(String(b.createdAt || '')).getTime();
        if (Number.isFinite(ac) && Number.isFinite(bc)) return ac - bc;
        if (Number.isFinite(ac)) return -1;
        if (Number.isFinite(bc)) return 1;
        return 0;
      });

      const openCount = allOpen.length;
      const overdueCount = allOpen.filter((f) => isYmdBefore(String(f.dueDate || ''), todayYMD))
        .length;
      const firstDate = openCount > 0 ? String(allOpen[0]?.dueDate || todayYMD) : todayYMD;

      if (openCount > 0) {
        messages.push({
          id: 'tasks_open',
          content: `📝 لديك ${openCount} مهام مفتوحة${overdueCount > 0 ? ` (${overdueCount} متأخرة)` : ''}`,
          priority: overdueCount > 0 ? 'High' : 'Normal',
          type: 'info',
          action: {
            kind: 'panel',
            panel: 'CALENDAR_EVENTS',
            id: firstDate,
            options: { title: 'المهام' },
          },
        });

        for (const f of allOpen) {
          const dueDate = String(f.dueDate || '').trim();
          const overdue = dueDate ? isYmdBefore(dueDate, todayYMD) : false;
          const taskTitle = String(f.task || '').trim();
          if (!taskTitle) continue;
          messages.push({
            id: `followup_${String(f.id || dueDate || taskTitle)}`,
            content: `${overdue ? '⚠️' : '📝'} مهمة: ${taskTitle}${dueDate ? ` (موعد: ${dueDate})` : ''}`,
            priority: overdue ? 'High' : 'Normal',
            type: 'info',
            action: {
              kind: 'panel',
              panel: 'CALENDAR_EVENTS',
              id: dueDate || todayYMD,
              options: { title: 'المهام' },
            },
          });
        }
      }
    } catch {
      // ignore
    }

    // 3) Open reminders (show ALL until done)
    try {
      const allOpen = (get<SystemReminder>(KEYS.REMINDERS) || [])
        .filter((r) => !r.isDone)
        .slice();

      allOpen.sort((a, b) => {
        const ad = String(a.date || '');
        const bd = String(b.date || '');
        if (ad !== bd) {
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }
        const at = String(a.time || '');
        const bt = String(b.time || '');
        if (at !== bt) return at.localeCompare(bt);
        const ac = new Date(String(asUnknownRecord(a)['createdAt'] || '')).getTime();
        const bc = new Date(String(asUnknownRecord(b)['createdAt'] || '')).getTime();
        if (Number.isFinite(ac) && Number.isFinite(bc)) return ac - bc;
        return 0;
      });

      const openCount = allOpen.length;
      const overdueCount = allOpen.filter((r) => isYmdBefore(String(r.date || ''), todayYMD)).length;
      const firstDate = openCount > 0 ? String(allOpen[0]?.date || todayYMD) : todayYMD;

      if (openCount > 0) {
        messages.push({
          id: 'reminders_open',
          content: `⏰ لديك ${openCount} تذكيرات مفتوحة${overdueCount > 0 ? ` (${overdueCount} متأخرة)` : ''}`,
          priority: overdueCount > 0 ? 'High' : 'Normal',
          type: 'info',
          action: {
            kind: 'panel',
            panel: 'CALENDAR_EVENTS',
            id: firstDate,
            options: { title: 'التذكيرات' },
          },
        });

        for (const r of allOpen) {
          const date = String(r.date || '').trim();
          const overdue = date ? isYmdBefore(date, todayYMD) : false;
          const title = String(r.title || '').trim();
          if (!title) continue;
          messages.push({
            id: `rem_${String(r.id || date || title)}`,
            content: `${overdue ? '⚠️' : '⏰'} تذكير: ${title}${date ? ` (موعد: ${date})` : ''}`,
            priority: overdue ? 'High' : 'Normal',
            type: 'info',
            action: {
              kind: 'panel',
              panel: 'CALENDAR_EVENTS',
              id: date || todayYMD,
              options: { title: 'التذكيرات' },
            },
          });
        }
      }
    } catch {
      // ignore
    }

    // 4) Installments overdue + due today (unpaid/partial)
    try {
      const norm = (v: unknown) => String(v ?? '').trim();
      const today = toDateOnly(new Date());
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

      const peopleById = new Map<string, الأشخاص_tbl>();
      for (const p of people) {
        if (p.رقم_الشخص) peopleById.set(p.رقم_الشخص, p);
      }

      const propsById = new Map<string, العقارات_tbl>();
      for (const pr of properties) {
        if (pr.رقم_العقار) propsById.set(pr.رقم_العقار, pr);
      }

      const contractsById = new Map<string, العقود_tbl>();
      for (const c of contracts) {
        if (c.رقم_العقد) contractsById.set(c.رقم_العقد, c);
      }

      const overdue = (installments || [])
        .filter((i) => i.isArchived !== true)
        .filter((i) => norm(i.نوع_الكمبيالة) !== 'تأمين')
        .filter((i) => {
          const status = norm(i.حالة_الكمبيالة);
          return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
        })
        .filter((i) => {
          const due = String(i.تاريخ_استحقاق || '').trim();
          return !!due && isYmdBefore(due, todayYMD);
        })
        .map((i) => {
          const pr = getInstallmentPaidAndRemaining(i);
          const due = String(i.تاريخ_استحقاق || '').trim();
          const dueDate = due ? parseDateOnly(due) : null;
          const daysUntil = dueDate ? daysBetweenDateOnly(today, dueDate) : 0; // negative for overdue
          const daysOverdue = daysUntil < 0 ? Math.abs(daysUntil) : 0;
          return { i, remaining: Number(pr?.remaining) || 0, daysOverdue };
        })
        .filter((x) => x.remaining > 0)
        .sort((a, b) => b.daysOverdue - a.daysOverdue || b.remaining - a.remaining);

      const overdueCount = overdue.length;
      const overdueTotal = overdue.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      if (overdueCount > 0) {
        messages.push({
          id: 'installments_overdue',
          content: `⚠️ لديك ${overdueCount} دفعات متأخرة بقيمة إجمالية ${formatCurrencyJOD(overdueTotal)}`,
          priority: 'High',
          type: 'alert',
          action: { kind: 'hash', hash: '/installments' },
        });

        for (const x of overdue) {
          const inst = x.i;
          const contractId = String(inst.رقم_العقد || '').trim();
          const contract = contractId ? contractsById.get(contractId) : undefined;
          const tenantId = String(contract?.رقم_المستاجر || '').trim();
          const tenantName = tenantId ? peopleById.get(tenantId)?.الاسم : undefined;
          const propertyId = String(contract?.رقم_العقار || '').trim();
          const propCode = propertyId ? propsById.get(propertyId)?.الكود_الداخلي : undefined;

          const who = String(tenantName || 'مستأجر');
          const where = String(propCode || '').trim();
          const amount = formatCurrencyJOD(Number(x.remaining) || 0);
          const t = norm(inst?.نوع_الكمبيالة) || 'دفعة';
          const due = String(inst?.تاريخ_استحقاق || '').trim();
          const days = Number(x.daysOverdue) || 0;

          messages.push({
            id: `inst_overdue_${String(inst.رقم_الكمبيالة || contractId || Math.random())}`,
            content: `⚠️ دفعة متأخرة: ${who}${where ? ` • عقار ${where}` : ''} • ${amount} • تاريخ ${due}${days ? ` • منذ ${days} يوم` : ''} • ${t}`,
            priority: 'High',
            type: 'alert',
            action: { kind: 'hash', hash: '/installments' },
          });
        }
      }

      const dueToday = (installments || [])
        .filter((i) => i.isArchived !== true)
        .filter((i) => norm(i.نوع_الكمبيالة) !== 'تأمين')
        .filter((i) => {
          const status = norm(i.حالة_الكمبيالة);
          return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
        })
        .filter((i) => {
          const due = String(i.تاريخ_استحقاق || '').trim();
          return !!due && due === todayYMD;
        })
        .map((i) => {
          const pr = getInstallmentPaidAndRemaining(i);
          return { i, remaining: Number(pr?.remaining) || 0 };
        })
        .filter((x) => x.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining);

      const count = dueToday.length;
      const total = dueToday.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      if (count > 0) {
        messages.push({
          id: 'installments_today',
          content: `💰 لديك ${count} دفعات مستحقة اليوم بقيمة إجمالية ${formatCurrencyJOD(total)}`,
          priority: 'High',
          type: 'info',
          action: { kind: 'hash', hash: '/installments' },
        });

        for (const x of dueToday) {
          const inst = x.i;
          const contractId = String(inst.رقم_العقد || '').trim();
          const contract = contractId ? contractsById.get(contractId) : undefined;
          const tenantId = String(contract?.رقم_المستاجر || '').trim();
          const tenantName = tenantId ? peopleById.get(tenantId)?.الاسم : undefined;
          const propertyId = String(contract?.رقم_العقار || '').trim();
          const propCode = propertyId ? propsById.get(propertyId)?.الكود_الداخلي : undefined;

          const who = String(tenantName || 'مستأجر');
          const where = String(propCode || '').trim();
          const amount = formatCurrencyJOD(Number(x.remaining) || 0);
          const t = norm(inst?.نوع_الكمبيالة) || 'دفعة';

          messages.push({
            id: `inst_today_${String(inst.رقم_الكمبيالة || contractId || Math.random())}`,
            content: `💵 دفعة اليوم: ${who}${where ? ` • عقار ${where}` : ''} • ${amount} • ${t}`,
            priority: 'High',
            type: 'info',
            action: { kind: 'hash', hash: '/installments' },
          });
        }
      }
    } catch {
      // ignore
    }

    // Policy: pre-due only. Show upcoming reminders (next 7 days), not due-today/overdue.
    try {
      const targets = getPaymentNotificationTargetsInternal(7);
      const count = targets.reduce((sum, t) => sum + (t.items?.length || 0), 0);
      const total = targets.reduce(
        (sum, t) =>
          sum +
          (t.items || []).reduce((s: number, it) => s + (Number(it.amountRemaining) || 0), 0),
        0
      );

      if (count > 0) {
        messages.push({
          id: 'pre_due_7',
          content: `⏳ يوجد ${count} دفعات قريبة الاستحقاق خلال 7 أيام بقيمة إجمالية ${formatCurrencyJOD(total)}`,
          priority: 'High',
          type: 'info',
          action: { kind: 'panel', panel: 'PAYMENT_NOTIFICATIONS', options: { daysAhead: 7 } },
        });
      }
    } catch {
      // ignore
    }

    if (messages.length === 0) {
      return [];
    }

    return messages;
  },

  authenticateUser: async (u: string, p: string): Promise<DbResult<المستخدمين_tbl>> => {
    const username = String(u || '').trim();
    const password = String(p || '');
    if (!username || !password) return fail('Invalid credentials');

    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((x) => String(x.اسم_المستخدم || '').trim() === username);
    if (idx < 0) return fail('Invalid credentials');

    const user = all[idx];
    if (!user || !user.isActive) return fail('Invalid credentials');

    const stored = String(user.كلمة_المرور || '');
    const okPass = await verifyPassword(password, stored);
    if (!okPass) return fail('Invalid credentials');

    // Opportunistic upgrade: if we matched a legacy plaintext password, replace with a hash.
    try {
      if (stored && !isHashedPassword(stored)) {
        const upgraded = await hashPassword(password);
        all[idx] = { ...user, كلمة_المرور: upgraded };
        save(KEYS.USERS, all);
      }
    } catch {
      // ignore
    }

    return ok(user);
  },
  logAuthAttempt: (payload: {
    username: string;
    result: 'SUCCESS' | 'FAILED' | 'LOCKED';
    reason?: string;
    userId?: string;
    fails?: number;
    lockedUntil?: number;
    deviceInfo?: string;
  }) => {
    try {
      const username = String(payload?.username || '').trim();
      if (!username) return;

      const result = String(payload?.result || '').trim() as 'SUCCESS' | 'FAILED' | 'LOCKED';
      const action =
        result === 'SUCCESS'
          ? 'AUTH_LOGIN_SUCCESS'
          : result === 'LOCKED'
            ? 'AUTH_LOGIN_LOCKED'
            : 'AUTH_LOGIN_FAILED';

      const recordId = String(payload?.userId || username).trim();

      const parts: string[] = [];
      if (payload?.reason) parts.push(String(payload.reason));
      if (typeof payload?.fails === 'number' && Number.isFinite(payload.fails))
        parts.push(`fails=${payload.fails}`);
      if (
        typeof payload?.lockedUntil === 'number' &&
        Number.isFinite(payload.lockedUntil) &&
        payload.lockedUntil > 0
      ) {
        try {
          parts.push(`lockedUntil=${new Date(payload.lockedUntil).toISOString()}`);
        } catch {
          parts.push(`lockedUntil=${payload.lockedUntil}`);
        }
      }

      logOperationInternal(username, action, 'Auth', recordId, parts.join(' | '), {
        // No reliable IP in local-first offline app.
        ipAddress: 'local',
        deviceInfo: String(payload?.deviceInfo || '').slice(0, 220),
      });
    } catch {
      // ignore
    }
  },
  userHasPermission: (userId: string, permission: string) => {
    const user = get<المستخدمين_tbl>(KEYS.USERS).find((u) => u.id === userId);
    if (!user) return false;
    // SuperAdmin should bypass all permission checks, even if role value is not exactly 'SuperAdmin'
    // (e.g., different casing, localized labels, or legacy values).
    if (isSuperAdmin(normalizeRole(user.الدور))) return true;
    const perms = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
      .filter((p) => p.userId === userId)
      .map((p) => p.permissionCode);
    return perms.includes(permission);
  },
  getUserPermissions: (userId: string) =>
    get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS)
      .filter((p) => p.userId === userId)
      .map((p) => p.permissionCode),
  updateUserPermissions: (userId: string, perms: string[]) => {
    const all = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS).filter((p) => p.userId !== userId);
    perms.forEach((code) => all.push({ userId, permissionCode: code }));
    save(KEYS.USER_PERMISSIONS, all);
  },
  updateUserRole: (userId: string, role: RoleType) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => u.id === userId);
    if (idx > -1) {
      all[idx].الدور = role;
      save(KEYS.USERS, all);
    }
  },
  updateUserStatus: (id: string, status: boolean) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => u.id === id);
    if (idx > -1) {
      all[idx].isActive = status;
      save(KEYS.USERS, all);
    }
  },
  deleteSystemUser: (id: string) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS).filter((u) => u.id !== id);
    save(KEYS.USERS, all);
  },
  addSystemUser: async (user: Partial<المستخدمين_tbl>) => {
    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const candidateUsername = String(user.اسم_المستخدم || '').trim();
    if (!candidateUsername) {
      throw new Error('اسم المستخدم مطلوب');
    }
    if (
      all.some(
        (u) =>
          String(u.اسم_المستخدم || '').trim() === candidateUsername
      )
    ) {
      throw new Error('اسم المستخدم موجود مسبقاً');
    }

    const rawPassword = String(user.كلمة_المرور || '');
    const storedPassword = rawPassword ? await hashPassword(rawPassword) : '';

    const newUser: المستخدمين_tbl = {
      id: `USR-${Date.now()}`,
      اسم_المستخدم: candidateUsername,
      اسم_للعرض: user.اسم_للعرض,
      كلمة_المرور: storedPassword,
      الدور: user.الدور || 'Employee',
      linkedPersonId: user.linkedPersonId,
      isActive: true,
    };
    save(KEYS.USERS, [...all, newUser]);
  },
  changeUserPassword: async (userId: string, newPassword: string, actorUserId?: string) => {
    const targetId = String(userId || '').trim();
    const actorId = String(actorUserId || '').trim();
    const password = String(newPassword || '');

    if (!targetId) throw new Error('معرّف المستخدم غير صالح');
    if (!password.trim()) throw new Error('كلمة المرور مطلوبة');
    if (password.trim().length < 6) throw new Error('كلمة المرور قصيرة جداً (الحد الأدنى 6 أحرف)');

    const all = get<المستخدمين_tbl>(KEYS.USERS);
    const idx = all.findIndex((u) => String(u.id || '').trim() === targetId);
    if (idx < 0) throw new Error('المستخدم غير موجود');

    // Permission enforcement (do not rely on the UI).
    if (actorId && actorId !== targetId) {
      const actor = all.find((u) => String(u.id || '').trim() === actorId);
      if (!actor) throw new Error('المستخدم الحالي غير معروف');
      if (!DbService.userHasPermission(actorId, 'MANAGE_USERS')) {
        throw new Error('لا تملك صلاحية تغيير كلمة مرور مستخدم آخر');
      }
    }

    const storedPassword = await hashPassword(password.trim());
    const beforeUsername = String(all[idx]?.اسم_المستخدم || '').trim();

    all[idx] = { ...all[idx], كلمة_المرور: storedPassword };
    save(KEYS.USERS, all);

    try {
      const actorName = actorId
        ? String(all.find((u) => String(u.id || '').trim() === actorId)?.اسم_المستخدم || '').trim()
        : '';
      logOperationInternal(
        actorName || 'System',
        'USERS_CHANGE_PASSWORD',
        'Users',
        targetId,
        beforeUsername ? `target=${beforeUsername}` : ''
      );
    } catch {
      // ignore
    }
  },
  getPermissionDefinitions: () => [
    { code: 'ADD_PERSON', label: 'إضافة أشخاص', category: 'Persons' },
    { code: 'EDIT_PERSON', label: 'تعديل أشخاص', category: 'Persons' },
    { code: 'DELETE_PERSON', label: 'حذف أشخاص', category: 'Persons' },
    { code: 'ADD_PROPERTY', label: 'إضافة عقارات', category: 'Properties' },
    { code: 'EDIT_PROPERTY', label: 'تعديل عقارات', category: 'Properties' },
    { code: 'DELETE_PROPERTY', label: 'حذف عقارات', category: 'Properties' },
    { code: 'CREATE_CONTRACT', label: 'إنشاء عقود', category: 'Contracts' },
    { code: 'DELETE_CONTRACT', label: 'حذف/أرشفة عقود', category: 'Contracts' },
    { code: 'EDIT_MAINTENANCE', label: 'تعديل تذاكر الصيانة', category: 'Maintenance' },
    { code: 'CLOSE_MAINTENANCE', label: 'إنهاء/إغلاق تذاكر الصيانة', category: 'Maintenance' },
    { code: 'DELETE_MAINTENANCE', label: 'حذف تذاكر الصيانة', category: 'Maintenance' },
    { code: 'SETTINGS_ADMIN', label: 'إدارة الإعدادات', category: 'System' },
    { code: 'SETTINGS_AUDIT', label: 'سجل العمليات', category: 'System' },
    { code: 'MANAGE_USERS', label: 'إدارة المستخدمين', category: 'System' },
    { code: 'BLACKLIST_VIEW', label: 'عرض القائمة السوداء', category: 'Security' },
    { code: 'BLACKLIST_ADD', label: 'إضافة للقائمة السوداء', category: 'Security' },
    { code: 'BLACKLIST_REMOVE', label: 'رفع الحظر (إزالة)', category: 'Security' },
    // Printing (Enterprise)
    { code: 'PRINT_PREVIEW', label: 'فتح معاينة الطباعة', category: 'Printing' },
    { code: 'PRINT_EXECUTE', label: 'تنفيذ الطباعة', category: 'Printing' },
    { code: 'PRINT_EXPORT', label: 'تصدير ملفات (Word/PDF)', category: 'Printing' },
    { code: 'PRINT_SETTINGS_EDIT', label: 'تعديل إعدادات الطباعة', category: 'Printing' },
    { code: 'PRINT_TEMPLATES_EDIT', label: 'إدارة قوالب الطباعة', category: 'Printing' },
  ],

  getSettings,
  saveSettings,

  backupSystem: () => {
    // In desktop mode, localStorage is a cache hydrated from SQLite.
    // Export what the app currently sees (db_* keys in localStorage) for a consistent backup format.
    const data = { ...localStorage };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return URL.createObjectURL(blob);
  },

  restoreSystem: (data: Record<string, string>) => {
    // Restore into persistent storage (SQLite in desktop mode, localStorage in browser mode)
    Object.keys(data).forEach((k) => {
      void storage.setItem(k, data[k]);
      localStorage.setItem(k, data[k]);
    });
    buildCache();
  },

  previewRestore: (data: unknown) => {
    const rec = asUnknownRecord(data);
    const safeArrayLength = (raw: unknown): number => {
      if (typeof raw !== 'string') return 0;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    };
    return {
      people: safeArrayLength(rec[KEYS.PEOPLE]),
      contracts: safeArrayLength(rec[KEYS.CONTRACTS]),
    };
  },

  runDailyScheduler: () => {
    // Simulated daily scheduled tasks (runs after login)
    // Avoid repeating heavy work multiple times per session
    const todayKey = new Date().toISOString().split('T')[0];
    const lastRun = localStorage.getItem('daily_scheduler_last_run');
    if (lastRun === todayKey) return;
    void storage.setItem('daily_scheduler_last_run', todayKey);

    // 1) Generate installment reminders/alerts
    try {
      runInstallmentReminderScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: installment scan failed', e);
    }

    // 2) Auto renew contracts (if enabled per contract)
    try {
      runAutoRenewContractsInternal();
    } catch (e) {
      console.warn('Daily scheduler: auto renew failed', e);
    }

    // 3) Data quality alerts (linked to real records)
    try {
      runDataQualityScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: data quality scan failed', e);
    }

    // 4) Expiry alerts (linked to contracts)
    try {
      runExpiryScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: expiry scan failed', e);
    }

    // 5) Risk alerts (blacklist + overdue)
    try {
      runRiskScanInternal();
    } catch (e) {
      console.warn('Daily scheduler: risk scan failed', e);
    }
  },

  // Manual trigger (optional): refresh reminders/alerts immediately
  runInstallmentReminderScan: () => {
    runInstallmentReminderScanInternal();
  },

  getSalesListings,
  createSalesListing,
  cancelOpenSalesListingsForProperty,
  getSalesOffers,
  submitSalesOffer,
  updateOfferStatus,
  getSalesAgreements,
  updateSalesAgreement,
  deleteSalesAgreement,
  createSalesAgreement,

  finalizeOwnershipTransfer: (id: string, txId: string): DbResult<null> => {
    const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx > -1) {
      if (all[idx].isCompleted) return fail('تم إتمام نقل الملكية مسبقاً');
      all[idx].isCompleted = true;
      all[idx].transactionId = txId;
      all[idx].transferDate = new Date().toISOString().split('T')[0];
      save(KEYS.SALES_AGREEMENTS, all);

      const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
      const listingIdx = listings.findIndex((l) => l.id === all[idx].listingId);
      const listing = listingIdx > -1 ? listings[listingIdx] : null;
      if (!listing) return fail('عرض البيع غير موجود');

      const oldOwnerId = listing.رقم_المالك;
      const newOwnerId = all[idx].رقم_المشتري;

      // Require new title deed attachment (Property + Buyer)
      try {
        const attachments = get<Attachment>(KEYS.ATTACHMENTS);
        const propHasAny = attachments.some(
          (a) => a.referenceType === 'Property' && a.referenceId === listing.رقم_العقار
        );
        const buyerHasAny = attachments.some(
          (a) => a.referenceType === 'Person' && a.referenceId === newOwnerId
        );
        if (!propHasAny || !buyerHasAny) {
          return fail(
            'لا يمكن إتمام النقل: يجب رفع مستندات البيع/نقل الملكية ضمن مرفقات العقار ومرفقات المشتري قبل إتمام النقل (مثل سند الملكية الجديد أو أي مستندات رسمية مطلوبة)'
          );
        }
      } catch {
        return fail('لا يمكن إتمام النقل: تحقق من مرفقات العقار/المشتري');
      }

      // Validate property and current ownership
      const props = get<العقارات_tbl>(KEYS.PROPERTIES);
      const pIdx = props.findIndex((p) => p.رقم_العقار === listing.رقم_العقار);
      if (pIdx === -1) return fail('العقار غير موجود');
      if (props[pIdx].رقم_المالك !== listing.رقم_المالك) {
        return fail(
          'لا يمكن نقل الملكية: مالك العقار الحالي لا يطابق مالك عرض البيع (يرجى مراجعة بيانات المالك)'
        );
      }

      // If there is an active/renewed rental contract, terminate it as part of the ownership transfer.
      // This keeps property state consistent (sale completes -> not rented).
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const activeContracts = contracts.filter(
        (c) => c.رقم_العقار === listing.رقم_العقار && isTenancyRelevant(c)
      );
      if (activeContracts.length > 0) {
        const reason = 'تم بيع العقار - نقل ملكية';
        const date = all[idx].transferDate || new Date().toISOString().split('T')[0];
        for (const c of activeContracts) {
          try {
            const tRes = DbService.terminateContract(c.رقم_العقد, reason, date);
            if (!tRes.success) {
              return fail(`تعذر إتمام نقل الملكية: ${tRes.message}`);
            }
          } catch {
            return fail('تعذر إنهاء عقد الإيجار أثناء نقل الملكية');
          }
        }
      }

      // Mark listing as sold
      listings[listingIdx].الحالة = 'Sold';
      save(KEYS.SALES_LISTINGS, listings);

      // Update property owner + flags
      props[pIdx].رقم_المالك = newOwnerId;
      props[pIdx].isForSale = false;
      props[pIdx].salePrice = all[idx].السعر_النهائي;
      props[pIdx].minSalePrice = undefined;
      props[pIdx].حالة_العقار = 'شاغر';
      props[pIdx].IsRented = false;
      save(KEYS.PROPERTIES, props);

      // Ownership history (previous owner record)
      try {
        const hist = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
        hist.push({
          id: `OWN-${Date.now()}`,
          رقم_العقار: listing.رقم_العقار,
          رقم_المالك_القديم: oldOwnerId,
          رقم_المالك_الجديد: newOwnerId,
          تاريخ_نقل_الملكية: all[idx].transferDate || new Date().toISOString().split('T')[0],
          رقم_المعاملة: txId,
          agreementId: id,
          listingId: listing.id,
          السعر_النهائي: all[idx].السعر_النهائي,
        });
        save(KEYS.OWNERSHIP_HISTORY, hist);
      } catch (e) {
        console.warn('Failed to save ownership history', e);
      }

      // Audit log
      try {
        logOperationInternal(
          'system',
          'OWNERSHIP_TRANSFER',
          'sales_agreements',
          id,
          JSON.stringify({
            transactionId: txId,
            listingId: listing.id,
            propertyId: listing.رقم_العقار,
            sellerId: oldOwnerId,
            buyerId: newOwnerId,
            finalPrice: all[idx].السعر_النهائي,
            transferDate: all[idx].transferDate,
          })
        );
      } catch (e) {
        console.warn('Failed to log ownership transfer', e);
      }

      // Ensure buyer has "مالك" role
      try {
        const buyerId = newOwnerId;
        const currentRoles = getPersonRoles(buyerId);
        if (!currentRoles.includes('مالك')) {
          updatePersonRoles(buyerId, Array.from(new Set([...currentRoles, 'مالك'])));
        }
      } catch (e) {
        console.warn('Failed to update buyer roles after transfer', e);
      }

      // If the previous owner no longer owns any properties, remove "مالك" role
      try {
        const stillOwnsAny = get<العقارات_tbl>(KEYS.PROPERTIES).some(
          (p) => p.رقم_المالك === oldOwnerId
        );
        if (!stillOwnsAny) {
          const roles = getPersonRoles(oldOwnerId);
          if (roles.includes('مالك')) {
            updatePersonRoles(
              oldOwnerId,
              roles.filter((r) => r !== 'مالك')
            );
          }
        }
      } catch (e) {
        console.warn('Failed to update old owner roles after transfer', e);
      }

      // Reject any remaining pending offers for this listing
      const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
      let offersChanged = false;
      for (const o of offers) {
        if (o.listingId === listing.id && o.الحالة === 'Pending') {
          o.الحالة = 'Rejected';
          offersChanged = true;
        }
      }
      if (offersChanged) save(KEYS.SALES_OFFERS, offers);

      return ok(null, 'تم نقل الملكية بنجاح');
    }
    return fail('Agreement not found');
  },

  addSalesOfferNote: (offerId: string, note: string): DbResult<null> => {
    const clean = (note || '').trim();
    if (!clean) return fail('يرجى كتابة ملاحظة');
    const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
    const idx = all.findIndex((o) => o.id === offerId);
    if (idx === -1) return fail('العرض غير موجود');

    const stamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const prev = (all[idx].ملاحظات_التفاوض || '').trim();
    const line = `• ${stamp}: ${clean}`;
    all[idx].ملاحظات_التفاوض = prev ? `${prev}\n${line}` : line;
    save(KEYS.SALES_OFFERS, all);
    return ok();
  },

  getOwnershipHistory: (propertyId?: string, personId?: string): سجل_الملكية_tbl[] => {
    // Prefer cache indexes when available
    if (DbCache.isInitialized) {
      if (propertyId) {
        return DbCache.ownershipHistoryByPropertyId.get(propertyId) || [];
      }
      if (personId) {
        return DbCache.ownershipHistoryByPersonId.get(personId) || [];
      }
    }
    const all = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    if (propertyId) return all.filter((x) => x.رقم_العقار === propertyId);
    if (personId)
      return all.filter(
        (x) => x.رقم_المالك_القديم === personId || x.رقم_المالك_الجديد === personId
      );
    return all;
  },

  getMaintenanceTickets: () => get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE),
  addMaintenanceTicket: (data: تذاكر_الصيانة_tbl): DbResult<null> => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    save(KEYS.MAINTENANCE, [...all, { ...data, رقم_التذكرة: `MNT-${Date.now()}` }]);
    buildCache();
    return ok();
  },
  updateMaintenanceTicket: (id: string, data: Partial<تذاكر_الصيانة_tbl>) => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    const idx = all.findIndex((t) => t.رقم_التذكرة === id);
    if (idx > -1) {
      // If ticket is being closed, stamp closure date if not provided.
      const patch: Partial<تذاكر_الصيانة_tbl> = { ...data };
      if (patch.الحالة === 'مغلق' && !patch.تاريخ_الإغلاق) {
        patch.تاريخ_الإغلاق = new Date().toISOString().split('T')[0];
      }
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.MAINTENANCE, all);
      buildCache();
    }
  },
  deleteMaintenanceTicket: (id: string): DbResult<null> => {
    const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
    const idx = all.findIndex((t) => t.رقم_التذكرة === id);
    if (idx === -1) return ok();

    // Remove ticket
    const next = all.filter((t) => t.رقم_التذكرة !== id);
    save(KEYS.MAINTENANCE, next);

    // Remove attachments/activities/notes linked to this maintenance ticket
    purgeRefs('Maintenance', id);

    logOperationInternal('Admin', 'حذف', 'Maintenance', id, 'حذف تذكرة صيانة نهائياً');
    buildCache();
    return ok();
  },

  getExternalCommissions: () => get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS),
  addExternalCommission: (data: Partial<العمولات_الخارجية_tbl>): DbResult<null> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    save(KEYS.EXTERNAL_COMMISSIONS, [
      ...all,
      { ...data, id: `EXT-${Date.now()}` } as العمولات_الخارجية_tbl,
    ]);
    return ok();
  },
  updateExternalCommission: (
    id: string,
    patch: Partial<العمولات_الخارجية_tbl>
  ): DbResult<العمولات_الخارجية_tbl> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('السجل غير موجود');

    const next: العمولات_الخارجية_tbl = {
      ...all[idx],
      ...patch,
    } as العمولات_الخارجية_tbl;

    next.القيمة = Number(next.القيمة || 0);

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.EXTERNAL_COMMISSIONS, updated);
    logOperationInternal(
      'Admin',
      'تعديل',
      'ExternalCommissions',
      id,
      `تعديل عمولة خارجية: ${next.العنوان || ''}`
    );
    return ok(next);
  },
  deleteExternalCommission: (id: string): DbResult<null> => {
    const all = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    const target = all.find((x) => x.id === id);
    if (!target) return ok();
    save(
      KEYS.EXTERNAL_COMMISSIONS,
      all.filter((x) => x.id !== id)
    );
    logOperationInternal(
      'Admin',
      'حذف',
      'ExternalCommissions',
      id,
      `حذف عمولة خارجية: ${target.العنوان || ''}`
    );
    return ok();
  },

  getDynamicTables: () => get<DynamicTable>(KEYS.DYNAMIC_TABLES),
  createDynamicTable: (name: string) => {
    const id = `DT-${Date.now()}`;
    const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
    const newT = { id, title: name, fields: [] };
    save(KEYS.DYNAMIC_TABLES, [...all, newT]);
    return newT;
  },
  getDynamicRecords: (tableId: string) =>
    get<DynamicRecord>(KEYS.DYNAMIC_RECORDS).filter((r) => r.tableId === tableId),
  addDynamicRecord: (data: Partial<DynamicRecord>) => {
    const all = get<DynamicRecord>(KEYS.DYNAMIC_RECORDS);
    save(KEYS.DYNAMIC_RECORDS, [...all, { ...data, id: `DR-${Date.now()}` } as DynamicRecord]);
  },
  addFieldToTable: (tableId: string, field: Omit<DynamicTable['fields'][number], 'id'>) => {
    const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
    const idx = all.findIndex((t) => t.id === tableId);
    if (idx > -1) {
      all[idx].fields.push({ ...field, id: `FLD-${Date.now()}` });
      save(KEYS.DYNAMIC_TABLES, all);
    }
  },
  getFormFields: (formId: string) =>
    get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.formId === formId),
  addFormField: (formId: string, field: Partial<DynamicFormField>) => {
    const all = get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS);
    save(KEYS.DYNAMIC_FORM_FIELDS, [
      ...all,
      { ...field, formId, id: `FF-${Date.now()}` } as DynamicFormField,
    ]);
  },
  deleteFormField: (id: string) => {
    save(
      KEYS.DYNAMIC_FORM_FIELDS,
      get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.id !== id)
    );
  },

  getAttachments: (type: ReferenceType, id: string) =>
    get<Attachment>(KEYS.ATTACHMENTS).filter(
      (a) => a.referenceType === type && a.referenceId === id
    ),
  getAllAttachments: () => get<Attachment>(KEYS.ATTACHMENTS),
  uploadAttachment: async (
    type: ReferenceType,
    id: string,
    file: File
  ): Promise<DbResult<Attachment>> => {
    // Desktop (Electron): save as a real file under userData/attachments
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (desktopDb?.saveAttachmentFile) {
      try {
        const entityFolder = buildAttachmentEntityFolder(type, id);
        const bytes = await file.arrayBuffer();
        const resultUnknown = await desktopDb.saveAttachmentFile({
          referenceType: type,
          entityFolder,
          originalFileName: file.name,
          bytes,
        });

        const result = asUnknownRecord(resultUnknown);

        if (result['success'] !== true || typeof result['relativePath'] !== 'string') {
          return fail(String(result['message'] || 'فشل حفظ الملف على القرص'));
        }

        const all = get<Attachment>(KEYS.ATTACHMENTS);
        const att: Attachment = {
          id: `ATT-${Date.now()}`,
          referenceType: type,
          referenceId: id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: file.name.split('.').pop() || '',
          uploadDate: new Date().toISOString(),
          uploadedBy: 'Admin',
          filePath: result['relativePath'],
        };

        save(KEYS.ATTACHMENTS, [...all, att]);
        return ok(att);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'فشل حفظ الملف';
        return fail(message);
      }
    }

    // Browser fallback: store as DataURL (Base64)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const all = get<Attachment>(KEYS.ATTACHMENTS);
        const att: Attachment = {
          id: `ATT-${Date.now()}`,
          referenceType: type,
          referenceId: id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: file.name.split('.').pop() || '',
          uploadDate: new Date().toISOString(),
          uploadedBy: 'Admin',
          fileData: reader.result as string,
        };
        try {
          save(KEYS.ATTACHMENTS, [...all, att]);
          resolve(ok(att));
        } catch {
          reject('File too large for mock storage');
        }
      };
      reader.onerror = reject;
    });
  },
  deleteAttachment: async (id: string): Promise<DbResult<null>> => {
    const all = get<Attachment>(KEYS.ATTACHMENTS);
    const att = all.find((a) => a.id === id);

    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (att?.filePath && desktopDb?.deleteAttachmentFile) {
      try {
        await desktopDb.deleteAttachmentFile(att.filePath);
      } catch {
        // best-effort: still remove record
      }
    }

    save(
      KEYS.ATTACHMENTS,
      all.filter((a) => a.id !== id)
    );
    return ok();
  },

  readWordTemplate: async (
    templateName: string,
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<ArrayBuffer>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.readTemplateFile) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.readTemplateFile({ templateName, templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true || typeof res['dataUri'] !== 'string') {
        return fail(String(res['message'] || 'فشل تحميل قالب Word'));
      }

      const dataUri = String(res['dataUri'] || '').trim();
      // Avoid `fetch(data:...)` because it can be blocked by CSP `connect-src`.
      // Decode the `data:` URI directly into an ArrayBuffer.
      if (!dataUri.startsWith('data:')) {
        return fail('قالب Word غير صالح (dataUri)');
      }

      const commaIdx = dataUri.indexOf(',');
      if (commaIdx < 0) return fail('قالب Word غير صالح (dataUri)');
      const meta = dataUri.slice(5, commaIdx); // after `data:`
      const payload = dataUri.slice(commaIdx + 1);

      const isBase64 = /;base64\s*$/i.test(meta);
      if (isBase64) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return ok(bytes.buffer);
      }

      // Non-base64: interpret as URL-encoded bytes.
      const text = decodeURIComponent(payload);
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      return ok(bytes.buffer);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل تحميل قالب Word';
      return fail(message);
    }
  },

  listWordTemplates: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<string[]>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.listTemplates) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.listTemplates({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true) return fail(String(res['message'] || 'تعذر قراءة قائمة القوالب'));
      const items = res['items'];
      return ok(Array.isArray(items) ? items.filter((x) => typeof x === 'string') : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر قراءة قائمة القوالب';
      return fail(message);
    }
  },

  listWordTemplatesDetailed: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<
    DbResult<{
      items: string[];
      dir: string;
      templateType: string;
      details?: Array<{ fileName: string; kvKey?: string; key?: string; updatedAt?: string }>;
    }>
  > => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.listTemplates) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.listTemplates({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true) return fail(String(res['message'] || 'تعذر قراءة قائمة القوالب'));
      const itemsRaw = res['items'];
      const items = Array.isArray(itemsRaw) ? itemsRaw.filter((x) => typeof x === 'string') : [];
      const detailsRaw = res['details'];
      const details = Array.isArray(detailsRaw)
        ? detailsRaw
            .map((x) => asUnknownRecord(x))
            .filter((r) => typeof r['fileName'] === 'string')
            .map((r) => {
              return {
                fileName: String(r['fileName'] || ''),
                kvKey: typeof r['kvKey'] === 'string' ? String(r['kvKey']) : undefined,
                key: typeof r['key'] === 'string' ? String(r['key']) : undefined,
                updatedAt: typeof r['updatedAt'] === 'string' ? String(r['updatedAt']) : undefined,
              };
            })
        : undefined;
      const dir = typeof res['dir'] === 'string' ? String(res['dir']) : '';
      const t = typeof res['templateType'] === 'string' ? String(res['templateType']) : String(templateType || 'contracts');
      return ok({ items, details, dir, templateType: t });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر قراءة قائمة القوالب';
      return fail(message);
    }
  },

  importWordTemplate: async (
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<string>> => {
    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (!desktopDb?.importTemplate) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }

    try {
      const resUnknown = await desktopDb.importTemplate({ templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true || typeof res['fileName'] !== 'string') {
        return fail(String(res['message'] || 'تم الإلغاء'));
      }
      return ok(String(res['fileName']));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل استيراد القالب';
      return fail(message);
    }
  },

  deleteWordTemplate: async (
    templateName: string,
    templateType?: 'contracts' | 'installments' | 'handover'
  ): Promise<DbResult<null>> => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      return fail('ميزة قوالب Word متاحة في نسخة سطح المكتب فقط');
    }
    if (!bridge.deleteTemplate) {
      return fail('ميزة حذف قالب Word تحتاج تحديث نسخة سطح المكتب أو إعادة تشغيل التطبيق');
    }

    try {
      const resUnknown = await bridge.deleteTemplate({ templateName: String(templateName || ''), templateType });
      const res = asUnknownRecord(resUnknown);
      if (res['success'] !== true) {
        return fail(String(res['message'] || 'فشل حذف القالب'));
      }
      return ok();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'فشل حذف القالب';
      return fail(message);
    }
  },
  downloadAttachment: async (id: string) => {
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

    // Desktop: prefer reading attachment metadata from SQLite KV via IPC.
    if (isDesktop() && (window as unknown as { desktopDb?: unknown }).desktopDb) {
      const bridge = (window as unknown as { desktopDb?: unknown }).desktopDb;
      if (isObj(bridge) && typeof bridge.get === 'function') {
        try {
          const raw = await (bridge.get as (key: string) => Promise<unknown>)(KEYS.ATTACHMENTS);
          const s = typeof raw === 'string' ? raw : String(raw ?? '');
          const parsed: unknown = s.trim() ? JSON.parse(s) : [];
          const arr: unknown[] = Array.isArray(parsed) ? parsed : [];
          const match = arr.find((x) => isObj(x) && String(x.id || '') === id);
          if (match && isObj(match)) {
            const filePath = typeof match.filePath === 'string' ? match.filePath : '';
            const fileData = typeof match.fileData === 'string' ? match.fileData : '';

            if (filePath && isObj(bridge) && typeof bridge.readAttachmentFile === 'function') {
              try {
                const res = await (bridge.readAttachmentFile as (p: string) => Promise<unknown>)(
                  filePath
                );
                const rr = isObj(res) ? res : null;
                if (rr && rr.success) return typeof rr.dataUri === 'string' ? rr.dataUri : null;

                // If the file is missing locally (common right after a remote pull of metadata),
                // ask main process to pull missing attachment files then retry once.
                if (isObj(bridge) && typeof bridge.pullAttachmentsNow === 'function') {
                  try {
                    await (bridge.pullAttachmentsNow as () => Promise<unknown>)();
                    const res2 = await (
                      bridge.readAttachmentFile as (p: string) => Promise<unknown>
                    )(filePath);
                    const rr2 = isObj(res2) ? res2 : null;
                    return rr2 && rr2.success
                      ? typeof rr2.dataUri === 'string'
                        ? rr2.dataUri
                        : null
                      : null;
                  } catch {
                    return null;
                  }
                }

                return null;
              } catch {
                return null;
              }
            }

            return fileData || null;
          }
        } catch {
          // fall back below
        }
      }
    }

    const att = get<Attachment>(KEYS.ATTACHMENTS).find((a) => a.id === id);
    if (!att) return null;

    const desktopDb = isDesktop() ? window.desktopDb : undefined;
    if (att.filePath && desktopDb?.readAttachmentFile) {
      try {
        const resUnknown = await desktopDb.readAttachmentFile(att.filePath);
        const res = asUnknownRecord(resUnknown);
        if (res['success'] === true) return (typeof res['dataUri'] === 'string' ? res['dataUri'] : null);

        // Best-effort: pull missing files from remote SQL then retry once.
        if (typeof desktopDb.pullAttachmentsNow === 'function') {
          try {
            await desktopDb.pullAttachmentsNow();
            const res2Unknown = await desktopDb.readAttachmentFile(att.filePath);
            const res2 = asUnknownRecord(res2Unknown);
            return res2['success'] === true
              ? typeof res2['dataUri'] === 'string'
                ? res2['dataUri']
                : null
              : null;
          } catch {
            return null;
          }
        }

        return null;
      } catch {
        return null;
      }
    }

    return att.fileData ?? null;
  },

  getActivities: (refId: string, type: string) =>
    get<ActivityRecord>(KEYS.ACTIVITIES).filter(
      (a) => a.referenceId === refId && a.referenceType === type
    ),
  getNotes: (refId: string, type: string) =>
    get<NoteRecord>(KEYS.NOTES).filter((n) => n.referenceId === refId && n.referenceType === type),
  addNote: (data: Partial<NoteRecord>): DbResult<null> => {
    const all = get<NoteRecord>(KEYS.NOTES);
    save(KEYS.NOTES, [
      ...all,
      {
        ...data,
        id: `NT-${Date.now()}`,
        date: new Date().toISOString(),
        employee: 'Admin',
      } as NoteRecord,
    ]);
    return ok();
  },
  addEntityNote: (table: string, id: string, note: string): DbResult<null> => {
    const clean = String(note || '').trim();
    if (!clean) return fail('يرجى كتابة ملاحظة');
    const t = String(table || '').trim();
    const rawId = String(id || '').trim();
    if (!t || !rawId) return fail('مرجع غير صالح');

    // Map table names (UI) to ReferenceType/Id (notes system)
    if (t === 'الأشخاص_tbl') {
      return DbService.addNote({ referenceType: 'Person', referenceId: rawId, content: clean });
    }
    if (t === 'العقارات_tbl') {
      return DbService.addNote({ referenceType: 'Property', referenceId: rawId, content: clean });
    }
    if (t === 'العقود_tbl') {
      return DbService.addNote({ referenceType: 'Contract', referenceId: rawId, content: clean });
    }
    if (t === 'الكمبيالات_tbl') {
      const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).find(
        (x) => String(x.رقم_الكمبيالة) === rawId
      );
      const contractId = String(inst?.رقم_العقد || '').trim();
      if (!contractId) return fail('تعذر ربط الملاحظة: الكمبيالة غير موجودة');
      return DbService.addNote({
        referenceType: 'Contract',
        referenceId: contractId,
        content: `[كمبيالة ${rawId}] ${clean}`,
      });
    }

    return fail('نوع السجل غير مدعوم لإضافة الملاحظات');
  },
  quickUpdateEntity: (table: string, id: string, updates: unknown): DbResult<null> => {
    const t = String(table || '').trim();
    const rawId = String(id || '').trim();
    if (!t || !rawId) return fail('مرجع غير صالح');
    if (!updates || typeof updates !== 'object') return fail('بيانات التحديث غير صالحة');

    // Defensive: never allow changing primary identifiers via quick edit.
    const updatesRec = asUnknownRecord(updates);
    const patch: Record<string, unknown> = { ...updatesRec };
    delete patch['رقم_الشخص'];
    delete patch['رقم_العقار'];
    delete patch['رقم_العقد'];
    delete patch['رقم_الكمبيالة'];

    const upsertBy = <T extends object>(key: string, idField: keyof T) => {
      const all = get<T>(key);
      const idx = all.findIndex(
        (x) => String(asUnknownRecord(x)[String(idField)] ?? '') === rawId
      );
      if (idx === -1) return fail('السجل غير موجود');
      const next = { ...all[idx], ...patch } as T;
      (next as unknown as Record<string, unknown>)[String(idField)] = asUnknownRecord(all[idx])[String(
        idField
      )];
      const updated = [...all];
      updated[idx] = next;
      save(key, updated);
      return ok(null, 'تم التحديث');
    };

    if (t === 'الأشخاص_tbl') {
      return upsertBy<الأشخاص_tbl>(KEYS.PEOPLE, 'رقم_الشخص');
    }
    if (t === 'العقارات_tbl') {
      return upsertBy<العقارات_tbl>(KEYS.PROPERTIES, 'رقم_العقار');
    }
    if (t === 'العقود_tbl') {
      return upsertBy<العقود_tbl>(KEYS.CONTRACTS, 'رقم_العقد');
    }
    if (t === 'الكمبيالات_tbl') {
      return upsertBy<الكمبيالات_tbl>(KEYS.INSTALLMENTS, 'رقم_الكمبيالة');
    }

    return fail('نوع السجل غير مدعوم للتعديل السريع');
  },

  searchGlobal: (query: string) => {
    const lower = query.toLowerCase();
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE)
      .filter((p) => p.الاسم.toLowerCase().includes(lower) || p.رقم_الهاتف.includes(lower))
      .slice(0, 5);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES)
      .filter(
        (p) =>
          p.الكود_الداخلي.toLowerCase().includes(lower) || p.العنوان.toLowerCase().includes(lower)
      )
      .slice(0, 5);
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => c.رقم_العقد.includes(lower))
      .slice(0, 5);
    return { people, properties, contracts };
  },

  getAvailableReports: () => MOCK_REPORTS,

  runReport: (id: string) => {
    const generatedAt = new Date().toLocaleString('ar-JO', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const today = new Date();
    const todayDateOnly = toDateOnly(today);
    const norm = (v: unknown) => String(v ?? '').trim();
    const isArchived = (rec: unknown) => asUnknownRecord(rec)['isArchived'] === true;

    // Financial Summary Report
    if (id === 'financial_summary') {
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => !isArchived(i))
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

      const withAmounts = installments
        .map((inst) => {
          const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, paid, remaining, due };
        })
        .filter((x) => !!x.due);

      const totalExpected = installments.reduce((sum, inst) => sum + (Number(inst.القيمة) || 0), 0);
      const totalPaid = withAmounts.reduce((sum, x) => sum + (Number(x.paid) || 0), 0);

      const totalLate = withAmounts
        .filter(
          (x) =>
            (Number(x.remaining) || 0) > 0 &&
            toDateOnly(x.due as Date).getTime() < todayDateOnly.getTime()
        )
        .reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      const totalUpcoming = withAmounts
        .filter(
          (x) =>
            (Number(x.remaining) || 0) > 0 &&
            toDateOnly(x.due as Date).getTime() >= todayDateOnly.getTime()
        )
        .reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);

      return {
        title: 'الملخص المالي',
        generatedAt,
        columns: [
          { key: 'item', header: 'البند' },
          { key: 'value', header: 'القيمة', type: 'currency' as const },
        ],
        data: [
          { item: 'إجمالي المتوقع', value: totalExpected },
          { item: 'إجمالي المحصل', value: totalPaid },
          { item: 'إجمالي المتأخر', value: totalLate },
          { item: 'إجمالي القادم', value: totalUpcoming },
          { item: 'المتبقي', value: totalExpected - totalPaid },
        ],
        summary: [
          {
            label: 'نسبة التحصيل',
            value: `${totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0}%`,
          },
        ],
      };
    }

    // Late Installments Report
    if (id === 'late_installments') {
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const lateInst = installments
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => !isArchived(i))
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED)
        .map((inst) => {
          const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, paid, remaining, due };
        })
        .filter(
          (x): x is { inst: الكمبيالات_tbl; paid: number; remaining: number; due: Date } => !!x.due
        )
        .filter((x) => x.remaining > 0 && toDateOnly(x.due).getTime() < todayDateOnly.getTime());

      const data = lateInst.map((x) => {
        const inst = x.inst;
        const contract = contracts.find((c) => c.رقم_العقد === inst.رقم_العقد);
        const tenant = contract ? people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
        const property = contract
          ? properties.find((p) => p.رقم_العقار === contract.رقم_العقار)
          : null;

        const daysLate = daysBetweenDateOnly(toDateOnly(x.due), todayDateOnly);

        return {
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          dueDate: inst.تاريخ_استحقاق,
          amount: x.remaining,
          daysLate: `${daysLate} يوم`,
          status: inst.حالة_الكمبيالة,
        };
      });

      return {
        title: 'الأقساط المتأخرة',
        generatedAt,
        columns: [
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'dueDate', header: 'تاريخ الاستحقاق', type: 'date' as const },
          { key: 'amount', header: 'المبلغ', type: 'currency' as const },
          { key: 'daysLate', header: 'أيام التأخير' },
          { key: 'status', header: 'الحالة', type: 'status' as const },
        ],
        data,
        summary: [
          { label: 'عدد الأقساط المتأخرة', value: lateInst.length },
          {
            label: 'إجمالي المبلغ المتأخر',
            value: `${formatCurrencyJOD(lateInst.reduce((sum, i) => sum + (Number(i.remaining) || 0), 0))}`,
          },
        ],
      };
    }

    // Employee Commissions (Rent + Sale) with Opportunity Number
    if (id === 'employee_commissions') {
      const commissions = get<العمولات_tbl>(KEYS.COMMISSIONS);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const users = get<المستخدمين_tbl>(KEYS.USERS);
      const displayNameByUsername: Record<string, string> = {};
      for (const u of users) {
        const username = String(u.اسم_المستخدم || '').trim();
        if (!username) continue;
        const display = String(u.اسم_للعرض || u.اسم_المستخدم || '').trim();
        if (display) displayNameByUsername[username] = display;
      }

      const toEmployee = (usernameRaw: unknown) => {
        const username = String(usernameRaw || '').trim();
        const display = username ? displayNameByUsername[username] || username : '';
        return { employeeUsername: username, employee: display };
      };

      const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
      const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);

      type EmployeeCommissionRow = {
        type: 'إيجار' | 'بيع';
        date: string;
        reference: string;
        employeeUsername: string;
        employee: string;
        property: string;
        opportunity: string;
        officeCommission: number;
        tier: string;
        employeeBase: number;
        intro: number;
        employeeTotal: number;
      };
      const rows: EmployeeCommissionRow[] = [];

      const getCommissionMonthKey = (c: العمولات_tbl) => {
        // ✅ حسب المواصفة: الحساب على تاريخ/شهر العمولة وليس تاريخ العقد.
        const paidMonth = String(c.شهر_دفع_العمولة || '').trim();
        if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;

        // تاريخ_العقد هنا يمثل تاريخ العملية/العمولة في السجل.
        const commissionDate = String(c.تاريخ_العقد || '').trim();
        if (/^\d{4}-\d{2}/.test(commissionDate)) return commissionDate.slice(0, 7);

        return '';
      };

      // ✅ Spec: rental tier is based on TOTAL rental office commission (per month).
      const rentalOfficeTotalByMonth: Record<string, number> = {};
      for (const c of commissions) {
        const monthKey = getCommissionMonthKey(c);
        const rentalTotal = Number(c.المجموع || 0) || 0;
        if (!monthKey) continue;
        rentalOfficeTotalByMonth[monthKey] =
          (rentalOfficeTotalByMonth[monthKey] || 0) + rentalTotal;
      }

      // Rent operations
      for (const c of commissions) {
        const contract = contracts.find((x) => x.رقم_العقد === c.رقم_العقد);
        const property = contract
          ? properties.find((p) => p.رقم_العقار === contract.رقم_العقار)
          : undefined;

        const { employeeUsername, employee } = toEmployee(c.اسم_المستخدم);

        const rentalTotal = Number(c.المجموع || 0) || 0;
        const introEnabled = !!c.يوجد_ادخال_عقار;
        const monthKey = getCommissionMonthKey(c);
        const monthRentalTotal = monthKey ? rentalOfficeTotalByMonth[monthKey] || 0 : 0;
        const tier = getRentalTier(monthRentalTotal);
        const employeeBase = rentalTotal * tier.rate;
        const intro = introEnabled ? rentalTotal * 0.05 : 0;
        const employeeTotal = employeeBase + intro;

        const rowDate = (() => {
          const d = String(c.تاريخ_العقد || '').trim();
          if (d) return d;
          if (monthKey) return `${monthKey}-01`;
          return '';
        })();

        rows.push({
          type: 'إيجار',
          date: rowDate,
          reference: String(c.رقم_العقد || ''),
          employeeUsername,
          employee,
          property: String(property?.الكود_الداخلي || ''),
          opportunity: String(c.رقم_الفرصة || ''),
          officeCommission: rentalTotal,
          tier: tier.tierId,
          employeeBase,
          intro,
          employeeTotal,
        });
      }

      // Sale operations
      for (const a of agreements) {
        const listing = listings.find((l) => l.id === a.listingId);
        const prop =
          a.رقم_العقار || listing?.رقم_العقار
            ? properties.find((p) => p.رقم_العقار === (a.رقم_العقار || listing?.رقم_العقار))
            : undefined;

        const { employeeUsername, employee } = toEmployee(a.اسم_المستخدم);

        // ✅ Include external broker commission fully (per request).
        // Prefer إجمالي_العمولات (buyer + seller + external). Fallback to explicit sum.
        const saleTotal =
          Number(
            a.إجمالي_العمولات ??
              (Number(a.العمولة_الإجمالية ?? 0) || 0) + (Number(a.عمولة_وسيط_خارجي ?? 0) || 0)
          ) || 0;
        const introEnabled = !!a.يوجد_ادخال_عقار;
        const breakdown = computeEmployeeCommission({
          rentalOfficeCommissionTotal: 0,
          saleOfficeCommissionTotal: saleTotal,
          propertyIntroEnabled: introEnabled,
        });

        rows.push({
          type: 'بيع',
          date: String(a.تاريخ_الاتفاقية || ''),
          reference: String(a.id || ''),
          employeeUsername,
          employee,
          property: String(prop?.الكود_الداخلي || ''),
          opportunity: String(a.رقم_الفرصة || ''),
          officeCommission: saleTotal,
          tier: '—',
          employeeBase: breakdown.totals.baseEarned,
          intro: breakdown.propertyIntro.earned,
          employeeTotal: breakdown.totals.finalEarned,
        });
      }

      // Sort by date desc if possible
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      const totalOffice = rows.reduce((sum, r) => sum + (Number(r.officeCommission) || 0), 0);
      const totalEmployee = rows.reduce((sum, r) => sum + (Number(r.employeeTotal) || 0), 0);
      const totalIntro = rows.reduce((sum, r) => sum + (Number(r.intro) || 0), 0);

      return {
        title: 'عمولات الموظفين (مع رقم الفرصة)',
        generatedAt,
        columns: [
          { key: 'type', header: 'النوع' },
          { key: 'date', header: 'التاريخ', type: 'date' as const },
          { key: 'reference', header: 'المرجع' },
          { key: 'employee', header: 'الموظف' },
          { key: 'property', header: 'العقار' },
          { key: 'opportunity', header: 'رقم الفرصة' },
          {
            key: 'officeCommission',
            header: 'إجمالي عمولة العملية (للمكتب)',
            type: 'currency' as const,
          },
          { key: 'tier', header: 'الشريحة' },
          {
            key: 'employeeBase',
            header: 'عمولة الموظف (قبل إدخال العقار)',
            type: 'currency' as const,
          },
          { key: 'intro', header: 'إدخال عقار (5% من إجمالي العمولة)', type: 'currency' as const },
          { key: 'employeeTotal', header: 'الإجمالي النهائي للموظف', type: 'currency' as const },
        ],
        data: rows,
        summary: [
          { label: 'عدد العمليات', value: rows.length },
          {
            label: 'إجمالي عمولات العمليات (للمكتب)',
            value: `${formatCurrencyJOD(totalOffice)}`,
          },
          { label: 'إجمالي إدخال العقار', value: `${formatCurrencyJOD(totalIntro)}` },
          { label: 'إجمالي عمولة الموظفين', value: `${formatCurrencyJOD(totalEmployee)}` },
        ],
      };
    }

    // Tenant List Report
    if (id === 'tenant_list') {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const tenants = people.filter((p) =>
        roles.some((r) => r.رقم_الشخص === p.رقم_الشخص && r.الدور === 'مستأجر')
      );

      const data = tenants.map((tenant) => {
        const tenantContracts = contracts.filter((c) => c.رقم_المستاجر === tenant.رقم_الشخص);
        const activeContract = pickBestTenancyContract(tenantContracts);
        const property = activeContract
          ? properties.find((p) => p.رقم_العقار === activeContract.رقم_العقار)
          : null;

        return {
          name: tenant.الاسم,
          phone: tenant.رقم_الهاتف || '-',
          property: property?.الكود_الداخلي || 'لا يوجد',
          contractStatus: activeContract?.حالة_العقد || 'منتهي',
          totalContracts: tenantContracts.length,
        };
      });

      return {
        title: 'قائمة المستأجرين',
        generatedAt,
        columns: [
          { key: 'name', header: 'الاسم' },
          { key: 'phone', header: 'رقم الهاتف' },
          { key: 'property', header: 'العقار الحالي' },
          { key: 'contractStatus', header: 'حالة العقد', type: 'status' as const },
          { key: 'totalContracts', header: 'عدد العقود' },
        ],
        data,
        summary: [
          { label: 'إجمالي المستأجرين', value: tenants.length },
          {
            label: 'المستأجرين النشطين',
            value: data.filter(
              (d) =>
                d.contractStatus !== 'منتهي' &&
                d.contractStatus !== 'ملغي' &&
                d.contractStatus !== 'مفسوخ'
            ).length,
          },
        ],
      };
    }

    // Active Contracts Report
    if (id === 'contracts_active') {
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const activeContracts = contracts.filter((c) => isTenancyRelevant(c));

      const data = activeContracts.map((contract) => {
        const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
        const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);

        return {
          contractNo: contract.رقم_العقد,
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          startDate: contract.تاريخ_البداية,
          endDate: contract.تاريخ_النهاية,
          monthlyRent: contract.القيمة_السنوية / 12,
          status: contract.حالة_العقد,
        };
      });

      return {
        title: 'العقود السارية',
        generatedAt,
        columns: [
          { key: 'contractNo', header: 'رقم العقد' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'startDate', header: 'تاريخ البداية', type: 'date' as const },
          { key: 'endDate', header: 'تاريخ النهاية', type: 'date' as const },
          { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' as const },
          { key: 'status', header: 'الحالة', type: 'status' as const },
        ],
        data,
        summary: [
          { label: 'عدد العقود النشطة', value: activeContracts.length },
          {
            label: 'إجمالي الإيرادات الشهرية',
            value: `${formatCurrencyJOD(activeContracts.reduce((sum, c) => sum + c.القيمة_السنوية / 12, 0))}`,
          },
        ],
      };
    }

    // Expiring Contracts Report
    if (id === 'contracts_expiring') {
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiringContracts = contracts.filter((c) => {
        const endDate = new Date(c.تاريخ_النهاية);
        return isTenancyRelevant(c) && endDate >= today && endDate <= thirtyDaysFromNow;
      });

      const data = expiringContracts.map((contract) => {
        const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
        const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
        const daysRemaining = Math.ceil(
          (new Date(contract.تاريخ_النهاية).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          contractNo: contract.رقم_العقد,
          tenant: tenant?.الاسم || 'غير معروف',
          property: property?.الكود_الداخلي || 'غير معروف',
          endDate: contract.تاريخ_النهاية,
          daysRemaining: `${daysRemaining} يوم`,
          monthlyRent: contract.القيمة_السنوية / 12,
        };
      });

      return {
        title: 'العقود التي ستنتهي قريباً',
        generatedAt,
        columns: [
          { key: 'contractNo', header: 'رقم العقد' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'property', header: 'العقار' },
          { key: 'endDate', header: 'تاريخ الانتهاء', type: 'date' as const },
          { key: 'daysRemaining', header: 'الأيام المتبقة' },
          { key: 'monthlyRent', header: 'الإيجار الشهري', type: 'currency' as const },
        ],
        data,
        summary: [{ label: 'عدد العقود', value: expiringContracts.length }],
      };
    }

    // Vacant Properties Report
    if (id === 'properties_vacant') {
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

      const vacantProperties = properties.filter((p) => !p.IsRented);

      const data = vacantProperties.map((property) => {
        const owner = people.find((p) => p.رقم_الشخص === property.رقم_المالك);

        return {
          code: property.الكود_الداخلي,
          type: property.النوع,
          area: property.المساحة ? `${property.المساحة} م²` : '-',
          floor: property.الطابق || '-',
          rooms: property.عدد_الغرف || '-',
          owner: owner?.الاسم || 'غير معروف',
          location: property.العنوان || '-',
        };
      });

      return {
        title: 'العقارات الشاغرة',
        generatedAt,
        columns: [
          { key: 'code', header: 'كود العقار' },
          { key: 'type', header: 'النوع' },
          { key: 'area', header: 'المساحة' },
          { key: 'floor', header: 'الطابق' },
          { key: 'rooms', header: 'الغرف' },
          { key: 'owner', header: 'المالك' },
          { key: 'location', header: 'الموقع' },
        ],
        data,
        summary: [{ label: 'عدد العقارات الشاغرة', value: vacantProperties.length }],
      };
    }

    // Properties Data Quality Report
    if (id === 'properties_data_quality') {
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);

      const incompleteProperties = properties.filter(
        (p) => !p.رقم_اشتراك_الكهرباء || !p.رقم_اشتراك_المياه || !p.المساحة || !p.العنوان
      );

      const data = incompleteProperties.map((property) => {
        const missing: string[] = [];
        if (!property.رقم_اشتراك_الكهرباء) missing.push('عداد الكهرباء');
        if (!property.رقم_اشتراك_المياه) missing.push('عداد الماء');
        if (!property.المساحة) missing.push('المساحة');
        if (!property.العنوان) missing.push('العنوان');

        return {
          code: property.الكود_الداخلي,
          type: property.النوع,
          missingData: missing.join(', '),
          completeness: `${Math.round(((4 - missing.length) / 4) * 100)}%`,
        };
      });

      return {
        title: 'جودة بيانات العقارات',
        generatedAt,
        columns: [
          { key: 'code', header: 'كود العقار' },
          { key: 'type', header: 'النوع' },
          { key: 'missingData', header: 'البيانات الناقصة' },
          { key: 'completeness', header: 'نسبة الاكتمال' },
        ],
        data,
        summary: [
          { label: 'عقارات تحتاج تحديث', value: incompleteProperties.length },
          {
            label: 'نسبة الجودة الإجمالية',
            value: `${Math.round(((properties.length - incompleteProperties.length) / properties.length) * 100)}%`,
          },
        ],
      };
    }

    // Maintenance Open Tickets Report
    if (id === 'maintenance_open_tickets') {
      const tickets = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
      const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);

      const openTickets = tickets.filter((t) => t.الحالة !== 'مغلق');

      const data = openTickets.map((ticket) => {
        const property = properties.find((p) => p.رقم_العقار === ticket.رقم_العقار);
        const contract = pickBestTenancyContract(
          contracts.filter((c) => c.رقم_العقار === ticket.رقم_العقار)
        );
        const tenant = contract ? people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر) : null;

        return {
          ticketNo: ticket.رقم_التذكرة,
          property: property?.الكود_الداخلي || 'غير معروف',
          tenant: tenant?.الاسم || '-',
          issue: ticket.الوصف,
          priority: ticket.الأولوية,
          status: ticket.الحالة,
          createdDate: ticket.تاريخ_الطلب,
        };
      });

      return {
        title: 'طلبات الصيانة المفتوحة',
        generatedAt,
        columns: [
          { key: 'ticketNo', header: 'رقم الطلب' },
          { key: 'property', header: 'العقار' },
          { key: 'tenant', header: 'المستأجر' },
          { key: 'issue', header: 'المشكلة' },
          { key: 'priority', header: 'الأولوية', type: 'status' as const },
          { key: 'status', header: 'الحالة', type: 'status' as const },
          { key: 'createdDate', header: 'تاريخ الإنشاء', type: 'date' as const },
        ],
        data,
        summary: [
          { label: 'عدد الطلبات المفتوحة', value: openTickets.length },
          {
            label: 'طلبات عالية الأولوية',
            value: openTickets.filter((t) => t.الأولوية === 'عالية').length,
          },
        ],
      };
    }

    // Tenant Risk Analysis Report
    if (id === 'tenant_risk_analysis') {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);
      const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
      const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

      const tenants = people.filter((p) =>
        roles.some((r) => r.رقم_الشخص === p.رقم_الشخص && r.الدور === 'مستأجر')
      );

      const data = tenants.map((tenant) => {
        const tenantContracts = contracts.filter((c) => c.رقم_المستاجر === tenant.رقم_الشخص);
        const tenantInstallments = installments
          .filter((i) => tenantContracts.some((c) => c.رقم_العقد === i.رقم_العقد))
          .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
            .filter((i) => !isArchived(i))
          .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

        const computed = tenantInstallments.map((inst) => {
          const { remaining } = getInstallmentPaidAndRemaining(inst);
          const due = parseDateOnly(inst.تاريخ_استحقاق);
          return { inst, remaining, due };
        });

        const totalInst = computed.length;
        const paidInst = computed.filter((x) => (Number(x.remaining) || 0) === 0).length;
        const lateInst = computed
          .filter((x) => (Number(x.remaining) || 0) > 0 && x.due)
          .filter((x) => toDateOnly(x.due as Date).getTime() < todayDateOnly.getTime()).length;

        const paymentRatio = totalInst > 0 ? Math.round((paidInst / totalInst) * 100) : 100;

        let riskLevel = 'منخفض';
        if (paymentRatio < 50) riskLevel = 'عالي';
        else if (paymentRatio < 80) riskLevel = 'متوسط';

        return {
          name: tenant.الاسم,
          totalInstallments: totalInst,
          paidInstallments: paidInst,
          lateInstallments: lateInst,
          paymentRatio: `${paymentRatio}%`,
          riskLevel,
        };
      });

      return {
        title: 'تحليل مخاطر المستأجرين',
        generatedAt,
        columns: [
          { key: 'name', header: 'المستأجر' },
          { key: 'totalInstallments', header: 'إجمالي الأقساط' },
          { key: 'paidInstallments', header: 'المدفوع' },
          { key: 'lateInstallments', header: 'المتأخر' },
          { key: 'paymentRatio', header: 'نسبة الالتزام' },
          { key: 'riskLevel', header: 'مستوى المخاطر', type: 'status' as const },
        ],
        data,
        summary: [
          {
            label: 'مستأجرين عالي المخاطر',
            value: data.filter((d) => d.riskLevel === 'عالي').length,
          },
          {
            label: 'مستأجرين منخفض المخاطر',
            value: data.filter((d) => d.riskLevel === 'منخفض').length,
          },
        ],
      };
    }

    // Default fallback
    return {
      title: 'تقرير',
      generatedAt,
      columns: [{ key: 'message', header: 'رسالة' }],
      data: [{ message: 'التقرير غير متوفر حالياً' }],
      summary: [],
    };
  },

  getLegalTemplates: () => get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES),
  getMergePlaceholderCatalog: (): {
    contract: Array<{ key: string; label: string }>;
    property: Array<{ key: string; label: string }>;
    tenant: Array<{ key: string; label: string }>;
    installment: Array<{ key: string; label: string }>;
  } => {
    const prettify = (raw: string) =>
      String(raw || '')
        .replace(/_/g, ' ')
        .trim();
    const uniqSorted = (arr: string[]) =>
      Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));

    const contractFields: string[] = [];
    const propertyFields: string[] = [];
    const tenantFields: string[] = [];
    const installmentFields: string[] = [];

    for (const c of get<العقود_tbl>(KEYS.CONTRACTS)) {
      contractFields.push(...Object.keys(c));
    }
    for (const p of get<العقارات_tbl>(KEYS.PROPERTIES)) {
      propertyFields.push(...Object.keys(p));
    }
    for (const person of get<الأشخاص_tbl>(KEYS.PEOPLE)) {
      tenantFields.push(...Object.keys(person));
    }
    for (const inst of get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)) {
      installmentFields.push(...Object.keys(inst));
    }

    const contract = uniqSorted(contractFields).map((f) => ({
      key: `العقد_${f}`,
      label: `العقد: ${prettify(f)}`,
    }));
    const property = uniqSorted(propertyFields).map((f) => ({
      key: `العقار_${f}`,
      label: `العقار: ${prettify(f)}`,
    }));
    const tenant = uniqSorted(tenantFields).map((f) => ({
      key: `المستأجر_${f}`,
      label: `المستأجر: ${prettify(f)}`,
    }));
    const installment = uniqSorted(installmentFields).map((f) => ({
      key: `الكمبيالة_${f}`,
      label: `الكمبيالة: ${prettify(f)}`,
    }));

    // Derived installment/dues placeholders (useful for legal notices and future merges)
    const derivedInstallment: Array<{ key: string; label: string }> = [
      { key: 'دفعات_اجمالي_المتبقي', label: 'الدفعات (محسوب): إجمالي المبلغ المتبقي' },
      { key: 'دفعات_عدد_الاقساط_المتأخرة', label: 'الدفعات (محسوب): عدد الأقساط المتأخرة' },
      { key: 'دفعات_مجموع_المتأخر', label: 'الدفعات (محسوب): مجموع المبالغ المتأخرة' },
      { key: 'دفعات_اقدم_تاريخ_استحقاق_متأخر', label: 'الدفعات (محسوب): أقدم تاريخ استحقاق متأخر' },
      { key: 'دفعات_اقصى_عدد_ايام_تأخر', label: 'الدفعات (محسوب): أقصى عدد أيام تأخر' },
    ];

    return { contract, property, tenant, installment: [...derivedInstallment, ...installment] };
  },
  getLegalNoticePlaceholderCatalog: (): {
    standard: string[];
    financial: string[];
    contractFields: string[];
    propertyFields: string[];
    tenantFields: string[];
  } => {
    const standard = [
      'contract_id',
      'contract_start_date',
      'contract_end_date',
      'tenant_name',
      'tenant_phone',
      'property_code',
      'property_address',
    ];

    const financial = [
      'total_remaining_amount',
      'overdue_installments_count',
      'overdue_amount_total',
      'overdue_oldest_due_date',
      'overdue_max_days_late',
    ];

    const contractFieldsSet = new Set<string>();
    const propertyFieldsSet = new Set<string>();
    const tenantFieldsSet = new Set<string>();

    for (const c of get<العقود_tbl>(KEYS.CONTRACTS)) {
      for (const k of Object.keys(c)) contractFieldsSet.add(String(k));
    }
    for (const p of get<العقارات_tbl>(KEYS.PROPERTIES)) {
      for (const k of Object.keys(p)) propertyFieldsSet.add(String(k));
    }
    for (const person of get<الأشخاص_tbl>(KEYS.PEOPLE)) {
      for (const k of Object.keys(person)) tenantFieldsSet.add(String(k));
    }

    const sort = (arr: string[]) => arr.filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));

    return {
      standard,
      financial,
      contractFields: sort(Array.from(contractFieldsSet)),
      propertyFields: sort(Array.from(propertyFieldsSet)),
      tenantFields: sort(Array.from(tenantFieldsSet)),
    };
  },
  addLegalTemplate: (t: Partial<LegalNoticeTemplate>): DbResult<null> => {
    const all = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES);
    save(KEYS.LEGAL_TEMPLATES, [...all, { ...t, id: `TMPL-${Date.now()}` } as LegalNoticeTemplate]);
    return ok();
  },
  deleteLegalTemplate: (id: string) => {
    save(
      KEYS.LEGAL_TEMPLATES,
      get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES).filter((t) => t.id !== id)
    );
  },
  generateLegalNotice: (
    tmplId: string,
    contractId: string,
    ctx?: {
      date?: string;
      time?: string;
      extra?: Record<string, string | number | null | undefined>;
    }
  ) => {
    const tmpl = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES).find((t) => t.id === tmplId);
    const contract = get<العقود_tbl>(KEYS.CONTRACTS).find((c) => c.رقم_العقد === contractId);
    if (!tmpl || !contract) return null;

    const property = get<العقارات_tbl>(KEYS.PROPERTIES).find(
      (p) => p.رقم_العقار === contract.رقم_العقار
    );
    const tenant = get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const owner = property?.رقم_المالك
      ? get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === property.رقم_المالك)
      : undefined;

    // Financial context from installments (Single Source of Truth = installments table)
    const today = toDateOnly(new Date());
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter(
      (i) => i.رقم_العقد === contractId
    );
    const installmentsWithRemaining = installments
      .map((inst) => {
        const due = parseDateOnly(String(inst.تاريخ_استحقاق || ''));
        const remaining = getInstallmentPaidAndRemaining(inst).remaining;
        return { inst, due, remaining };
      })
      .filter((x) => x.remaining > 0);

    const overdue = installmentsWithRemaining
      .filter((x) => x.due && daysBetweenDateOnly(x.due, today) > 0)
      .sort((a, b) => (a.due?.getTime() || 0) - (b.due?.getTime() || 0));

    const totalRemaining = Math.round(
      installmentsWithRemaining.reduce((sum, x) => sum + (x.remaining || 0), 0)
    );
    const overdueCount = overdue.length;
    const overdueTotal = Math.round(overdue.reduce((sum, x) => sum + (x.remaining || 0), 0));
    const overdueOldestDueDate = overdue[0]?.inst?.تاريخ_استحقاق
      ? String(overdue[0].inst.تاريخ_استحقاق)
      : '';
    const overdueMaxDaysLate = overdue.length
      ? Math.max(
          0,
          ...overdue
            .map((x) => (x.due ? daysBetweenDateOnly(x.due, today) : 0))
            .filter((n) => Number.isFinite(n))
        )
      : 0;

    const replacements: Record<string, string> = {
      ...getMessageGlobalContext(),
      contract_id: String(contract.رقم_العقد || ''),
      contract_start_date: String(contract.تاريخ_البداية || ''),
      contract_end_date: String(contract.تاريخ_النهاية || ''),
      tenant_name: String(tenant?.الاسم || ''),
      tenant_phone: String(tenant?.رقم_الهاتف || ''),
      property_code: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
      property_address: String(property?.العنوان || ''),

      // Arabic aliases used by fixed legal/renewal templates
      اسم_المستأجر: String(tenant?.الاسم || ''),
      رقم_الهاتف: String(tenant?.رقم_الهاتف || ''),
      اسم_المالك: String(owner?.الاسم || ''),
      عنوان_العقار: String(property?.العنوان || ''),
      الكود_الداخلي: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
      تاريخ_نهاية_العقد: String(contract.تاريخ_النهاية || ''),

      // Installments-derived placeholders
      total_remaining_amount: String(totalRemaining || 0),
      overdue_installments_count: String(overdueCount || 0),
      overdue_amount_total: String(overdueTotal || 0),
      overdue_oldest_due_date: String(overdueOldestDueDate || ''),
      overdue_max_days_late: String(overdueMaxDaysLate || 0),

      // Arabic aliases for computed installments placeholders
      دفعات_اجمالي_المتبقي: String(totalRemaining || 0),
      دفعات_عدد_الاقساط_المتأخرة: String(overdueCount || 0),
      دفعات_مجموع_المتأخر: String(overdueTotal || 0),
      دفعات_اقدم_تاريخ_استحقاق_متأخر: String(overdueOldestDueDate || ''),
      دفعات_اقصى_عدد_ايام_تأخر: String(overdueMaxDaysLate || 0),
    };

    // Add all contract/property/tenant fields as dynamic placeholders
    // Usage in templates: {{العقد_<field>}}, {{العقار_<field>}}, {{المستأجر_<field>}}
    // (Also supports legacy: {{contract_*}}, {{property_*}}, {{tenant_*}})
    for (const [k, v] of Object.entries(contract)) {
      const value = v === null || v === undefined ? '' : String(v);
      replacements[`العقد_${String(k)}`] = value;
      replacements[`contract_${String(k)}`] = value;
    }
    if (property) {
      for (const [k, v] of Object.entries(property)) {
        const value = v === null || v === undefined ? '' : String(v);
        replacements[`العقار_${String(k)}`] = value;
        replacements[`property_${String(k)}`] = value;
      }
    }
    if (tenant) {
      for (const [k, v] of Object.entries(tenant)) {
        const value = v === null || v === undefined ? '' : String(v);
        replacements[`المستأجر_${String(k)}`] = value;
        replacements[`tenant_${String(k)}`] = value;
      }
    }

    if (ctx?.extra) {
      for (const [key, value] of Object.entries(ctx.extra)) {
        replacements[key] = value === null || value === undefined ? '' : String(value);
      }
    }

    let text = String(tmpl.content || '');

    // Replace {{tokens}}
    for (const [key, value] of Object.entries(replacements)) {
      text = text.split(`{{${key}}}`).join(value);
    }

    // Replace common Arabic bracket placeholders
    if (ctx?.date) text = text.split('[التاريخ]').join(String(ctx.date));
    if (ctx?.time) text = text.split('[الوقت]').join(String(ctx.time));

    return { text };
  },
  saveLegalNoticeHistory: (rec: Partial<LegalNoticeRecord>) => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    save(KEYS.LEGAL_HISTORY, [
      ...all,
      { ...rec, id: `LH-${Date.now()}`, sentDate: new Date().toISOString() } as LegalNoticeRecord,
    ]);
  },
  getLegalNoticeHistory: () => get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY),

  updateLegalNoticeHistory: (
    id: string,
    patch: Partial<Pick<LegalNoticeRecord, 'note' | 'reply'>>
  ): DbResult<null> => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('السجل غير موجود');
    all[idx] = { ...all[idx], ...patch } as LegalNoticeRecord;
    save(KEYS.LEGAL_HISTORY, all);
    return ok();
  },

  deleteLegalNoticeHistory: (id: string): DbResult<null> => {
    const all = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return fail('السجل غير موجود');
    save(KEYS.LEGAL_HISTORY, next);
    // remove attachments/notes/activities related to this legal notice record
    purgeRefs('LegalNotice', id);
    return ok();
  },

  checkSystemHealth: () => {
    try {
      const validation = validateAllData();
      const integrityWarnings = validation.warnings.length;
      const logicErrors = validation.errors.length;

      // Orphans isn't directly reported; approximate via FK errors count
      const orphans = validation.errors.filter((e) => e.includes('غير موجود')).length;

      const score = Math.max(0, Math.min(100, 100 - (logicErrors * 10 + integrityWarnings * 3)));
      const status: SystemHealth['status'] =
        score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Warning' : 'Critical';

      const categorize = (msg: string) => {
        if (msg.startsWith('تكرار')) return 'فهرسة/تكرار';
        if (msg.includes('غير موجود')) return 'علاقات/ربط';
        if (msg.includes('تاريخ')) return 'تواريخ';
        if (msg.includes('مدة')) return 'منطق/مدة';
        return 'بيانات';
      };

      const issues: SystemHealth['issues'] = [
        ...validation.errors.map((e, idx) => ({
          id: `E-${idx}`,
          type: 'Critical' as const,
          category: categorize(e),
          description: e,
        })),
        ...validation.warnings.map((w, idx) => ({
          id: `W-${idx}`,
          type: 'Warning' as const,
          category: categorize(w),
          description: w,
        })),
      ];

      return {
        score,
        status,
        issues,
        stats: {
          integrityWarnings,
          orphans,
          logicErrors,
        },
      } as SystemHealth;
    } catch (e: unknown) {
      return {
        score: 0,
        status: 'Critical',
        issues: [
          {
            id: 'HEALTH-ERR',
            type: 'Critical',
            category: 'نظام',
            description: `فشل حساب صحة النظام: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        stats: {
          integrityWarnings: 0,
          orphans: 0,
          logicErrors: 1,
        },
      } as SystemHealth;
    }
  },
  runPredictiveAnalysis: () =>
    ({
      score: 88,
      status: 'Safe',
      trend: 'Stable',
      riskFactors: [],
      recommendations: ['مراجعة العقود المنتهية'],
    }) as PredictiveInsight,
  runPerformanceBenchmark: () => [{ name: 'Query', before: 120, after: 40 }],
  optimizeSystem: () => {
    // ✅ (A) Safe cleanup: remove orphan roles referencing missing people
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const peopleIds = new Set(people.map((p) => p.رقم_الشخص));

    const rolesBefore = get<شخص_دور_tbl>(KEYS.ROLES);
    const rolesAfter = rolesBefore.filter((r) => peopleIds.has(r.رقم_الشخص));

    const removedOrphans = rolesBefore.length - rolesAfter.length;
    if (removedOrphans > 0) {
      save(KEYS.ROLES, rolesAfter);
      logOperationInternal(
        'System',
        'تنظيف بيانات',
        'Roles',
        'db_roles',
        `حذف أدوار يتيمة: ${removedOrphans}`
      );
    }

    // Rebuild cache
    buildCache();
    return ok(
      null,
      removedOrphans > 0 ? `تم تحسين النظام + حذف ${removedOrphans} دور يتيم` : 'تم تحسين النظام'
    );
  },

  // --- NEW METHODS FOR DASHBOARD WIDGETS ---

  getDashboardNotes: () =>
    get<DashboardNote>(KEYS.DASHBOARD_NOTES)
      .filter((n) => !n.isArchived)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  addDashboardNote: (note: Omit<DashboardNote, 'id' | 'createdAt' | 'isArchived'>) => {
    const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
    save(KEYS.DASHBOARD_NOTES, [
      ...all,
      {
        ...note,
        id: `DNOTE-${Date.now()}`,
        createdAt: new Date().toISOString(),
        isArchived: false,
      },
    ]);
  },
  archiveDashboardNote: (id: string) => {
    const all = get<DashboardNote>(KEYS.DASHBOARD_NOTES);
    const idx = all.findIndex((n) => n.id === id);
    if (idx > -1) {
      all[idx].isArchived = true;
      save(KEYS.DASHBOARD_NOTES, all);
    }
  },

  getReminders: () => get<SystemReminder>(KEYS.REMINDERS).filter((r) => !r.isDone),
  addReminder: (reminder: Omit<SystemReminder, 'id' | 'isDone'>) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const id = `REM-${Date.now()}`;
    save(KEYS.REMINDERS, [...all, { ...reminder, id, isDone: false }]);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
    return id;
  },
  updateReminder: (id: string, patch: Partial<Omit<SystemReminder, 'id'>>) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...patch };
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  setReminderDone: (id: string, isDone: boolean) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx].isDone = isDone;
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  toggleReminder: (id: string) => {
    const all = get<SystemReminder>(KEYS.REMINDERS);
    const idx = all.findIndex((r) => r.id === id);
    if (idx > -1) {
      all[idx].isDone = !all[idx].isDone;
      save(KEYS.REMINDERS, all);
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },

  getClientInteractions: () =>
    get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
  addClientInteraction: (data: Omit<ClientInteraction, 'id'>) => {
    const all = get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS);
    save(KEYS.CLIENT_INTERACTIONS, [...all, { ...data, id: `INT-${Date.now()}` }]);
  },

  getFollowUps: () =>
    get<FollowUpTask>(KEYS.FOLLOW_UPS)
      .filter((f) => f.status === 'Pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
  getAllFollowUps: () =>
    get<FollowUpTask>(KEYS.FOLLOW_UPS).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    ),
  addFollowUp: (task: Omit<FollowUpTask, 'id' | 'status'>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const id = `FUP-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Link general tasks to reminders for unified notifications/alerts
    let reminderId: string | undefined = task.reminderId;
    if (!reminderId && task.type === 'Task' && task.dueDate && task.task) {
      const dueTime = asUnknownRecord(task)['dueTime'];
      reminderId = DbService.addReminder({
        title: task.task,
        date: task.dueDate,
        time: typeof dueTime === 'string' ? dueTime : undefined,
        type: 'Task',
      });
    }

    save(KEYS.FOLLOW_UPS, [
      ...all,
      {
        ...task,
        id,
        status: 'Pending',
        reminderId,
        createdAt: task.createdAt || nowIso,
        updatedAt: nowIso,
      },
    ]);
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
    return id;
  },
  updateFollowUp: (id: string, patch: Partial<Omit<FollowUpTask, 'id'>>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      const next = { ...all[idx], ...patch, updatedAt: new Date().toISOString() } as FollowUpTask;
      all[idx] = next;
      save(KEYS.FOLLOW_UPS, all);

      // Keep linked reminder aligned when task changes
      if (next.reminderId) {
        if (typeof patch.task === 'string')
          DbService.updateReminder(next.reminderId, { title: next.task });
        if (typeof patch.dueDate === 'string')
          DbService.updateReminder(next.reminderId, { date: next.dueDate });
        const patchRec = asUnknownRecord(patch);
        const dueTime = patchRec['dueTime'];
        if (typeof dueTime === 'string') DbService.updateReminder(next.reminderId, { time: dueTime });
        if (patch.status === 'Pending' || patch.status === 'Done')
          DbService.setReminderDone(next.reminderId, next.status === 'Done');
      }

      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },
  deleteFollowUp: (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const target = all.find((f) => f.id === id);
    save(
      KEYS.FOLLOW_UPS,
      all.filter((f) => f.id !== id)
    );
    // We intentionally do NOT delete linked reminders to preserve audit trail.
    // (They can be marked done via completion.)
    if (target?.reminderId) {
      DbService.setReminderDone(target.reminderId, true);
    }
    try {
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    } catch {
      void 0;
    }
  },
  completeFollowUp: (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      all[idx].status = 'Done';
      all[idx].updatedAt = new Date().toISOString();
      save(KEYS.FOLLOW_UPS, all);
      if (all[idx].reminderId) {
        DbService.setReminderDone(all[idx].reminderId, true);
      }
      try {
        window.dispatchEvent(new Event('azrar:tasks-changed'));
      } catch {
        void 0;
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧾 PROPERTY INSPECTIONS - الكشوفات
  // ═══════════════════════════════════════════════════════════════════════════════
  getPropertyInspections: (propertyId: string) => {
    return get<PropertyInspection>(KEYS.INSPECTIONS)
      .filter((x) => String(x.propertyId) === String(propertyId))
      .slice()
      .sort((a, b) => String(b.inspectionDate || '').localeCompare(String(a.inspectionDate || '')));
  },
  getInspection: (id: string) =>
    get<PropertyInspection>(KEYS.INSPECTIONS).find((x) => x.id === id) || null,
  getLatestInspectionForProperty: (propertyId: string) => {
    const all = DbService.getPropertyInspections(propertyId);
    return all.length ? all[0] : null;
  },
  createInspection: (
    data: Omit<PropertyInspection, 'id' | 'createdAt' | 'updatedAt'>
  ): DbResult<PropertyInspection> => {
    if (!data?.propertyId) return fail('رقم العقار مطلوب');
    if (!data?.inspectionDate) return fail('تاريخ الكشف مطلوب');

    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const nowIso = new Date().toISOString();
    const newRec: PropertyInspection = {
      ...data,
      id: `INS-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    save(KEYS.INSPECTIONS, [...all, newRec]);
    logOperationInternal(
      'Admin',
      'إضافة',
      'Inspections',
      newRec.id,
      `إضافة كشف للعقار ${data.propertyId}`
    );
    return ok(newRec, 'تم إضافة الكشف');
  },
  updateInspection: (
    id: string,
    patch: Partial<Omit<PropertyInspection, 'id' | 'createdAt'>>
  ): DbResult<PropertyInspection> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('الكشف غير موجود');

    const next: PropertyInspection = {
      ...all[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...all];
    updated[idx] = next;
    save(KEYS.INSPECTIONS, updated);
    logOperationInternal('Admin', 'تعديل', 'Inspections', id, 'تعديل بيانات الكشف');
    return ok(next, 'تم تعديل الكشف');
  },
  deleteInspection: (id: string): DbResult<null> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const target = all.find((x) => x.id === id);
    if (!target) return ok(null, 'الكشف غير موجود');
    purgeRefs('Inspection', id);
    save(
      KEYS.INSPECTIONS,
      all.filter((x) => x.id !== id)
    );
    logOperationInternal(
      'Admin',
      'حذف',
      'Inspections',
      id,
      'حذف كشف (مع المرفقات/الملاحظات/السجل)'
    );
    return ok(null, 'تم حذف الكشف');
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🗑️ RESET / CLEANUP - مسح البيانات التجريبية فقط (حفظ Users/Roles/Permissions)
  // ═══════════════════════════════════════════════════════════════════════════════
  resetAllData: () => {
    // If running in desktop mode, ask SQLite to clear db_* keys too.
    if (storage.isDesktop()) {
      const desktopDb = window.desktopDb;
      const resetAll = asUnknownRecord(desktopDb)['resetAll'];
      if (typeof resetAll === 'function') void (resetAll as () => unknown)();
    }

    // 📋 قائمة البيانات التشغيلية التي يجب مسحها (الحفاظ على Users/Roles/Permissions)
    const RESET_KEYS = [
      KEYS.PEOPLE, // الأشخاص (مالكين، مستأجرين، وكلاء)
      KEYS.ROLES, // ✅ أدوار الأشخاص (علاقة شخص↔دور) لمنع بقايا أدوار يتيمة
      KEYS.PROPERTIES, // العقارات
      KEYS.CONTRACTS, // العقود
      KEYS.INSTALLMENTS, // الكمبيالات/الدفعات
      KEYS.COMMISSIONS, // العمولات
      KEYS.EXTERNAL_COMMISSIONS, // العمولات الخارجية
      KEYS.SALES_LISTINGS, // العروض البيعية
      KEYS.SALES_OFFERS, // عروض الشراء
      KEYS.SALES_AGREEMENTS, // اتفاقيات البيع
      KEYS.ALERTS, // التنبيهات
      KEYS.LOGS, // السجلات
      KEYS.MAINTENANCE, // طلبات الصيانة
      KEYS.DYNAMIC_TABLES, // الجداول الديناميكية
      KEYS.CLEARANCE_RECORDS, // سجلات التخليص
      KEYS.DASHBOARD_NOTES, // ملاحظات لوحة التحكم
      KEYS.REMINDERS, // المذكرات
      KEYS.CLIENT_INTERACTIONS, // تفاعلات العملاء
      KEYS.FOLLOW_UPS, // متابعة المهام
      KEYS.INSPECTIONS, // الكشوفات
    ];

    // ✅ الحفظ على (لا نمسها):
    // - KEYS.USERS (المستخدمون)
    // - KEYS.LOOKUP_CATEGORIES (فئات البحث)
    // - KEYS.LOOKUPS (قيم البحث)
    // - KEYS.USER_PERMISSIONS (الصلاحيات)
    // - KEYS.LEGAL_TEMPLATES (قوالب قانونية النظام)

    // 🗑️ حذف كل البيانات التشغيلية
    RESET_KEYS.forEach((key) => {
      void storage.removeItem(key);
      localStorage.removeItem(key);
      if (DbCache.arrays[key]) {
        DbCache.arrays[key] = [];
      }
    });

    // 🗑️ تفريغ البيانات من الـ cache أيضاً
    buildCache();

    // 📝 تسجيل العملية
    console.warn('✅ تم مسح كامل البيانات التجريبية');
    console.warn('📊 البيانات المحفوظة: Users, UserPermissions, Lookups, Templates');
    console.warn('🗑️  البيانات المحذوفة: ' + RESET_KEYS.length + ' جداول');

    return {
      success: true,
      message: 'تم مسح البيانات التجريبية بنجاح - النظام جاهز للبيانات الحقيقية',
      deletedTables: RESET_KEYS.length,
      timestamp: new Date().toISOString(),
      propertiesReset: true,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 PUBLIC API: إتاحة resetAllData من خارج الملف (للـ Console / Admin Panel)
// ═══════════════════════════════════════════════════════════════════════════════
const globalRec = globalThis as unknown as Record<string, unknown>;
globalRec['resetAllData'] = () => DbService.resetAllData();

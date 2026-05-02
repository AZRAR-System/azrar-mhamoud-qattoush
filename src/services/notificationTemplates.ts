/**
 * نظام نماذج الرسائل والإشعارات
 * يوفر قوالب رسائل قابلة للتعديل لمختلف الحالات
 * مع دعم placeholders وتعديل النماذج بشكل ديناميكي
 */

export interface NotificationTemplate {
  id: string;
  name: string;
  category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';
  title: string;
  body: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface TemplateContext {
  tenantName?: string;
  propertyCode?: string;
  amount?: number;
  dueDate?: string;
  paymentDate?: string;
  daysLate?: number;
  contractNumber?: string;
  remainingAmount?: number;
  notes?: string;
  [key: string]: unknown;
}

/** نفس التذييل في قوالب التحصيل الثابتة — مصدر واحد لتفادي التباين بين النسخ. */
export const COLLECTION_FIXED_PAYMENT_FOOTER = `طرق الدفع:
عبر خدمة CliQ (كليك)
الاسم المستعار: KHABERNI
البنك: بنك الاتحاد

بعد التحويل يرجى إرسال:
1- اسم المرسل
2- سبب التحويل (إيجار / عربون)
3- صورة إيصال الدفع

على الأرقام التالية:
0799090170 | 0799090171
`;

// النماذج الافتراضية
const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'data_quality_missing_property_utils_fixed',
    name: 'نقص بيانات العقار (كهرباء/مياه) – ثابت',
    category: 'warning',
    title: '',
    body: `تنبيه نقص بيانات العقار
────────────────────
السيد {{اسم_المالك}}

نرجو تزويدنا بالبيانات الناقصة التالية للعقارات المذكورة:
{{قائمة_العقارات}}

شاكرين تعاونكم.
`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['جودة البيانات', 'عقار', 'كهرباء', 'مياه', 'ثابت'],
  },
  {
    id: 'installment_reminder_upcoming_summary_fixed',
    name: 'تذكير قبل الاستحقاق (ملخص ثابت)',
    category: 'reminder',
    title: '',
    body: `مرحباً {{اسم_المستأجر}}،
تذكير قبل الاستحقاق{{جزء_العقار}}.

المستحقات القريبة:
{{المستحقات_القريبة}}

الإجمالي: {{الإجمالي}} د.أ
شكراً لكم.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'تذكير', 'قبل الاستحقاق', 'ملخص', 'ثابت'],
  },
  {
    id: 'installment_reminder_due_today_summary_fixed',
    name: 'يوم الاستحقاق (ملخص ثابت)',
    category: 'due',
    title: '',
    body: `مرحباً {{اسم_المستأجر}}،
اليوم موعد استحقاق الدفعة{{جزء_العقار}}.

المستحقات المستحقة اليوم:
{{المستحقات_اليوم}}

الإجمالي: {{الإجمالي}} د.أ
شكراً لكم.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'استحقاق', 'اليوم', 'ملخص', 'ثابت'],
  },
  {
    id: 'installment_reminder_overdue_summary_fixed',
    name: 'تذكير متأخر (ملخص ثابت)',
    category: 'late',
    title: '',
    body: `مرحباً {{اسم_المستأجر}}،
تنبيه بخصوص دفعات متأخرة{{جزء_العقار}}.

المستحقات المتأخرة:
{{المستحقات_المتأخرة}}

الإجمالي: {{الإجمالي}} د.أ
شكراً لكم.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'تأخير', 'متأخر', 'ملخص', 'ثابت'],
  },
  {
    id: 'pre_due_reminder',
    name: 'تذكير قبل الاستحقاق',
    category: 'reminder',
    title: 'تذكير: قريباً موعد استحقاق الدفعة',
    body: `السلام عليكم {{tenantName}}

نود تذكيركم بأن موعد استحقاق الدفعة سيكون قريباً:

📋 بيانات الدفعة:
• المبلغ: {{amount}} د.أ
• تاريخ الاستحقاق: {{dueDate}}
• العقار: {{propertyCode}}
• رقم العقد: {{contractNumber}}

⏰ يرجى الدفع قبل موعد الاستحقاق لتجنب الرسوم الإضافية.

شكراً لحسن تعاونكم 🙏`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'تذكير', 'قبل الاستحقاق'],
  },
  {
    id: 'due_day_reminder',
    name: 'يوم الاستحقاق',
    category: 'due',
    title: 'اليوم: موعد استحقاق الدفعة',
    body: `السلام عليكم {{tenantName}}

اليوم هو موعد استحقاق دفعتكم:

📋 بيانات الدفعة:
• المبلغ: {{amount}} د.أ
• التاريخ: {{dueDate}}
• العقار: {{propertyCode}}
• المتبقي: {{remainingAmount}} د.أ

⏰ يرجى الدفع اليوم لتجنب أي تأخير.

شكراً لكم 🙏`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'استحقاق', 'نفس اليوم'],
  },
  {
    id: 'post_late_reminder',
    name: 'تذكير بعد التأخير',
    category: 'late',
    title: 'تنبيه: تأخر الدفعة بـ {{daysLate}} أيام',
    body: `السلام عليكم {{tenantName}}

تأخرتم عن دفع القسط المستحق:

⚠️ تفاصيل التأخر:
• المبلغ المستحق: {{amount}} د.أ
• عدد أيام التأخر: {{daysLate}} أيام
• تاريخ الاستحقاق: {{dueDate}}
• العقار: {{propertyCode}}

💡 الحل:
يرجى الدفع في أقرب وقت ممكن لتجنب إجراءات إضافية.

📞 للاستفسار، يرجى التواصل معنا.

شكراً لتعاونكم 🙏`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['دفع', 'تأخير', 'تنبيه'],
  },
  {
    id: 'legal_warning',
    name: 'إنذار قانوني',
    category: 'warning',
    title: 'إنذار: تجاوز المدة المحددة للدفع',
    body: `السلام عليكم {{tenantName}}

إنذار رسمي بخصوص تأخركم عن دفع القسط:

⚠️ تفاصيل الإنذار:
• المبلغ المستحق: {{amount}} د.أ
• عدد أيام التأخر: {{daysLate}} أيام
• العقار: {{propertyCode}}
• رقم العقد: {{contractNumber}}

📌 التنبيه الرسمي:
لديكم 48 ساعة من استلام هذا الإنذار للدفع الفوري.
عدم الدفع قد يؤدي إلى اتخاذ إجراءات قانونية.

📞 للدفع أو التفاوض، يرجى التواصل فوراً.

الشروط والأحكام تنطبق 📋`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['إنذار', 'قانوني', 'طارئ'],
  },
  {
    id: 'legal_notice',
    name: 'إشعار قانوني',
    category: 'legal',
    title: 'إشعار قانوني: إجراءات قانونية وشيكة',
    body: `السلام عليكم {{tenantName}}

إشعار قانوني رسمي:

⚖️ التفاصيل:
• المبلغ المستحق: {{amount}} د.أ
• المدة المتأخرة: {{daysLate}} يوم
• العقار: {{propertyCode}}
• رقم العقد: {{contractNumber}}

🔔 إعلان:
بناءً على تأخركم الطويل عن الدفع، سيتم تحريك الإجراءات القانونية ضدكم.

⏰ فرصة أخيرة:
للدفع الفوري أو التسوية، يرجى التواصل خلال 24 ساعة.

محامي القضايا:
📞 للتواصل الفوري والتسوية

جميع الحقوق محفوظة ⚖️`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['قانوني', 'إشعار', 'إجراءات'],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // قوالب التحصيل والإخطارات (نصوص ثابتة) — لا تعديل على النص
  // ملاحظة: نضع النص كاملًا في body ونترك title فارغًا لتفادي إضافة أسطر إضافية.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'collection_friendly_late_payment_fixed',
    name: 'رسالة ودّية – إشعار تأخير دفع (ثابت)',
    category: 'late',
    title: '',
    body: `إشعار تأخير دفع
────────────────────
اسم المستأجر: {{اسم_المستأجر}}
رقم الهاتف: {{رقم_الهاتف}}
عدد دفعات الإيجار المتأخرة: {{عدد_الكمبيالات}}
إجمالي المبالغ المتأخرة: {{مجموع_المبالغ_المتأخرة}} د.أ

تفاصيل الدفعات:
{{تفاصيل_الكمبيالات}}

نلفت عنايتكم إلى أن هناك دفعات لم تُسدّد في مواعيدها المحددة،
ونرجو منكم التكرم بتسديد المبلغ المستحق في أقرب وقت ممكن
لتفادي أي التزامات إضافية أو إجراءات قد تؤثر على العلاقة الإيجارية الطيبة بيننا.

${COLLECTION_FIXED_PAYMENT_FOOTER}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['تحصيل', 'تأخير', 'ودي', 'ثابت'],
  },
  {
    id: 'collection_legal_late_payment_fixed',
    name: 'رسالة قانونية – إشعار تأخير دفع (ثابت)',
    category: 'warning',
    title: '',
    body: `إشعار تأخير دفع
────────────────────
اسم المستأجر: {{اسم_المستأجر}}
رقم الهاتف: {{رقم_الهاتف}}
عدد دفعات الإيجار المتأخرة: {{عدد_الكمبيالات}}
إجمالي المبالغ المتأخرة: {{مجموع_المبالغ_المتأخرة}} د.أ

تفاصيل الدفعات:
{{تفاصيل_الكمبيالات}}

نلفت عنايتكم إلى أنكم لم تلتزموا بتسديد هذه الدفعات في مواعيدها،
ويُعتبر هذا تأخيرًا موجبًا لاتخاذ الإجراءات القانونية
وفقًا للعقد المبرم وقانون المالكين والمستأجرين.

${COLLECTION_FIXED_PAYMENT_FOOTER}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['تحصيل', 'تأخير', 'قانوني', 'ثابت'],
  },
  {
    id: 'collection_pay_notice_7_days_fixed',
    name: 'إخطار بالدفع – مهلة 7 أيام (ثابت)',
    category: 'legal',
    title: '',
    body: `إخطار بالدفع
────────────────────
اسم المستأجر: {{اسم_المستأجر}}
رقم الهاتف: {{رقم_الهاتف}}
عدد دفعات الإيجار المتأخرة: {{عدد_الكمبيالات}}
إجمالي المبالغ المتأخرة: {{مجموع_المبالغ_المتأخرة}} د.أ

تفاصيل الدفعات:
{{تفاصيل_الكمبيالات}}

نخطرُكم بوجوب تسديد المبالغ المتأخرة خلال مدة أقصاها (7 أيام)
من تاريخ هذا الإشعار.
وفي حال عدم السداد، يحتفظ المؤجر بحقه في مباشرة
الإجراءات القضائية والتنفيذية.

${COLLECTION_FIXED_PAYMENT_FOOTER}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['تحصيل', 'مهلة', '7 أيام', 'ثابت'],
  },
  {
    id: 'collection_eviction_notice_fixed',
    name: 'إخطار بالخلاء (ثابت)',
    category: 'legal',
    title: '',
    body: `إخطار بالخلاء
────────────────────
اسم المستأجر: {{اسم_المستأجر}}
رقم الهاتف: {{رقم_الهاتف}}
عدد دفعات الإيجار غير المسددة: {{عدد_الكمبيالات}}
إجمالي المبالغ المتأخرة: {{مجموع_المبالغ_المتأخرة}} د.أ

تفاصيل الدفعات:
{{تفاصيل_الكمبيالات}}

نظرًا لانقضاء المهلة القانونية الممنوحة لكم (7 أيام)
وعدم التزامكم بتسديد المبالغ المستحقة،
فإن المؤجر يطالبكم بإخلاء المأجور فورًا وتسليمه
بالحالة المتفق عليها.
ويُعتبر هذا الإشعار إنذارًا رسميًا بالخلاء.

${COLLECTION_FIXED_PAYMENT_FOOTER}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['تحصيل', 'إخلاء', 'قانوني', 'ثابت'],
  },
  /** قوالب واتساب من التنبيهات — تُربَط بـ `WhatsAppTemplateKey` عبر `whatsappTemplateMap` */
  {
    id: 'wa_payment_reminder',
    name: 'واتساب — تذكير دفع (من التنبيه)',
    category: 'reminder',
    title: '',
    body: `مرحباً {{tenantName}}،
نود تذكيركم قبل الاستحقاق بوجود {{count}} دفعة قريبة الاستحقاق للعقار ({{propertyCode}}).
{{الوصف}}
يرجى السداد قبل موعد الاستحقاق.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['واتساب', 'تنبيه', 'دفع'],
  },
  {
    id: 'wa_renewal_offer',
    name: 'واتساب — عرض تجديد (من التنبيه)',
    category: 'reminder',
    title: '',
    body: `مرحباً {{tenantName}}،
عقد الإيجار الخاص بالعقار ({{propertyCode}}) قارب على الانتهاء.
يرجى مراجعة المكتب للتجديد.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['واتساب', 'تنبيه', 'تجديد'],
  },
  {
    id: 'wa_legal_notice',
    name: 'واتساب — إشعار قانوني (من التنبيه)',
    category: 'legal',
    title: '',
    body: `السادة {{tenantName}}،
نود إفادتكم بخصوص إجراءات أو مراسلات قد تتطلّب المتابعة.
{{الوصف}}
العقار: {{propertyCode}}.`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['واتساب', 'تنبيه', 'قانوني'],
  },
  {
    id: 'wa_custom',
    name: 'واتساب — إشعار عام (من التنبيه)',
    category: 'warning',
    title: '',
    body: `مرحباً {{tenantName}}،
إشعار بخصوص العقار ({{propertyCode}}):
{{الوصف}}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['واتساب', 'تنبيه', 'عام'],
  },
];

/** نسخة للقراءة فقط من القوالب المدمجة — للمقارنة مع `db_message_templates` */
export function getBuiltinNotificationTemplates(): NotificationTemplate[] {
  return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
}

// فئة إدارة النماذج
import { storage } from '@/services/storage';

class NotificationTemplateManager {
  private templates: NotificationTemplate[] = [];

  constructor() {
    // تحميل النماذج من localStorage
    this.loadTemplates();
  }

  /**
   * تحميل النماذج من localStorage أو استخدام النماذج الافتراضية
   */
  private loadTemplates(): void {
    try {
      const stored = localStorage.getItem('notification_templates');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.templates = Array.isArray(parsed) ? parsed : [];

        // Merge missing defaults by id (do not overwrite user-edited templates)
        const existingIds = new Set(this.templates.map((t) => t.id));
        let changed = false;
        for (const t of DEFAULT_TEMPLATES) {
          if (!existingIds.has(t.id)) {
            this.templates.push(JSON.parse(JSON.stringify(t)));
            changed = true;
          }
        }
        if (changed) this.saveTemplates();
      } else {
        this.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
        this.saveTemplates();
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      this.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    }
  }

  /**
   * حفظ النماذج في localStorage
   */
  private saveTemplates(): void {
    try {
      const serialized = JSON.stringify(this.templates);
      void storage.setItem('notification_templates', serialized);
      localStorage.setItem('notification_templates', serialized);
    } catch (error) {
      console.error('Error saving templates:', error);
    }
  }

  /**
   * الحصول على جميع النماذج
   */
  getAll(): NotificationTemplate[] {
    return this.templates;
  }

  /**
   * الحصول على نموذج بواسطة ID
   */
  getById(id: string): NotificationTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * الحصول على النماذج حسب الفئة
   */
  getByCategory(category: NotificationTemplate['category']): NotificationTemplate[] {
    return this.templates.filter((t) => t.category === category && t.enabled);
  }

  /**
   * إضافة نموذج جديد
   */
  add(template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>): NotificationTemplate {
    const newTemplate: NotificationTemplate = {
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates.push(newTemplate);
    this.saveTemplates();
    return newTemplate;
  }

  /**
   * تحديث نموذج
   */
  update(
    id: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>
  ): NotificationTemplate | undefined {
    const template = this.templates.find((t) => t.id === id);
    if (template) {
      Object.assign(template, updates, { updatedAt: new Date().toISOString() });
      this.saveTemplates();
    }
    return template;
  }

  /**
   * حذف نموذج
   */
  delete(id: string): boolean {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.templates.splice(index, 1);
      this.saveTemplates();
      return true;
    }
    return false;
  }

  /**
   * تفعيل/تعطيل نموذج
   */
  toggleEnabled(id: string): NotificationTemplate | undefined {
    const template = this.templates.find((t) => t.id === id);
    if (template) {
      template.enabled = !template.enabled;
      template.updatedAt = new Date().toISOString();
      this.saveTemplates();
    }
    return template;
  }

  /**
   * إعادة تعيين النماذج إلى الافتراضية
   */
  reset(): void {
    this.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    this.saveTemplates();
  }
}

// إنشاء مثيل واحد من مدير النماذج
const templateManager = new NotificationTemplateManager();

import { buildWhatsAppLink, openWhatsAppForPhones } from '@/utils/whatsapp';
import { openExternalUrl } from '@/utils/externalLink';
import { getMessageGlobalContext } from '@/utils/messageGlobalContext';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';

/**
 * ملء النموذج بالبيانات
 * يستبدل جميع placeholders من نوع {{ key }} بالقيم المقابلة
 */
export function fillTemplate(
  template: NotificationTemplate | string,
  context: TemplateContext
): string {
  const content = typeof template === 'string' ? template : template.body;
  const mergedContext: Record<string, unknown> = {
    ...getMessageGlobalContext(),
    ...(context || {}),
  };

  return content.replace(/\{\{\s*([\w\u0600-\u06FF]+)\s*\}\}/g, (match, key) => {
    const value = mergedContext[key];

    // معالجة خاصة لبعض أنواع البيانات
    if (value === undefined || value === null) {
      return match; // إرجاع الـ placeholder كما هو إذا لم تكن القيمة موجودة
    }

    if (typeof value === 'number') {
      // Always use English digits for consistency across the app
      return value.toLocaleString('en-US');
    }

    return String(value);
  });
}

/**
 * الحصول على رابط واتساب مع الرسالة المملوءة
 */
export function getWhatsAppLink(message: string, phoneNumber: string): string {
  return buildWhatsAppLink(message, phoneNumber, {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
  });
}

/**
 * فتح واتساب بالرسالة المحددة
 */
export function openWhatsApp(message: string, phoneNumber: string): void {
  const link = getWhatsAppLink(message, phoneNumber);
  openExternalUrl(link);
}

/**
 * فتح واتساب لأكثر من رقم (مع تأخير بين الأرقام)
 */
export async function openWhatsAppMulti(
  message: string,
  phoneNumbers: string[],
  delayMs: number = 10_000
): Promise<void> {
  await openWhatsAppForPhones(message, phoneNumbers, {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
    delayMs,
  });
}

/**
 * الحصول على معلومات النموذج المملوء
 */
export interface FilledTemplateInfo {
  title: string;
  body: string;
  category: NotificationTemplate['category'];
  enabled: boolean;
}

/**
 * ملء النموذج كاملاً (العنوان والنص)
 */
export function fillTemplateComplete(
  template: NotificationTemplate,
  context: TemplateContext
): FilledTemplateInfo {
  return {
    title: fillTemplate(template.title, context),
    body: fillTemplate(template.body, context),
    category: template.category,
    enabled: template.enabled,
  };
}

// تصدير مدير النماذج
export const NotificationTemplates = {
  // الحصول على جميع النماذج
  getAll: () => templateManager.getAll(),

  // الحصول على نموذج بـ ID
  getById: (id: string) => templateManager.getById(id),

  // الحصول على النماذج حسب الفئة
  getByCategory: (category: NotificationTemplate['category']) =>
    templateManager.getByCategory(category),

  // إضافة نموذج جديد
  add: (template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>) =>
    templateManager.add(template),

  // تحديث نموذج
  update: (id: string, updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>) =>
    templateManager.update(id, updates),

  // حذف نموذج
  delete: (id: string) => templateManager.delete(id),

  // تفعيل/تعطيل نموذج
  toggleEnabled: (id: string) => templateManager.toggleEnabled(id),

  // إعادة تعيين إلى الافتراضية
  reset: () => templateManager.reset(),

  // ملء النموذج بالبيانات
  fill: (template: NotificationTemplate | string, context: TemplateContext) =>
    fillTemplate(template, context),

  // ملء النموذج كاملاً
  fillComplete: (template: NotificationTemplate, context: TemplateContext) =>
    fillTemplateComplete(template, context),

  // الحصول على رابط واتساب
  getWhatsAppLink: (message: string, phoneNumber: string) => getWhatsAppLink(message, phoneNumber),

  // فتح واتساب
  openWhatsApp: (message: string, phoneNumber: string) => openWhatsApp(message, phoneNumber),
};

export default NotificationTemplates;

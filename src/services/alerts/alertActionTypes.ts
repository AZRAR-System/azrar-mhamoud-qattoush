/**
 * أنواع طبقة سياسة التنبيهات (Policy Engine) — مودالات مُسمّاة وإجراءات ثانوية.
 */

import type { tbl_Alerts } from '@/types';

export type AlertLayerModalKind =
  | 'renew_contract'
  | 'record_payment'
  | 'whatsapp'
  | 'assign_technician'
  | 'legal_file'
  | 'person_profile'
  | 'receipt'
  | 'insurance';

/** تصنيف خشن للتنبيه يغذّي الإجراءات الثانوية وواجهة Inbox */
export type AlertClass =
  | 'financial'
  | 'data_quality'
  | 'risk'
  | 'expiry'
  | 'maintenance'
  | 'person'
  | 'property'
  | 'contract'
  | 'installment'
  | 'system'
  | 'smart_behavior'
  | 'tasks_followup'
  | 'collection_board'
  | 'generic';

export type AlertSecondaryAction =
  | { id: string; label: string; type: 'layer'; layer: AlertLayerModalKind }
  | { id: string; label: string; type: 'navigate' };

/** نية فتح مركز التنبيهات من لوحة القسم SECTION_VIEW (تُمرَّر عبر PanelProps.alertsIntent) */
export type AlertPanelIntent = {
  title?: string;
  only?: 'unread' | 'all';
  category?: string;
  q?: string;
  id?: string;
};

/** حمولة نافذة السداد/الكمبيالة — تُمرَّر إلى `executeAction` + `openModal` */
export type RecordPaymentPayload = {
  installmentId: string;
  contractId: string;
  personId: string;
  amount: number;
  lateFee: number;
};

/** حمولة مسار الملف القانوني */
export type LegalFilePayload = {
  contractId: string;
  personId: string;
  caseRef?: string;
};

/** مفتاح قالب واتساب — يحدد النص الافتراضي عند غياب `prefillBody` */
export type WhatsAppTemplateKey =
  | 'payment_reminder'
  | 'renewal_offer'
  | 'legal_notice'
  | 'custom';

export type WhatsAppPayload = {
  personId: string;
  phone: string;
  templateKey: WhatsAppTemplateKey;
  /** إن وُجد يُستخدم كمعاينة/إرسال؛ وإلا يُبنى النص من `templateKey` + بيانات التنبيه */
  prefillBody?: string;
};

export type RenewContractPayload = {
  contractId: string;
  personId: string;
  propertyId: string;
  currentRent: number;
  /** تاريخ انتهاء العقد بصيغة ISO (YYYY-MM-DD) */
  expiryDate: string;
};

export type PersonProfilePayload = {
  personId: string;
  /** إن وُجد — يُعرض ملخص العقد داخل المودال (وضع القرار) */
  contractId?: string;
  /** `view` يُنفَّذ في `executeAction` بدون مودال؛ `decision` فقط يعرض واجهة القرار */
  openAction: 'view' | 'decision';
};

export type InsurancePayload = {
  propertyId: string;
  currentPolicyRef?: string;
  expiryDate: string;
  currentProvider?: string;
};

export type AssignTechnicianPayload = {
  maintenanceId: string;
  propertyId: string;
  unitRef?: string;
  issueDescription: string;
  priority: 'high' | 'medium' | 'low';
};

export type ReceiptPayload = {
  installmentId: string;
  contractId: string;
  personId: string;
  amount: number;
  /** تاريخ الدفع الفعلي من سجل الدفعات (أو تاريخ_الدفع عند غياب السجل) — YYYY-MM-DD */
  paidAt: string;
  paymentMethod: string;
};

/** زر/إجراء أساسي من بطاقة التنبيه */
export type AlertPrimaryAction = {
  role: 'primary';
  mode: 'modal' | 'destination';
  label: string;
};

/**
 * اتحاد الحمولات المنفّذة عبر Policy.
 * `execute_alert_open` بدون `data` — أي بيانات إضافية تستلزم variant جديداً.
 */
export type AlertActionPayload =
  | { variant: 'execute_alert_open'; alert: tbl_Alerts }
  | { variant: 'record_payment'; alert: tbl_Alerts; data: RecordPaymentPayload }
  | { variant: 'legal_file'; alert: tbl_Alerts; data: LegalFilePayload }
  | { variant: 'whatsapp'; alert: tbl_Alerts; data: WhatsAppPayload }
  | { variant: 'renew_contract'; alert: tbl_Alerts; data: RenewContractPayload }
  | { variant: 'person_profile'; alert: tbl_Alerts; data: PersonProfilePayload }
  | { variant: 'insurance'; alert: tbl_Alerts; data: InsurancePayload }
  | { variant: 'assign_technician'; alert: tbl_Alerts; data: AssignTechnicianPayload }
  | { variant: 'receipt'; alert: tbl_Alerts; data: ReceiptPayload };

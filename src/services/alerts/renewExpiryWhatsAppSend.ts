/**
 * إرسال قوالب انتهاء/تجديد العقد عبر واتساب (مشترك بين RenewContractModal و useAlerts).
 */

import type { tbl_Alerts } from '@/types';
import { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';

export type ExpiryKind = 'pre_notice' | 'approved' | 'rejected' | 'auto';

const TEMPLATE_IDS: Record<
  ExpiryKind,
  { tenant: string; owner: string }
> = {
  pre_notice: {
    tenant: 'contract_expiry_pre_notice_tenant_fixed',
    owner: 'contract_expiry_pre_notice_owner_fixed',
  },
  approved: {
    tenant: 'contract_renewal_approved_tenant_fixed',
    owner: 'contract_renewal_approved_owner_fixed',
  },
  rejected: {
    tenant: 'contract_renewal_rejected_tenant_fixed',
    owner: 'contract_renewal_rejected_owner_fixed',
  },
  auto: {
    tenant: 'contract_renewal_auto_tenant_fixed',
    owner: 'contract_renewal_auto_owner_fixed',
  },
};

export function expiryTemplateId(kind: ExpiryKind, target: 'tenant' | 'owner'): string {
  return TEMPLATE_IDS[kind][target];
}

function collectTenantPhones(alert: tbl_Alerts, contractId: string): string[] {
  const phones: Array<string | null | undefined> = [alert.phone];

  if (alert.مرجع_الجدول === 'الأشخاص_tbl' && alert.مرجع_المعرف) {
    const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
    const person = people.find((p) => String(p?.رقم_الشخص) === String(alert.مرجع_المعرف));
    phones.push(person?.رقم_الهاتف, person?.رقم_هاتف_اضافي);
  }

  if (alert.مرجع_الجدول === 'العقود_tbl' && String(alert.مرجع_المعرف) === contractId) {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const contract = contracts.find((c) => String(c?.رقم_العقد) === contractId);
    if (contract?.رقم_المستاجر) {
      const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
      const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
      phones.push(tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي);
    }
  }

  const uniq = new Set<string>();
  for (const p of phones) {
    const v = String(p ?? '').trim();
    if (v) uniq.add(v);
  }
  return Array.from(uniq);
}

function collectOwnerPhones(contractId: string): string[] {
  const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
  const contract = contracts.find((c) => String(c?.رقم_العقد) === String(contractId));
  const property = contract?.رقم_العقار
    ? ((DbService.getProperties?.() || []) as العقارات_tbl[]).find(
        (p) => String(p?.رقم_العقار) === String(contract.رقم_العقار)
      )
    : null;
  const owner = property?.رقم_المالك
    ? ((DbService.getPeople?.() || []) as الأشخاص_tbl[]).find(
        (p) => String(p?.رقم_الشخص) === String(property.رقم_المالك)
      )
    : null;

  const phones: Array<string | null | undefined> = [owner?.رقم_الهاتف, owner?.رقم_هاتف_اضافي];
  const uniq = new Set<string>();
  for (const p of phones) {
    const v = String(p ?? '').trim();
    if (v) uniq.add(v);
  }
  return Array.from(uniq);
}

export async function sendRenewExpiryWhatsApp(opts: {
  alert: tbl_Alerts;
  contractId: string;
  target: 'tenant' | 'owner';
  expiryKind: ExpiryKind;
}): Promise<void> {
  const { alert, contractId, target, expiryKind } = opts;
  const tmplId = expiryTemplateId(expiryKind, target);
  const generated = DbService.generateLegalNotice(tmplId, contractId, {
    date: new Date().toLocaleDateString('en-GB'),
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  });

  const message = String(
    typeof generated === 'string' ? generated : (generated as { text: string })?.text || ''
  ).trim();
  if (!message) return;

  const phones =
    target === 'tenant' ? collectTenantPhones(alert, contractId) : collectOwnerPhones(contractId);
  if (phones.length === 0) return;

  await openWhatsAppForPhones(message, phones, {
    defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
    delayMs: 10_000,
  });
}

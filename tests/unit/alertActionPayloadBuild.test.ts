import type { tbl_Alerts } from '@/types';
import {
  buildDefaultWhatsAppPrefillBody,
  inferWhatsAppTemplateKey,
  isValidRenewContractPayload,
} from '@/services/alerts/alertActionPayloadBuild';

const minimalAlert = (over: Partial<tbl_Alerts>): tbl_Alerts =>
  ({
    id: 'a1',
    نوع_التنبيه: 'تنبيه',
    الوصف: 'وصف تجريبي',
    تاريخ_الانشاء: '2026-01-01',
    تم_القراءة: false,
    category: 'Financial',
    tenantName: 'أحمد',
    propertyCode: 'P-1',
    ...over,
  }) as tbl_Alerts;

describe('alertActionPayloadBuild', () => {
  it('inferWhatsAppTemplateKey + buildDefaultWhatsAppPrefillBody للمالي (payment_reminder)', () => {
    const a = minimalAlert({ category: 'Financial' });
    const key = inferWhatsAppTemplateKey(a);
    expect(key).toBe('payment_reminder');
    const body = buildDefaultWhatsAppPrefillBody(a, key);
    expect(body).toContain('مرحباً');
    expect(body).toContain('أحمد');
    expect(body).toContain('وصف تجريبي');
  });

  it('buildDefaultWhatsAppPrefillBody يتبع templateKey حتى لو اختلف تصنيف التنبيه', () => {
    const a = minimalAlert({ category: 'System' });
    const bodyRenewal = buildDefaultWhatsAppPrefillBody(a, 'renewal_offer');
    expect(bodyRenewal).toContain('للتجديد');
    const bodyLegal = buildDefaultWhatsAppPrefillBody(a, 'legal_notice');
    expect(bodyLegal).toContain('إفادتكم');
  });

  it('isValidRenewContractPayload يقبل حمولة سليمة ويرفض أخطاء', () => {
    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 350,
        expiryDate: '2026-12-31',
      })
    ).toBe(true);

    expect(
      isValidRenewContractPayload({
        contractId: '',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 350,
        expiryDate: '2026-12-31',
      })
    ).toBe(false);

    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: -1,
        expiryDate: '2026-12-31',
      })
    ).toBe(false);

    expect(
      isValidRenewContractPayload({
        contractId: 'c1',
        personId: 'p1',
        propertyId: 'pr1',
        currentRent: 100,
        expiryDate: '31-12-2026',
      })
    ).toBe(false);
  });
});

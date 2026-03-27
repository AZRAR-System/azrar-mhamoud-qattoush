/**
 * Wires SmartEngine anomaly detection into tbl_Alerts via alertsCore.
 */

import type { tbl_Alerts } from '@/types';
import { SmartEngine } from '../smartEngine';
import { buildContractAlertContext, stableAlertId, upsertAlert } from './alertsCore';

type AsUnknown = (value: unknown) => Record<string, unknown>;

export function createHandleSmartEngine(asUnknownRecord: AsUnknown) {
  return (category: 'person' | 'property' | 'contract', data: unknown) => {
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
}

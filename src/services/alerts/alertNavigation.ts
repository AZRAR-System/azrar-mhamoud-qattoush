/**
 * تنقّل موحّد لمركز التنبيهات داخل SECTION_VIEW مع نية فلاتر اختيارية (PanelProps.alertsIntent).
 */

import type { PanelProps, PanelType } from '@/context/ModalContext';
import type { AlertPanelIntent } from '@/services/alerts/alertActionTypes';
import { ROUTE_PATHS } from '@/routes/paths';

export type OpenSectionPanelFn = (type: PanelType, dataId?: string, props?: PanelProps) => void;

export function alertPanelIntentHasPayload(intent?: AlertPanelIntent): boolean {
  if (!intent) return false;
  return (
    intent.only === 'unread' ||
    intent.only === 'all' ||
    intent.category !== undefined ||
    intent.q !== undefined ||
    Boolean(intent.id && String(intent.id).trim())
  );
}

/**
 * فتح مركز التنبيهات في منزلق واحد؛ تُمرَّر النية في props حتى تستقبلها `SectionViewPanel` → `Alerts` → `useAlerts`.
 */
export function openAlertsInSection(openPanel: OpenSectionPanelFn, intent?: AlertPanelIntent): void {
  const title = intent?.title?.trim() || 'الإشعارات';
  const alertsIntent: AlertPanelIntent | undefined =
    intent && alertPanelIntentHasPayload(intent)
      ? {
          only: intent.only,
          category: intent.category,
          q: intent.q,
          id: intent.id,
        }
      : undefined;

  openPanel('SECTION_VIEW', ROUTE_PATHS.ALERTS, {
    title,
    ...(alertsIntent ? { alertsIntent } : {}),
  });
}

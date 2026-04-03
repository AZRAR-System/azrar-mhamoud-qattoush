import { ServerSqlSection } from '@/components/settings/ServerSqlSection';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsServerSection({ page }: Props) {
  const {
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
      <ServerSqlSection />
    </RBACGuard>
  );
}

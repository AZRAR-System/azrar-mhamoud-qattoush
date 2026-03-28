import type { FC } from 'react';
import { useSettingsPage } from '@/hooks/useSettingsPage';
import { SettingsPageView } from '@/components/settings/SettingsPageView';

export const Settings: FC<{
  initialSection?: string;
  serverOnly?: boolean;
  embedded?: boolean;
}> = (props) => {
  const page = useSettingsPage(props);
  return <SettingsPageView page={page} />;
};

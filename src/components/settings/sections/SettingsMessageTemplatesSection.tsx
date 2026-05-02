import type { FC } from 'react';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { MessageTemplatesEditor } from '@/components/messaging/MessageTemplatesEditor';

type Props = { page: SettingsPageModel };

export const SettingsMessageTemplatesSection: FC<Props> = ({ page }) => (
  <MessageTemplatesEditor
    settingsFieldClasses={{ inputClass: page.inputClass, labelClass: page.labelClass }}
  />
);

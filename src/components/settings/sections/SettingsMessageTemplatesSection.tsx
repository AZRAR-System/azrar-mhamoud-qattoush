import type { FC } from 'react';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';
import { MessageTemplatesEditor } from '@/components/messaging/MessageTemplatesEditor';
import type { MessageTemplateSourceGroup } from '@/services/messageTemplateSourceGroups';

type Props = {
  page: SettingsPageModel;
  highlightedTemplateId?: string;
  sourceGroupFilter?: MessageTemplateSourceGroup | null;
};

export const SettingsMessageTemplatesSection: FC<Props> = ({
  page,
  highlightedTemplateId,
  sourceGroupFilter,
}) => (
  <MessageTemplatesEditor
    settingsFieldClasses={{ inputClass: page.inputClass, labelClass: page.labelClass }}
    highlightedTemplateId={highlightedTemplateId}
    sourceGroupFilter={sourceGroupFilter}
  />
);

import type { FC } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { ContactsPageView } from '@/components/contacts/ContactsPageView';

/**
 * اتصالات - كولترولر (Controller)
 */
export const Contacts: FC = () => {
  const page = useContacts();

  return <ContactsPageView page={page} />;
};

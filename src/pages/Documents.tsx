import { type FC } from 'react';
import { useDocuments } from '@/hooks/useDocuments';
import { DocumentsPageView } from '@/components/documents/DocumentsPageView';

/**
 * Documents Controller
 */
export const Documents: FC = () => {
  const page = useDocuments();
  return <DocumentsPageView page={page} />;
};

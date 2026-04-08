import React from 'react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { اتفاقيات_البيع_tbl, عروض_البيع_tbl } from '@/types';

const t = (s: string) => s;

interface SalesAgreementsTabProps {
  agreements: اتفاقيات_البيع_tbl[];
  listings: عروض_البيع_tbl[];
  isLoading: boolean;
}

export const SalesAgreementsTab: React.FC<SalesAgreementsTabProps> = ({ agreements, listings, isLoading }) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="text-center py-16">
      <h3 className="text-xl font-bold text-gray-500">جدول الاتفاقيات والعقود</h3>
      <p className="text-gray-400 mt-2">قيد التنفيذ</p>
    </div>
  );
};
import React from 'react';
import { User } from 'lucide-react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { عروض_الشراء_tbl } from '@/types';

const t = (s: string) => s;

interface SalesOffersTabProps {
  offers: عروض_الشراء_tbl[];
  isLoading: boolean;
}

export const SalesOffersTab: React.FC<SalesOffersTabProps> = ({ offers, isLoading }) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="text-center py-16">
      <User size={64} className="mx-auto text-gray-300 mb-4" />
      <h3 className="text-xl font-bold text-gray-500">قسم عروض الشراء</h3>
      <p className="text-gray-400 mt-2">سيتم تفعيل هذا القسم في التحديث القادم</p>
    </div>
  );
};
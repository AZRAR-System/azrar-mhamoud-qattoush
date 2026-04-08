import React from 'react';
import { BadgeDollarSign, Briefcase, User, FileSignature, ArrowUpRight } from 'lucide-react';
import { formatCurrencyJOD, formatNumber } from '@/utils/format';

const t = (s: string) => s;

const ANIMATIONS = {
  cardAppear: 'animate-[card-appear_0.4s_ease-out_forwards] opacity-0 translate-y-2',
};

interface SalesDashboardProps {
  stats: {
    totalSales: number;
    activeListings: number;
    pendingOffers: number;
    pendingAgreements: number;
  };
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ stats }) => {
  const cards = [
    {
      title: 'مبيعات مكتملة',
      value: stats.totalSales,
      subtitle: 'إجمالي المبيعات المحققة',
      icon: BadgeDollarSign,
      color: 'emerald',
      suffix: 'د.أ',
      trend: '+12%'
    },
    {
      title: 'عروض نشطة',
      value: stats.activeListings,
      subtitle: 'عقارات معروضة حالياً',
      icon: Briefcase,
      color: 'indigo',
      suffix: '',
      trend: '+3'
    },
    {
      title: 'عروض الشراء',
      value: stats.pendingOffers,
      subtitle: `${stats.pendingOffers} قيد الانتظار`,
      icon: User,
      color: 'purple',
      suffix: '',
      trend: '+5'
    },
    {
      title: 'اتفاقيات معلقة',
      value: stats.pendingAgreements,
      subtitle: `${stats.pendingAgreements} بانتظار نقل الملكية`,
      icon: FileSignature,
      color: 'orange',
      suffix: '',
      trend: '+2'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div
          key={card.title}
          className={`app-card p-6 flex flex-col justify-between min-h-32 hover:scale-[1.02] transition-all cursor-default ${ANIMATIONS.cardAppear}`}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                {t(card.title)}
              </p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                {card.color === 'emerald' ? formatCurrencyJOD(card.value) : formatNumber(card.value)}
                {card.suffix && <span className="text-sm font-bold text-slate-400 ml-1">{card.suffix}</span>}
              </h3>
            </div>
            <div className={`p-3 bg-${card.color}-500/10 text-${card.color}-600 dark:text-${card.color}-400 rounded-2xl border border-${card.color}-200/50 dark:border-${card.color}-500/20 shadow-inner`}>
              <card.icon size={24} />
            </div>
          </div>
          <div className={`text-[10px] text-${card.color}-700 dark:text-${card.color}-400 font-bold flex items-center gap-1 mt-4 bg-${card.color}-50/50 dark:bg-${card.color}-900/20 w-fit px-2 py-0.5 rounded-full border border-${card.color}-100 dark:border-${card.color}-800/50`}>
            <ArrowUpRight size={12} /> {t(card.subtitle)} • <span className="text-green-600">{card.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
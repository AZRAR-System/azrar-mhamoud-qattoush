import React from 'react';
import { Star, TrendingDown, TrendingUp } from 'lucide-react';
import type { الأشخاص_tbl } from '@/types';
import { isRecord } from '@/components/installments/installmentsUtils';

export interface TenantRatingStripProps {
  tenant: الأشخاص_tbl | undefined;
}

export const TenantRatingStrip: React.FC<TenantRatingStripProps> = ({ tenant }) => {
  if (!tenant) return null;

  type BehaviorRating = { type?: unknown; points?: unknown };
  type TenantWithBehaviorRating = الأشخاص_tbl & { تصنيف_السلوك?: unknown };

  const rawRating = (tenant as TenantWithBehaviorRating).تصنيف_السلوك;
  const parsed: BehaviorRating | null = isRecord(rawRating) ? (rawRating as BehaviorRating) : null;
  const type = typeof parsed?.type === 'string' ? parsed.type : 'جديد';
  const pointsNum = typeof parsed?.points === 'number' ? parsed.points : 100;
  const points = Math.max(0, Math.min(100, Math.round(pointsNum)));
  const rating = { type, points };

  const getRatingColor = (type: string) => {
    const colors: Record<string, string> = {
      ممتاز: 'from-green-500 to-emerald-600',
      جيد: 'from-indigo-500 to-cyan-600',
      متوسط: 'from-orange-500 to-amber-600',
      ضعيف: 'from-red-500 to-pink-600',
      سيء: 'from-red-700 to-red-900',
      جديد: 'from-slate-500 to-slate-700',
    };
    return colors[type] || colors['جديد'];
  };

  const getRatingIcon = (type: string) => {
    return type === 'ممتاز' || type === 'جيد' ? (
      <TrendingUp size={14} />
    ) : type === 'جديد' ? null : (
      <TrendingDown size={14} />
    );
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            تصنيف السلوك:
          </span>
        </div>

        {/* Rating Bar */}
        <div className="flex-1 mx-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getRatingColor(rating.type)} transition-all duration-300 rounded-full flex items-center justify-end px-1 azrar-w-${rating.points}`}
            />
          </div>
          <span className="text-xs font-bold text-slate-500 min-w-[30px]">{rating.points}%</span>
        </div>

        {/* Rating Badge */}
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full bg-white dark:bg-slate-800 border-2 ${
            rating.type === 'ممتاز'
              ? 'border-green-400 text-green-600'
              : rating.type === 'جيد'
                ? 'border-indigo-400 text-indigo-600'
                : rating.type === 'متوسط'
                  ? 'border-orange-400 text-orange-600'
                  : rating.type === 'ضعيف'
                    ? 'border-red-400 text-red-600'
                    : rating.type === 'سيء'
                      ? 'border-red-600 text-red-700'
                      : 'border-slate-400 text-slate-600'
          }`}
        >
          {getRatingIcon(rating.type)}
          <span className="text-xs font-bold">{rating.type}</span>
        </div>

        {/* Status Text */}
        <div className="text-xs text-slate-500 dark:text-slate-400 ml-4 whitespace-nowrap">
          {rating.type === 'ممتاز' && '✅ دفع منتظم'}
          {rating.type === 'جيد' && '✅ موثوق'}
          {rating.type === 'متوسط' && '⚠️ متوسط'}
          {rating.type === 'ضعيف' && '❌ متخلف'}
          {rating.type === 'سيء' && '🚫 خطير'}
          {rating.type === 'جديد' && 'جديد'}
        </div>
      </div>
    </div>
  );
};

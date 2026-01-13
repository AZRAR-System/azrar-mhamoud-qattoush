import React from 'react';
import { Home, AlertOctagon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ROUTE_PATHS } from '@/routes/paths';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
      <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
        <AlertOctagon size={48} className="text-red-500" />
      </div>
      
      <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">404</h1>
      <h2 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-4">الصفحة غير موجودة</h2>
      
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
        عذراً، الرابط الذي تحاول الوصول إليه غير صحيح أو تم نقله. يرجى التأكد من العنوان أو العودة للصفحة الرئيسية.
      </p>

      <Button onClick={() => window.location.hash = ROUTE_PATHS.DASHBOARD} rightIcon={<Home size={20} />}>
        العودة للرئيسية
      </Button>
    </div>
  );
};

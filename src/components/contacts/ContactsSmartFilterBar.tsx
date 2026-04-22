import React from 'react';
import { Search, Download, MessageCircle, Users } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface ContactsSmartFilterBarProps {
  q: string;
  setQ: (val: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDownloadTemplate: () => void;
  onOpenBulkWhatsApp: () => void;
  totalCount: number;
  t: (s: string) => string;
}

export const ContactsSmartFilterBar: React.FC<ContactsSmartFilterBarProps> = ({
  q,
  setQ,
  onImport,
  onExport,
  onDownloadTemplate,
  onOpenBulkWhatsApp,
  totalCount,
  t,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onImport} leftIcon={<Download size={18} />}>
            {t('استيراد')}
          </Button>
          <Button variant="secondary" onClick={onExport} leftIcon={<Download size={18} />}>
            {t('تصدير')}
          </Button>
          <Button variant="secondary" onClick={onDownloadTemplate} leftIcon={<Download size={18} />}>
            {t('نموذج الاستيراد')}
          </Button>
          <Button
            variant="primary"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 shadow-lg shadow-indigo-500/20"
            onClick={onOpenBulkWhatsApp}
            leftIcon={<MessageCircle size={18} />}
          >
            {t('واتساب جماعي')}
          </Button>
        </div>
      }
      filters={
        <div className="relative group max-w-xl w-full">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('بحث بالاسم أو رقم الهاتف...')}
            className="pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm"
          />
        </div>
      }
      pagination={
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
          <Users size={14} className="text-indigo-500" />
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
            {totalCount.toLocaleString()} {t('جهة اتصال')}
          </span>
        </div>
      }
    />
  );
};

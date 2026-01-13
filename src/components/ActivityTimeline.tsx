
import React, { useState, useEffect } from 'react';
import { ActivityRecord } from '@/types';
import { DbService } from '@/services/mockDb';
import { Edit2, Plus, Trash2, FileText, CheckCircle, AlertOctagon, Wrench, DollarSign } from 'lucide-react';

interface ActivityTimelineProps {
  referenceId: string;
  type: 'Property' | 'Contract';
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ referenceId, type }) => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);

  useEffect(() => {
    setActivities(DbService.getActivities(referenceId, type));
  }, [referenceId, type]);

  const getIcon = (action: string) => {
    switch(action) {
      case 'إضافة': return <Plus size={14} />;
      case 'تعديل': return <Edit2 size={14} />;
      case 'حذف': return <Trash2 size={14} />;
      case 'تحديث حالة': return <CheckCircle size={14} />;
      case 'مرفقات': return <FileText size={14} />;
      case 'صيانة': return <Wrench size={14} />;
      case 'مالية': return <DollarSign size={14} />;
      default: return <AlertOctagon size={14} />;
    }
  };

  const getColor = (action: string) => {
    switch(action) {
      case 'إضافة': return 'bg-green-100 text-green-600 border-green-200';
      case 'تعديل': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      case 'حذف': return 'bg-red-100 text-red-600 border-red-200';
      case 'صيانة': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'مالية': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="relative border-r border-gray-200 dark:border-slate-700 mr-2 space-y-6">
      {activities.length === 0 && (
        <p className="text-sm text-gray-400 mr-4">لا توجد نشاطات مسجلة بعد.</p>
      )}
      
      {activities.map((act) => (
        <div key={act.id} className="relative mr-6">
          <div className={`absolute top-0 -right-[31px] w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center ${getColor(act.actionType)}`}>
            {getIcon(act.actionType)}
          </div>
          
          <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getColor(act.actionType)} bg-opacity-20 border-opacity-0`}>
                {act.actionType}
              </span>
              <span className="text-[10px] text-gray-400" dir="ltr">
                {new Date(act.date).toLocaleString('en-GB')}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-snug">
              {act.description}
            </p>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              بواسطة: {act.employee}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

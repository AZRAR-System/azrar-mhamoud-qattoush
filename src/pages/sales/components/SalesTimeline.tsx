import React from 'react';
import { FileText, GitMerge, FileSignature, CheckCircle } from 'lucide-react';

interface SalesTimelineProps {
  status: string;
}

export const SalesTimeline: React.FC<SalesTimelineProps> = ({ status }) => {
  const steps = [
    { id: 'offer', label: 'عرض', icon: FileText, completed: true },
    { id: 'negotiation', label: 'مفاوضة', icon: GitMerge, completed: status === 'Pending' || status === 'Sold' },
    { id: 'agreement', label: 'اتفاقية', icon: FileSignature, completed: status === 'Sold' },
    { id: 'closed', label: 'إغلاق', icon: CheckCircle, completed: false }
  ];

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className={`flex items-center gap-1 p-1 rounded-full text-xs ${step.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
            <step.icon size={12} />
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-0.5 w-4 ${steps[idx + 1].completed ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
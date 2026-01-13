
import React from 'react';
import { Wand2, X } from 'lucide-react';
import { SmartSuggestion } from '@/types';

interface SmartAssistantProps {
  suggestions: SmartSuggestion[];
  onAccept: (suggestions: SmartSuggestion[]) => void;
  onDismiss: () => void;
}

export const SmartAssistant: React.FC<SmartAssistantProps> = ({ suggestions, onAccept, onDismiss }) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-6 animate-slide-up relative">
      <button 
        onClick={onDismiss}
        className="absolute top-2 left-2 text-slate-400 hover:text-red-500 transition"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-200 shadow-sm">
          <Wand2 size={20} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-indigo-900 dark:text-indigo-100 text-sm flex items-center gap-2">
            المساعد الذكي (Smart Engine)
            <span className="text-[10px] bg-indigo-200 dark:bg-indigo-700 px-2 py-0.5 rounded-full text-indigo-800 dark:text-indigo-200">
                تعلم من {suggestions.length} نمط
            </span>
          </h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 mb-3">
            بناءً على إدخالاتك السابقة، يقترح النظام القيم التالية:
          </p>
          
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-900 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold">{s.field}:</span> {String(s.suggestedValue)}
                <span className="text-[9px] text-green-500 opacity-80">({Math.round(s.confidence * 100)}%)</span>
              </span>
            ))}
          </div>

          <button
            onClick={() => onAccept(suggestions)}
            className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md shadow-indigo-500/20 transition flex items-center gap-2"
          >
            <Wand2 size={14} /> تطبيق الاقتراحات
          </button>
        </div>
      </div>
    </div>
  );
};

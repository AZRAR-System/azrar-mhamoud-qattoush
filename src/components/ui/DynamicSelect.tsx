
import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, Loader2, ChevronDown } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { SystemLookup } from '@/types';
import { useToast } from '@/context/ToastContext';

interface DynamicSelectProps {
  label?: string;
  category: string; // The lookup category code (e.g., 'prop_type')
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const DynamicSelect: React.FC<DynamicSelectProps> = ({
  label,
  category,
  value,
  onChange,
  placeholder = "اختر...",
  required = false,
  className
}) => {
  const [items, setItems] = useState<SystemLookup[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadItems();
  }, [category]);

  const loadItems = () => {
    const data = DbService.getLookupsByCategory(category);
    setItems(data);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemLabel.trim()) return;

    setLoading(true);
    // Simulate slight network delay for UX
    setTimeout(() => {
        try {
            DbService.addLookup(category, newItemLabel.trim());
            toast.success(`تم إضافة "${newItemLabel}" بنجاح`);
            loadItems();
            onChange(newItemLabel.trim()); // Auto-select new item
            setNewItemLabel('');
            setIsAdding(false);
        } catch (error) {
            toast.error('حدث خطأ أثناء الإضافة');
        } finally {
            setLoading(false);
        }
    }, 500);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {!isAdding ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
                required={required}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm appearance-none cursor-pointer"
            >
                <option value="">{placeholder}</option>
                {items.map(item => (
                    <option key={item.id} value={item.label}>{item.label}</option>
                ))}
            </select>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <ChevronDown size={14} />
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
            title="إضافة عنصر جديد"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2 animate-fade-in">
            <input
                autoFocus
                type="text"
                placeholder="أدخل القيمة الجديدة..."
              className="flex-1 p-2.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-500"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem(e);
                    if (e.key === 'Escape') setIsAdding(false);
                }}
            />
            <button
                type="button"
                onClick={handleAddItem}
                disabled={loading || !newItemLabel.trim()}
                className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition shadow-sm disabled:opacity-50"
            >
                {loading ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />}
            </button>
            <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-2.5 bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition"
            >
                <X size={18} />
            </button>
        </div>
      )}
    </div>
  );
};

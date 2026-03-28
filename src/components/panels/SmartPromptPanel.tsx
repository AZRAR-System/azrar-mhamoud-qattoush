import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface SmartPromptProps {
  title: string;
  message?: string;
  inputType?: 'text' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  options?: { label: string; value: string }[]; // For select
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  validationRegex?: RegExp;
  validationError?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export const SmartPromptPanel: React.FC<SmartPromptProps> = ({
  title,
  message,
  inputType = 'text',
  options = [],
  defaultValue = '',
  placeholder,
  required = true,
  validationRegex,
  validationError,
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation Logic
    if (required && !value.trim()) {
      setError('هذا الحقل مطلوب');
      return;
    }

    if (validationRegex && !validationRegex.test(value)) {
      setError(validationError || 'القيمة المدخلة غير صحيحة');
      return;
    }

    onConfirm(value);
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col justify-center">
        {message && (
          <p className="text-slate-600 dark:text-slate-300 mb-4 text-sm leading-relaxed">
            {message}
          </p>
        )}

        <div className="space-y-2">
          {inputType === 'textarea' ? (
            <textarea
              autoFocus
              className="w-full border-2 border-gray-200 dark:border-slate-600 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none bg-white dark:bg-slate-900 dark:text-white transition-colors h-32 resize-none"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                setError('');
                setValue(e.target.value);
              }}
            />
          ) : inputType === 'select' ? (
            <select
              autoFocus
              className="w-full border-2 border-gray-200 dark:border-slate-600 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none bg-white dark:bg-slate-900 dark:text-white transition-colors appearance-none"
              value={value}
              onChange={(e) => {
                setError('');
                setValue(e.target.value);
              }}
            >
              <option value="">{placeholder || 'اختر...'}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              type={inputType}
              className="w-full border-2 border-gray-200 dark:border-slate-600 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none bg-white dark:bg-slate-900 dark:text-white transition-colors"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                setError('');
                setValue(e.target.value);
              }}
            />
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs mt-2 animate-fade-in">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
          >
            <Check size={18} /> تأكيد
          </button>
        </div>
      </form>
    </div>
  );
};

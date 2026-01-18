
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react';

interface DatePickerProps {
  label?: string;
  value: string | undefined;
  onChange: (date: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const DatePicker: React.FC<DatePickerProps> = ({ 
  label, value, onChange, required = false, placeholder = "اختر التاريخ...", className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  
  const initialDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(initialDate);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
        setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);

    const updatePopoverPosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      const popoverWidth = 288; // matches w-72
      const margin = 8;
      let left = rect.right - popoverWidth;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const top = rect.bottom + margin;

      setPopoverStyle({ top, left, width: popoverWidth });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition, { passive: true });
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = value === `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
      
      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDayClick(d)}
          className={`h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors
            ${isSelected 
              ? 'bg-indigo-600 text-white font-bold' 
              : isToday 
                ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }
          `}
        >
          {d}
        </button>
      );
    }

    return days;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="relative cursor-pointer group"
      >
        <input
          readOnly
          type="text"
          value={value || ''}
          placeholder={placeholder}
          required={required}
          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 pl-10 outline-none transition-colors cursor-pointer group-hover:border-indigo-400"
        />
        <Calendar size={18} className="absolute left-3 top-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
      </div>

      {isOpen && portalReady && typeof document !== 'undefined' && popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed layer-dropdown w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-600 p-4 animate-scale-up"
            style={{ top: popoverStyle.top, left: popoverStyle.left, width: popoverStyle.width }}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-slate-700">
              <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                <ChevronRight size={20} />
              </button>
              <span className="font-bold text-slate-800 dark:text-white">
                {MONTHS_AR[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                <ChevronLeft size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {DAYS_AR.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 dark:text-slate-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

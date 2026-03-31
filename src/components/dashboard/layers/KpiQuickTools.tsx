/**
 * أدوات سريعة في شبكة الـ KPI — آلة حاسبة وحساب عمولة تقديري
 */

import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { Calculator, Percent, TrendingUp } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { formatCurrencyJOD } from '@/utils/format';
import { ROUTE_PATHS } from '@/routes/paths';

const CALC_GRADIENT = 'from-slate-500 to-teal-600';
const CALC_TEXT = 'text-teal-600';
const CALC_BG = 'bg-teal-50 dark:bg-teal-900/20';

const COMM_GRADIENT = 'from-emerald-500 to-green-600';
const COMM_TEXT = 'text-emerald-600';
const COMM_BG = 'bg-emerald-50 dark:bg-emerald-900/20';

type Op = '+' | '-' | '*' | '/';

function applyOp(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? 0 : a / b;
    default:
      return b;
  }
}

export const KpiCalculatorCard: FC = () => {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [pending, setPending] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(false);

  const inputNum = useCallback(
    (d: string) => {
      if (d === '.' && display.includes('.')) return;
      if (fresh) {
        setDisplay(d === '.' ? '0.' : d);
        setFresh(false);
        return;
      }
      if (display === '0' && d !== '.') setDisplay(d);
      else setDisplay((prev) => prev + d);
    },
    [display, fresh]
  );

  const clearAll = useCallback(() => {
    setDisplay('0');
    setStored(null);
    setPending(null);
    setFresh(false);
  }, []);

  const pressOp = useCallback(
    (op: Op) => {
      const cur = parseFloat(display);
      if (Number.isNaN(cur)) return;
      if (stored !== null && pending && !fresh) {
        const next = applyOp(stored, cur, pending);
        setStored(next);
        setDisplay(String(next));
      } else {
        setStored(cur);
      }
      setPending(op);
      setFresh(true);
    },
    [display, stored, pending, fresh]
  );

  const pressEq = useCallback(() => {
    const cur = parseFloat(display);
    if (Number.isNaN(cur) || stored === null || !pending) return;
    const res = applyOp(stored, cur, pending);
    setDisplay(String(Number.isFinite(res) ? Math.round(res * 1e8) / 1e8 : 0));
    setStored(null);
    setPending(null);
    setFresh(true);
  }, [display, stored, pending]);

  const btns: { label: string; onClick: () => void; className?: string }[] = useMemo(
    () => [
      { label: '7', onClick: () => inputNum('7') },
      { label: '8', onClick: () => inputNum('8') },
      { label: '9', onClick: () => inputNum('9') },
      { label: '÷', onClick: () => pressOp('/'), className: 'font-black text-amber-600' },
      { label: '4', onClick: () => inputNum('4') },
      { label: '5', onClick: () => inputNum('5') },
      { label: '6', onClick: () => inputNum('6') },
      { label: '×', onClick: () => pressOp('*'), className: 'font-black text-amber-600' },
      { label: '1', onClick: () => inputNum('1') },
      { label: '2', onClick: () => inputNum('2') },
      { label: '3', onClick: () => inputNum('3') },
      { label: '−', onClick: () => pressOp('-'), className: 'font-black text-amber-600' },
      { label: '0', onClick: () => inputNum('0') },
      { label: '.', onClick: () => inputNum('.') },
      { label: 'C', onClick: clearAll, className: 'text-red-600 font-black' },
      { label: '+', onClick: () => pressOp('+'), className: 'font-black text-amber-600' },
    ],
    [inputNum, pressOp, clearAll]
  );

  return (
    <div
      className="glass-card p-4 sm:p-5 relative group h-full flex flex-col border-white/40 dark:border-slate-800/60 min-h-[280px] min-w-0 max-w-full overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
      onClick={(e) => e.stopPropagation()}
      dir="rtl"
    >
      <div
        className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${CALC_GRADIENT} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 rounded-full pointer-events-none`}
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div
            className={`p-3 rounded-2xl ${CALC_BG} shadow-inner group-hover:scale-105 transition-transform duration-500 shrink-0`}
          >
            <Calculator className={`${CALC_TEXT}`} size={22} />
          </div>
          <div className="flex flex-col items-end min-w-0 flex-1">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              آلة حاسبة سريعة
            </span>
            <div
              className="w-full min-w-0 max-w-full text-left font-mono text-sm sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate px-1 rounded-lg bg-slate-100/80 dark:bg-slate-900/50 py-1.5 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
              dir="ltr"
              title={display}
            >
              {display.length > 14
                ? (() => {
                    const n = parseFloat(display);
                    return Number.isFinite(n) ? n.toExponential(6) : display.slice(0, 12) + '…';
                  })()
                : display}
            </div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-4 gap-1.5">
          {btns.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              className={`py-2 rounded-lg text-sm bg-slate-100/90 dark:bg-slate-800/90 hover:bg-indigo-100 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-100 transition-colors ${b.className ?? ''}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={pressEq}
          className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 text-white text-sm font-black shadow-md hover:opacity-95"
        >
          =
        </button>

        <div className="mt-3 pt-3 border-t border-slate-100/50 dark:border-slate-800/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 min-w-0">
            <TrendingUp size={12} className={`${CALC_TEXT} shrink-0`} />
            <span className="leading-snug">عمليات أساسية — لا تُحفظ</span>
          </div>
          <div
            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${CALC_GRADIENT} animate-pulse shrink-0`}
          />
        </div>
      </div>
    </div>
  );
};

export const KpiQuickCommissionCard: FC = () => {
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('2');

  useEffect(() => {
    try {
      const s = DbService.getSettings();
      const p = Number(s.salesCommissionPercent);
      if (Number.isFinite(p) && p >= 0) setPercent(String(p));
    } catch {
      void 0;
    }
  }, []);

  const amountNum = parseFloat(amount.replace(/,/g, ''));
  const pctNum = parseFloat(percent.replace(/,/g, ''));
  const commission = useMemo(() => {
    if (!Number.isFinite(amountNum) || !Number.isFinite(pctNum)) return null;
    const raw = (amountNum * pctNum) / 100;
    if (!Number.isFinite(raw) || Math.abs(raw) > 1e12) return null;
    return raw;
  }, [amountNum, pctNum]);

  const goCommissions = () => {
    window.location.hash = ROUTE_PATHS.COMMISSIONS;
  };

  return (
    <div
      className="glass-card p-4 sm:p-5 relative group h-full flex flex-col border-white/40 dark:border-slate-800/60 min-h-[280px] min-w-0 max-w-full overflow-hidden cursor-default transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
      onClick={(e) => e.stopPropagation()}
      dir="rtl"
    >
      <div
        className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${COMM_GRADIENT} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 rounded-full pointer-events-none`}
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between mb-4 gap-2">
          <div
            className={`p-3 rounded-2xl ${COMM_BG} shadow-inner group-hover:scale-105 transition-transform duration-500 shrink-0`}
          >
            <Percent className={`${COMM_TEXT}`} size={22} />
          </div>
          <div className="flex flex-col items-end flex-1 min-w-0">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              عمولة سريعة (تقدير)
            </span>
            <div
              className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate w-full text-left"
              dir="ltr"
              title={commission !== null ? formatCurrencyJOD(commission) : undefined}
            >
              {commission !== null ? formatCurrencyJOD(commission) : '—'}
            </div>
          </div>
        </div>

        <div className="space-y-3 flex-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">
              قيمة الصفقة (د.أ.)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 150000"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-900/40 text-sm font-bold text-right text-slate-900 dark:text-white"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">
              نسبة العمولة (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="2"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-900/40 text-sm font-bold text-right text-slate-900 dark:text-white"
              dir="ltr"
            />
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100/50 dark:border-slate-800/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 min-w-0">
            <TrendingUp size={12} className={`${COMM_TEXT} shrink-0`} />
            <button
              type="button"
              onClick={goCommissions}
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-right"
            >
              فتح سجل العمولات
            </button>
          </div>
          <div
            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${COMM_GRADIENT} animate-pulse shrink-0`}
          />
        </div>
      </div>
    </div>
  );
};

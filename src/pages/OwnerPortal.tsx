/**
 * لوحة تحكم المالك
 * صفحة خاصة بمالكي العقارات لعرض بياناتهم
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { getOwnerReport, exportOwnerReportPdf } from '@/services/ownerReport';
import { getPeopleByRole } from '@/services/db/people';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import {
  Home,
  FileText,
  BarChart3,
  Receipt,
  Search,
  User,
  Building2,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  CalendarDays,
  Loader2,
  Printer,
  Download,
  Smartphone,
  ShieldCheck,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import type { OwnerReportData } from '@/services/ownerReport';
import type { الأشخاص_tbl } from '@/types';

// دالة تحسين البحث
const normalizeSearchTerm = (str: string): string => {
  if (!str) return '';
  return String(str)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, '')
    .replace(/[يىئ]/g, 'ي')
    .replace(/[ؤو]/g, 'و')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\s\-_.,]/g, '')
    .toLowerCase()
    .trim();
};

const tabs = [
  { id: 'properties', label: 'عقاراتي',    icon: Home     },
  { id: 'contracts',  label: 'عقودي',       icon: FileText  },
  { id: 'revenue',    label: 'إيراداتي',    icon: BarChart3 },
  { id: 'statement',  label: 'كشف الحساب', icon: Receipt   },
] as const;

type TabId = (typeof tabs)[number]['id'];

/* ────────── بطاقة الملخص ────────── */
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'emerald' | 'amber' | 'indigo' | 'rose' | 'blue';
}) {
  const colorMap = {
    emerald: {
      bg:    'bg-emerald-50  dark:bg-emerald-900/20',
      border:'border-emerald-100 dark:border-emerald-800/40',
      icon:  'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-300',
      value: 'text-emerald-700 dark:text-emerald-300',
      label: 'text-emerald-600/80 dark:text-emerald-400/80',
    },
    amber: {
      bg:    'bg-amber-50   dark:bg-amber-900/20',
      border:'border-amber-100  dark:border-amber-800/40',
      icon:  'bg-amber-100  dark:bg-amber-800/40  text-amber-600  dark:text-amber-300',
      value: 'text-amber-700  dark:text-amber-300',
      label: 'text-amber-600/80  dark:text-amber-400/80',
    },
    indigo: {
      bg:    'bg-indigo-50  dark:bg-indigo-900/20',
      border:'border-indigo-100 dark:border-indigo-800/40',
      icon:  'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-600 dark:text-indigo-300',
      value: 'text-indigo-700 dark:text-indigo-300',
      label: 'text-indigo-600/80 dark:text-indigo-400/80',
    },
    rose: {
      bg:    'bg-rose-50    dark:bg-rose-900/20',
      border:'border-rose-100   dark:border-rose-800/40',
      icon:  'bg-rose-100   dark:bg-rose-800/40   text-rose-600   dark:text-rose-300',
      value: 'text-rose-700   dark:text-rose-300',
      label: 'text-rose-600/80   dark:text-rose-400/80',
    },
    blue: {
      bg:    'bg-blue-50    dark:bg-blue-900/20',
      border:'border-blue-100   dark:border-blue-800/40',
      icon:  'bg-blue-100   dark:bg-blue-800/40   text-blue-600   dark:text-blue-300',
      value: 'text-blue-700   dark:text-blue-300',
      label: 'text-blue-600/80   dark:text-blue-400/80',
    },
  } as const;

  const c = colorMap[color];
  return (
    <div className={`app-card p-6 flex flex-col justify-between border-b-4 ${c.bg} ${c.border} hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-4">
        <span className={`text-[10px] font-black uppercase tracking-widest ${c.label}`}>{label}</span>
        <div className={`p-2 rounded-xl shadow-sm ${c.icon}`}>
          <Icon size={20} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-black tabular-nums truncate ${c.value}`}>{value}</p>
      </div>
    </div>
  );
}

/* ────────── الصفحة الرئيسية ────────── */
export function OwnerPortal() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab]         = useState<TabId>('properties');
  const [report, setReport]               = useState<OwnerReportData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [filterContractId, setFilterContractId] = useState<string | null>(null);
  const [owners, setOwners]               = useState<الأشخاص_tbl[]>([]);
  const [searchTerm, setSearchTerm]       = useState('');

  useEffect(() => {
    const ownersList = getPeopleByRole('مالك');
    setOwners(ownersList);
    if (ownersList.length > 0 && !selectedOwnerId) {
      setSelectedOwnerId(ownersList[0].رقم_الشخص);
    } else if (ownersList.length === 0) {
      setLoading(false);
    }
  }, []);

  const filteredOwners = useMemo(() => {
    if (!searchTerm.trim()) return owners;
    const n = normalizeSearchTerm(searchTerm);
    return owners.filter(o =>
      normalizeSearchTerm(o.الاسم).includes(n) ||
      normalizeSearchTerm(o.الرقم_الوطني || '').includes(n) ||
      normalizeSearchTerm(o.رقم_الهاتف || '').includes(n)
    );
  }, [owners, searchTerm]);

  useEffect(() => {
    if (selectedOwnerId) {
      setLoading(true);
      try {
        const data = getOwnerReport(selectedOwnerId, filterContractId || undefined);
        setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  }, [selectedOwnerId, filterContractId]);

  const handleExportPdf = async () => {
    if (!selectedOwnerId) return;
    toast.info('جاري توليد تقرير PDF...', 'التقارير');
    try {
      const path = await exportOwnerReportPdf(selectedOwnerId, filterContractId || undefined);
      if (path) {
        toast.success(`تم حفظ التقرير في: ${path}`, 'اكتمل التصدير');
      } else {
        toast.error('فشل تصدير التقرير', 'خطأ');
      }
    } catch (error) {
      toast.error('خطأ أثناء التصدير', 'خطأ');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!user) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-500">
          <Loader2 size={48} className="animate-spin text-indigo-500" />
          <p className="text-sm font-bold">جارٍ تحميل البيانات الاستخباراتية…</p>
        </div>
      </div>
    );
  }

  if (owners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <User size={48} className="text-slate-300 dark:text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-slate-700 dark:text-slate-200">لا يوجد مالكون</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">أضف أشخاصاً بدور «مالك» أولاً</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={48} className="text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400 font-bold">لا يوجد بيانات لعرضها لهذا المالك</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 page-transition" dir="rtl">

      {/* ── رأس الصفحة الاحترافي ── */}
      <div className="app-card overflow-hidden !p-0 shadow-lg border-slate-200/60 dark:border-slate-700/50">
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 p-8 text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden text-white/20">
            <Building2 size={240} className="absolute -top-12 -left-12 rotate-12" />
          </div>

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
                <User size={40} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight mb-2">لوحة المالك الذكية</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm font-bold">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> {report.owner.الاسم}</span>
                  {report.owner.الرقم_الوطني && (
                    <span className="flex items-center gap-1.5 opacity-70"><FileSpreadsheet size={14} /> {report.owner.الرقم_الوطني}</span>
                  )}
                  {report.owner.رقم_الهاتف && (
                    <span className="flex items-center gap-1.5 opacity-70"><Smartphone size={14} /> {report.owner.رقم_الهاتف}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-black text-xs transition-all border border-white/10"
              >
                <Printer size={16} /> طباعة
              </button>
              <button 
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-xs transition-all shadow-xl shadow-indigo-900/20"
              >
                <Download size={16} /> تصدير PDF
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن مالك آخر..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
            />
          </div>
          <select
            value={selectedOwnerId || ''}
            onChange={e => {
              setSelectedOwnerId(e.target.value);
              setFilterContractId(null);
            }}
            className="w-full lg:w-72 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            {filteredOwners.map(o => (
              <option key={o.رقم_الشخص} value={o.رقم_الشخص}>{o.الاسم}</option>
            ))}
          </select>
          <div className="shrink-0 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 border-r border-slate-200 dark:border-slate-700 h-8">
            <Clock size={12} /> تحديث: {report.generatedAt}
          </div>
        </div>

        {/* ── شريط التصفية حسب العقد ── */}
        <div className="bg-white dark:bg-slate-800/80 p-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-3 overflow-x-auto no-scrollbar">
           <div className="flex items-center gap-2 shrink-0 ml-4 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
              <Filter size={14} /> تصفية العقد:
           </div>
           <button
              onClick={() => setFilterContractId(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
                filterContractId === null 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                  : 'bg-slate-50 dark:bg-slate-900/40 text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700'
              }`}
            >
              كافة العقود
            </button>

            {/* نجلب قائمة كل العقود للمالك الحالي (بدون فلترة) لعرض خيارات الفلترة */}
            {getOwnerReport(selectedOwnerId || '')?.activeContracts.map(c => (
              <button
                key={c.رقم_العقد}
                onClick={() => setFilterContractId(c.رقم_العقد)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
                  filterContractId === c.رقم_العقد 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'bg-slate-50 dark:bg-slate-900/40 text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700'
                }`}
              >
                {c.tenantName} - {c.internalCode}
              </button>
            ))}
        </div>
      </div>

      {/* ── بطاقات KPI العلمية ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
          label="صافي التحصيل المستحق" 
          value={formatCurrencyJOD(report.netOwnerAmount)} 
          icon={TrendingUp} 
          color="indigo" 
        />
        
        <div className="app-card p-6 flex flex-col justify-between border-b-4 border-emerald-500 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">كفاءة التحصيل</span>
            <div className={`p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm`}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black tabular-nums text-slate-800 dark:text-white">{report.collectionEfficiency.toFixed(1)}%</div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                style={{ width: `${report.collectionEfficiency}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="app-card p-6 flex flex-col justify-between border-b-4 border-blue-500 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">معدل الإشغال</span>
            <div className={`p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm`}>
              <Building2 size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black tabular-nums text-slate-800 dark:text-white">{report.occupancyRate.toFixed(1)}%</div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                style={{ width: `${report.occupancyRate}%` }} 
              />
            </div>
          </div>
        </div>

        <StatCard 
          label="المبالغ المتأخرة" 
          value={formatCurrencyJOD(report.pendingAmount)} 
          icon={Clock} 
          color="rose" 
        />
      </div>

      {/* ── التبويبات ── */}
      <div className="app-card overflow-hidden !p-0">
        <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2.5 px-8 py-5 text-sm font-black whitespace-nowrap
                  transition-all duration-300 border-b-2 relative
                  ${active
                    ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-slate-900/60 shadow-[inset_0_-2px_0_rgba(79,70,229,1)]'
                    : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'}
                `}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-8">

          {/* عقاراتي */}
          {activeTab === 'properties' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">قائمة العقار والوحدات</h3>
                <div className="text-xs font-black text-slate-400 flex items-center gap-2">
                  اكتشاف التلقائي <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              {report.properties.length === 0 ? (
                <div className="app-table-empty">
                  <Building2 size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-700/50" />
                  <p className="text-sm font-black text-slate-400">لا توجد أصول عقارية مسجلة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.properties.map(p => {
                    const statusStyle =
                      p.حالة_العقار === 'مؤجر'  ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50' :
                      p.حالة_العقار === 'شاغر'  ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50' :
                                                   'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50';
                    return (
                      <div
                        key={p.رقم_العقار}
                        className="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 hover:shadow-xl transition-all group relative overflow-hidden"
                      >
                         <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                        
                        <div className="flex justify-between items-start mb-4 relative">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Home size={22} />
                          </div>
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-wider shadow-sm ${statusStyle}`}>
                            {p.حالة_العقار || 'مجهول'}
                          </span>
                        </div>
                        
                        <div className="relative">
                          <p className="text-base font-black text-slate-800 dark:text-white mb-1">{p.الكود_الداخلي || p.رقم_العقار}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">{p.العنوان || 'لا يوجد تفاصيل للعنوان'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* عقودي */}
          {activeTab === 'contracts' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">إدارة العقود التشغيلية</h3>
                <span className="text-xs font-black px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{report.activeContracts.length} عقد نشط</span>
              </div>

              {report.activeContracts.length === 0 ? (
                <div className="app-table-empty py-16">
                  <FileText size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-700/50" />
                  <p className="text-sm font-black text-slate-400">لا توجد عقود تشغيلية فعالة حالياً</p>
                </div>
              ) : (
                <div className="app-table-wrapper !rounded-3xl border border-slate-100 dark:border-slate-800 shadow-none overflow-hidden">
                  <table className="app-table">
                    <thead className="app-table-thead">
                      <tr>
                        <th className="app-table-th">كود العقار</th>
                        <th className="app-table-th">المستأجر</th>
                        <th className="app-table-th">الفترة الزمنية</th>
                        <th className="app-table-th text-center">التشغيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                      {report.activeContracts.map(c => (
                        <tr key={c.رقم_العقد} className="app-table-row group">
                          <td className="app-table-td">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">#</div>
                               <span className="font-black text-slate-800 dark:text-white uppercase">{c.internalCode}</span>
                            </div>
                          </td>
                          <td className="app-table-td">
                            <div className="flex flex-col">
                              <span className="text-slate-800 dark:text-white font-black text-sm">{c.tenantName}</span>
                              <span className="text-[10px] text-slate-400 font-bold">عقد #{c.رقم_العقد}</span>
                            </div>
                          </td>
                          <td className="app-table-td">
                            <div className="flex flex-col gap-0.5">
                               <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                  <span className="opacity-40" dir="ltr">{c.تاريخ_البداية}</span>
                                  <ChevronLeft size={10} />
                                  <span className="text-rose-500" dir="ltr">{c.تاريخ_النهاية}</span>
                               </div>
                            </div>
                          </td>
                          <td className="app-table-td text-center">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              قيد التشغيل
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* إيراداتي */}
          {activeTab === 'revenue' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">ذكاء الأعمال والتحصيل</h3>
              </div>

              {Object.keys(report.byMonth).length === 0 ? (
                <div className="app-table-empty">
                  <BarChart3 size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-700/50" />
                  <p className="text-sm font-black text-slate-400">لا توجد بيانات مالية تاريخية كافية</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                      <TrendingUp size={16} className="text-indigo-500" /> كشف التوقعات والتحصيل الفعلي
                    </h4>
                    <div className="space-y-6">
                      {Object.entries(report.byMonth)
                        .sort()
                        .reverse()
                        .slice(0, 8)
                        .map(([month, data]) => {
                          const max = Math.max(...Object.values(report.byMonth).map(m => m.expected), 1);
                          const collectedPct = (data.collected / max) * 100;
                          const expectedPct = (data.expected / max) * 100;
                          return (
                            <div key={month} className="space-y-2 group">
                              <div className="flex justify-between items-end px-1">
                                <span className="text-xs font-black text-slate-500 tabular-nums uppercase" dir="ltr">{month}</span>
                                <div className="text-right">
                                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatCurrencyJOD(data.collected)}</span>
                                  <span className="text-[10px] font-bold text-slate-400 mx-2">/</span>
                                  <span className="text-xs font-bold text-slate-400 tabular-nums">{formatCurrencyJOD(data.expected)}</span>
                                </div>
                              </div>
                              <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl relative overflow-hidden flex flex-row-reverse border border-slate-200/40 dark:border-slate-700/30 shadow-inner">
                                <div 
                                  className="h-full bg-indigo-500/20 dark:bg-indigo-400/10 absolute right-0 top-0 transition-all duration-700"
                                  style={{ width: `${expectedPct}%` }}
                                />
                                <div 
                                  className={`h-full bg-gradient-to-l from-emerald-600 to-emerald-400 dark:from-emerald-500 dark:to-emerald-400 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000 delay-100 relative z-10`}
                                  style={{ width: `${collectedPct}%` }}
                                >
                                  <div className="absolute inset-0 bg-white/10" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                      <Wallet size={16} className="text-emerald-500" /> ملخص الربحية الصافية شهرياً
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(report.byMonth).sort().reverse().slice(0, 7).map(([month, data]) => (
                        <div key={`net-${month}`} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 hover:border-emerald-500/30 transition-all">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tabular-nums" dir="ltr">{month}</span>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-200">الصافي لمالك</div>
                          </div>
                          <div className="text-left">
                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none mb-1">{formatCurrencyJOD(data.net)}</div>
                            <div className="text-[9px] font-black text-slate-400/80 uppercase">بعد خصم العمولات</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 mt-6 group">
                       <h5 className="text-xs font-black text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-2">
                          <AlertCircle size={14} /> توضيح التحويل المالي
                       </h5>
                       <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 font-bold leading-relaxed">
                          يتم احتساب "الصافي المحول" بناءً على المبالغ المحصلة فعلياً من المستأجرين مطروحاً منها عمولة إدارة العقار المتفق عليها في النظام.
                       </p>
                       <div className="mt-4 pt-3 border-t border-indigo-200/40 dark:border-indigo-700/40 flex justify-between items-center text-[10px] font-black uppercase text-indigo-500">
                          <span>المجمل</span>
                          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                          <span>الصافي</span>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* كشف الحساب */}
          {activeTab === 'statement' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">سجل الدفعات التفصيلي</h3>
                <div className="text-[10px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-800/50">
                   عجز التحصيل: {formatCurrencyJOD(report.pendingAmount)}
                </div>
              </div>

              {report.installments.length === 0 ? (
                <div className="app-table-empty">
                  <Receipt size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-700/50" />
                  <p className="text-sm font-black text-slate-400">لم يتم تسجيل أي عمليات مالية لهذا المشتري</p>
                </div>
              ) : (
                <div className="app-table-wrapper !rounded-3xl border border-slate-100 dark:border-slate-800 shadow-none overflow-hidden">
                  <table className="app-table">
                    <thead className="app-table-thead">
                      <tr>
                        <th className="app-table-th">تاريخ الاستحقاق</th>
                        <th className="app-table-th">المستأجر</th>
                        <th className="app-table-th">العقار</th>
                        <th className="app-table-th">الإجمالي</th>
                        <th className="app-table-th text-center">الصافي</th>
                        <th className="app-table-th text-center">الوضعية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                      {report.installments.slice(0, 40).map(i => (
                        <tr key={i.رقم_الكمبيالة} className="app-table-row group">
                          <td className="app-table-td font-mono text-xs font-black text-slate-500 tabular-nums" dir="ltr">
                            {i.تاريخ_استحقاق}
                          </td>
                          <td className="app-table-td">
                            <span className="font-black text-slate-700 dark:text-slate-300 text-xs">
                              {i.tenantName}
                            </span>
                          </td>
                          <td className="app-table-td">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                              {i.propertyInternalCode}
                            </span>
                          </td>
                          <td className="app-table-td">
                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrencyJOD(i.القيمة)}
                            </span>
                          </td>
                          <td className="app-table-td text-center">
                            <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrencyJOD(i.net)}
                            </span>
                          </td>
                          <td className="app-table-td text-center">
                            {i.isPaid ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                <CheckCircle2 size={11} />
                                مدفوع
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800/50 shadow-sm animate-pulse-subtle">
                                <Clock size={11} />
                                معلق
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.installments.length > 40 && (
                    <div className="p-5 text-center bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-black text-slate-400 flex items-center justify-center gap-2">
                        <ChevronLeft size={16} />
                         عرض موجز لأول 40 عملية من أصل {report.installments.length}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
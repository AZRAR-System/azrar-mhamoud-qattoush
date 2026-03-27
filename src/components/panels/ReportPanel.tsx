
import React, { useMemo, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { ReportResult } from '@/types';
import { Printer, Download, Search, FileText, Filter, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { formatCurrencyJOD, formatDateYMD, formatNumber } from '@/utils/format';
import { exportToXlsx } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { runReportSmart } from '@/services/reporting';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';
import { StatusBadge } from '@/components/ui/StatusBadge';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

export const ReportPanel: React.FC<{ id: string }> = ({ id }) => {
  const [report, setReport] = useState<ReportResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const toast = useToast();

  const isEmployeeCommissions = id === 'employee_commissions';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      (async () => {
        try {
          const result = await runReportSmart(id);
          if (cancelled) return;
          setReport(result);
        } catch {
          if (cancelled) return;
          setReport(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [id]);

  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'report', entityId: id });
    toast.success('✅ جاري الطباعة...');
  };

  const handlePrintToPDF = () => {
    // استخدام وظيفة الطباعة المدمجة في المتصفح لحفظ PDF
    toast.info('💡 اختر "حفظ كـ PDF" من نافذة الطباعة');
    setTimeout(() => {
      void printCurrentViewUnified({ documentType: 'report', entityId: id });
    }, 500);
  };

  const handleExportExcel = async () => {
    if (!report) return;

    try {
      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
      const safeTitle = String(report.title || 'report').replace(/[\\/:*?"<>|]/g, '_').trim();
      type ExportRow = Record<string, unknown>;
      const rows: ExportRow[] = (report.data || []).map((r) => {
        const rowObj: UnknownRecord = isRecord(r) ? r : {};
        const obj: ExportRow = {};
        for (const c of report.columns) obj[c.header] = rowObj[c.key];
        return obj;
      });

      await exportToXlsx(
        'Report',
        report.columns.map((c) => ({ key: c.header, header: c.header })),
        rows,
        `${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        {
          extraSheets: companySheet ? [companySheet] : [],
        }
      );

      toast.success('✅ تم تصدير التقرير إلى Excel بنجاح');
    } catch {
      toast.error('❌ فشل في تصدير التقرير');
    }
  };

  const employeeOptions = useMemo(() => {
    // Must run on every render (React error #310 prevention)
    if (!isEmployeeCommissions || !report) return [] as Array<{ value: string; label: string }>;
    const rows = Array.isArray(report.data) ? report.data : [];
    const byUsername = new Map<string, string>();
    for (const r of rows) {
      if (!isRecord(r)) continue;
      const username = String(r.employeeUsername || '').trim();
      const display = String(r.employee || '').trim();
      if (!username) continue;
      if (!byUsername.has(username)) byUsername.set(username, display || username);
    }
    return Array.from(byUsername.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [isEmployeeCommissions, report]);

  const monthOptions = useMemo(() => {
    // Must run on every render (React error #310 prevention)
    if (!isEmployeeCommissions || !report) return [] as Array<{ value: string; label: string }>;
    const rows = Array.isArray(report.data) ? report.data : [];
    const months = new Set<string>();
    for (const r of rows) {
      if (!isRecord(r)) continue;
      const d = String(r.date || '').trim();
      if (/^\d{4}-\d{2}/.test(d)) months.add(d.slice(0, 7));
    }
    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((m) => ({ value: m, label: m }));
  }, [isEmployeeCommissions, report]);

  if (loading) return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">جاري معالجة البيانات وبناء التقرير...</p>
      </div>
  );

  if (!report) return <div className="p-10 text-center text-red-500">فشل تحميل التقرير</div>;

  const filteredData = (report.data || []).filter((row: unknown) => {
    const rowObj = isRecord(row) ? row : null;
    if (isEmployeeCommissions) {
      if (employeeFilter) {
        const u = String(rowObj?.employeeUsername || '').trim();
        if (u !== employeeFilter) return false;
      }
      if (monthFilter) {
        const d = String(rowObj?.date || '').trim();
        const m = /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : '';
        if (m !== monthFilter) return false;
      }
    }

    if (!searchTerm) return true;
    const rowString = rowObj ? Object.values(rowObj).join(' ').toLowerCase() : String(row || '').toLowerCase();
    return rowString.includes(searchTerm.toLowerCase());
  });

  const getRowValue = (row: unknown, key: string): unknown => {
    if (!isRecord(row)) return undefined;
    return row[key];
  };

  const renderCellValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  return (
    <div className="space-y-6 h-full flex flex-col report-print" dir="rtl">
      {/* Header */}
      <div className="app-card p-6 flex flex-col gap-4 print:shadow-none print:border-none">
        <PrintLetterhead className="hidden print:block" />
         <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
                  <FileText size={28} />
               </div>
               <div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{report.title}</h1>
                <p className="text-xs text-slate-400 mt-1">تم الإنشاء: {formatDateYMD(report.generatedAt)}</p>
               </div>
            </div>
            
            <div className="flex gap-2 print:hidden">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition text-sm font-bold border border-emerald-200 dark:border-emerald-800 shadow-sm"
                  title="تصدير إلى ملف Excel (CSV)"
                >
                    <FileSpreadsheet size={16} /> Excel
                </button>
                <RBACGuard requiredPermission="PRINT_EXECUTE">
                  <button
                    onClick={handlePrintToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm font-bold border border-red-200 dark:border-red-800 shadow-sm"
                    title="حفظ كملف PDF"
                  >
                      <Download size={16} /> PDF
                  </button>
                </RBACGuard>
                <RBACGuard requiredPermission="PRINT_EXECUTE">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-sm font-bold border border-indigo-200 dark:border-indigo-800 shadow-sm"
                    title="طباعة مباشرة"
                  >
                      <Printer size={16} /> طباعة
                  </button>
                </RBACGuard>
            </div>
         </div>

         {/* Toolbar */}
         <div className="flex gap-4 print:hidden">
             <div className="relative flex-1">
                 <input 
                    type="text" 
                    placeholder="بحث في النتائج..." 
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
                 <Search className="absolute right-3 top-3 text-gray-400" size={16} />
             </div>

             {isEmployeeCommissions && (
               <>
                 <select
                   value={employeeFilter}
                   onChange={(e) => setEmployeeFilter(e.target.value)}
                   className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none min-w-[170px]"
                   title="فلترة حسب الموظف"
                 >
                   <option value="">كل الموظفين</option>
                   {employeeOptions.map((o) => (
                     <option key={o.value} value={o.value}>{o.label}</option>
                   ))}
                 </select>

                 <select
                   value={monthFilter}
                   onChange={(e) => setMonthFilter(e.target.value)}
                   className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none min-w-[135px]"
                   title="فلترة حسب الشهر (YYYY-MM)"
                 >
                   <option value="">كل الشهور</option>
                   {monthOptions.map((o) => (
                     <option key={o.value} value={o.value}>{o.label}</option>
                   ))}
                 </select>
               </>
             )}

             <button
               type="button"
               className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800"
               aria-label="خيارات التصفية"
               title="خيارات التصفية"
             >
                 <Filter size={18} />
             </button>
         </div>
      </div>

      {/* Table Area */}
      <div className="app-table-wrapper flex-1 flex flex-col print:border-none print:shadow-none print:overflow-visible bg-white/50 dark:bg-slate-900/50">
         <div className="overflow-auto no-scrollbar flex-1 print:overflow-visible">
            <table className="app-table">
               <thead className="app-table-thead sticky top-0 z-10 print:bg-slate-50 print:static print:top-auto print:z-auto">
                  <tr>
                     {report.columns.map(col => (
                       <th key={col.key} className="app-table-th whitespace-normal break-words">{col.header}</th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {filteredData.map((row, idx) => (
                      <tr key={idx} className="app-table-row app-table-row-striped group">
                          {report.columns.map(col => (
                          <td key={col.key} className="app-table-td whitespace-pre-wrap break-words">
                            {col.type === 'currency' ? (
                              <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg border border-indigo-100/30 dark:border-indigo-800/30">
                                {formatCurrencyJOD(getRowValue(row, col.key), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            ) : col.type === 'date' ? (
                              <span className="font-bold text-slate-600 dark:text-slate-300">{formatDateYMD(getRowValue(row, col.key))}</span>
                            ) : col.type === 'number' ? (
                              <span className="font-black text-slate-700 dark:text-slate-200">{formatNumber(getRowValue(row, col.key))}</span>
                                  ) : col.type === 'status' ? (
                                      <StatusBadge status={String(renderCellValue(getRowValue(row, col.key)))} className="!text-[10px] !px-2.5 !py-1 !font-black" />
                                  ) : (
                                  <span className="font-medium">{renderCellValue(getRowValue(row, col.key))}</span>
                                  )}
                              </td>
                          ))}
                      </tr>
                  ))}
                  {filteredData.length === 0 && (
                      <tr>
                          <td colSpan={report.columns.length} className="app-table-empty py-20">
                              <Search className="mx-auto mb-4 text-slate-200 dark:text-slate-800" size={64} />
                              <div className="text-slate-400 font-black uppercase tracking-widest">لا توجد نتائج مطابقة</div>
                          </td>
                      </tr>
                  )}
               </tbody>
            </table>
         </div>
         
         {/* Footer Summary */}
         {report.summary && report.summary.length > 0 && (
             <div className="p-8 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-10 overflow-x-auto print:bg-slate-50">
                 {report.summary.map((stat, idx) => (
                     <div key={idx} className="flex flex-col min-w-[120px]">
                         <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{stat.label}</span>
                         <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                            {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                         </span>
                     </div>
                 ))}
             </div>
         )}
      </div>
    </div>
  );
};

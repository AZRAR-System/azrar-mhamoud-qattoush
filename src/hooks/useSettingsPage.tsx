import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { useSmartModal } from '@/context/ModalContext';
import { storage } from '@/services/storage';
import { useAuth } from '@/context/AuthContext';
import {
  SystemLookup,
  LookupCategory,
  SystemSettings,
  PermissionCode,
  العمليات_tbl,
} from '@/types';
import {
  Database,
  Building,
  List,
  Upload,
  Globe,
  Phone,
  Bell,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  FolderOpen,
  ArrowRight,
  RefreshCcw,
  Edit2,
  BadgeDollarSign,
  History,
  FileJson,
  Shield,
  FileSpreadsheet,
  Info,
  PlayCircle,
  AlertTriangle,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { isRole, isSuperAdmin } from '@/utils/roles';
import { DS } from '@/constants/designSystem';
import { ROUTE_PATHS } from '@/routes/paths';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getErrorMessage } from '@/utils/errors';
import { exportToXlsx } from '@/utils/xlsx';
import { CONTRACT_WORD_TEMPLATE_VARIABLES } from '@/constants/contractWordTemplateVariables';
import { getPrintingQaSampleData } from '@/services/printing/qaSamples';
import { exportDocxUnified, generateTemplateUnified } from '@/services/printing/unifiedPrint';
import { Select } from '@/components/ui/Select';
import { GEO_COUNTRIES, GEO_CURRENCIES } from '@/constants/geo';
import { getCurrencySuffix } from '@/services/moneySettings';
import {
  type AppLastError,
  type AppErrorLogEntry,
  type BackupEncryptionStatus,
  type DesktopSuccessMessage,
  type LocalBackupAutomationSettings,
  type LocalBackupLogEntry,
  type LocalBackupStats,
  type WordTemplateType,
} from '@/components/settings/settingsTypes';
import { getWordTemplatePreviewBodyHtml } from '@/components/settings/wordTemplatePrintPreviewBody';
import {
  applyPlaceholderGuideToDocx,
  getPlaceholderGuideLines,
} from '@/utils/wordTemplatePlaceholderDocx';
export type UseSettingsPageProps = {
  initialSection?: string;
  serverOnly?: boolean;
  embedded?: boolean;
};

export function useSettingsPage({ initialSection, serverOnly, embedded }: UseSettingsPageProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>(
    serverOnly ? 'server' : initialSection || 'general'
  );
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const { user } = useAuth();

  const dbSignal = useDbSignal();

  const isDesktop = !!window.desktopDb;
  const [backupDir, setBackupDir] = useState<string>('');

  const handleChooseBackupDir = async () => {
    if (!window.desktopDb?.chooseDirectory) return;
    try {
      const res = (await window.desktopDb.chooseDirectory()) as {
        success?: boolean;
        path?: string;
      } | null;
      if (res?.success && res.path) {
        setBackupDir(res.path);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل اختيار مجلد النسخ الاحتياطي');
    }
  };

  const [backupEncAvailable, setBackupEncAvailable] = useState<boolean>(false);
  const [backupEncEnabled, setBackupEncEnabled] = useState<boolean>(false);
  const [backupEncHasPassword, setBackupEncHasPassword] = useState<boolean>(false);
  const [backupEncPassword, setBackupEncPassword] = useState<string>('');
  const [backupEncBusy, setBackupEncBusy] = useState<boolean>(false);

  const [localBackupEnabled, setLocalBackupEnabled] = useState<boolean>(false);
  const [localBackupTime, setLocalBackupTime] = useState<string>('02:00');
  const [localBackupRetentionDays, setLocalBackupRetentionDays] = useState<number>(30);
  const [localBackupLastRunAt, setLocalBackupLastRunAt] = useState<string>('');
  const [localBackupBusy, setLocalBackupBusy] = useState<boolean>(false);
  const [localBackupStats, setLocalBackupStats] = useState<LocalBackupStats | null>(null);
  const [localBackupLog, setLocalBackupLog] = useState<LocalBackupLogEntry[]>([]);
  const [localBackupLogBusy, setLocalBackupLogBusy] = useState<boolean>(false);

  const formatBytes = (bytes: number) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const computeNextRunAt = (enabled: boolean, timeHHmm: string, lastRunAtISO: string) => {
    if (!enabled) return '';
    const timeStr = String(timeHHmm || '02:00');
    const m = /^([0-2]\d):([0-5]\d)$/.exec(timeStr);
    if (!m) return '';
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return '';

    const now = new Date();
    const due = new Date(now);
    due.setHours(hh, mm, 0, 0);

    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const last = lastRunAtISO ? new Date(lastRunAtISO) : null;
    const lastYMD = last && Number.isFinite(last.getTime()) ? ymd(last) : '';
    const today = ymd(now);

    if (lastYMD === today) {
      // already ran today => next is tomorrow at due time
      const next = new Date(due);
      next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    if (now.getTime() < due.getTime()) {
      return due.toISOString();
    }
    const next = new Date(due);
    next.setDate(next.getDate() + 1);
    return next.toISOString();
  };

  const [wordTemplates, setWordTemplates] = useState<string[]>([]);
  const [wordTemplateKvKeysByName, setWordTemplateKvKeysByName] = useState<Record<string, string>>(
    {}
  );
  const [wordTemplatesBusy, setWordTemplatesBusy] = useState(false);
  const [wordTemplateImportBusy, setWordTemplateImportBusy] = useState(false);
  const [activeWordTemplateType, setActiveWordTemplateType] =
    useState<WordTemplateType>('contracts');
  const [wordTemplatesDir, setWordTemplatesDir] = useState<string>('');

  const [isWordTemplatePreviewOpen, setIsWordTemplatePreviewOpen] = useState(false);
  const [wordTemplateExportBusyName, setWordTemplateExportBusyName] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (
      text: string,
      opts?: {
        successMessage?: string;
        failureMessage?: string;
      }
    ) => {
      const value = String(text ?? '');
      const successMessage = opts?.successMessage || 'تم النسخ';
      const failureMessage = opts?.failureMessage || 'تعذر النسخ';

      try {
        const { safeCopyToClipboard } = await import('@/utils/clipboard');
        const res = await safeCopyToClipboard(value);
        if (res.ok) {
          toast.success(successMessage);
          return true;
        }
      } catch {
        // ignore
      }

      toast.error(failureMessage);
      return false;
    },
    [toast]
  );

  // Phase 2 (Printing): DOCX templates (managed via IPC; renderer has no print logic)
  const [docxTemplates, setDocxTemplates] = useState<string[]>([]);
  const [docxTemplatesBusy, setDocxTemplatesBusy] = useState(false);
  const [selectedDocxTemplate, setSelectedDocxTemplate] = useState<string>('');

  const [lastGeneratedTempPath, setLastGeneratedTempPath] = useState<string>('');

  // Phase 4 (Printing): Print settings (JSON file in userData; managed via IPC)
  const [printSettingsBusy, setPrintSettingsBusy] = useState(false);
  const [printSettingsPath, setPrintSettingsPath] = useState<string>('');
  const [printSettingsForm, setPrintSettingsForm] = useState({
    pageSize: 'A4' as 'A4' | 'A5' | 'Letter' | 'Legal' | { widthMm: number; heightMm: number },
    orientation: 'portrait' as 'portrait' | 'landscape',
    marginsMm: { top: 16, right: 16, bottom: 16, left: 16 },
    fontFamily: 'system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif',
    rtl: true,
    headerEnabled: true,
    footerEnabled: true,
    pdfExport: { sofficePath: '' },
  });

  const loadPrintSettings = async () => {
    if (!window.desktopPrintSettings?.get) return;
    setPrintSettingsBusy(true);
    try {
      const res = await window.desktopPrintSettings.get();
      if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok) {
        const okRes = res as {
          ok: true;
          settings: Partial<typeof printSettingsForm>;
          filePath: string;
        };
        setPrintSettingsForm((prev) => ({
          ...prev,
          ...okRes.settings,
          pdfExport: {
            sofficePath: String(
              (okRes.settings as unknown as { pdfExport?: { sofficePath?: unknown } })?.pdfExport
                ?.sofficePath ??
                prev.pdfExport.sofficePath ??
                ''
            ).trim(),
          },
        }));
        setPrintSettingsPath(okRes.filePath || '');
      } else {
        const msg =
          res && typeof res === 'object' && 'message' in res
            ? String((res as { message?: unknown }).message || '')
            : '';
        toast.error(msg || 'تعذر تحميل إعدادات الطباعة');
      }
    } catch {
      toast.error('تعذر تحميل إعدادات الطباعة');
    } finally {
      setPrintSettingsBusy(false);
    }
  };

  const savePrintSettings = async () => {
    if (!window.desktopPrintSettings?.save) return;
    setPrintSettingsBusy(true);
    try {
      const cleaned = {
        ...printSettingsForm,
        pdfExport: {
          sofficePath: String(printSettingsForm.pdfExport?.sofficePath ?? '').trim(),
        },
      };

      const res = await window.desktopPrintSettings.save(cleaned);
      if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok) {
        const okRes = res as { ok: true; filePath: string };
        toast.success('تم حفظ إعدادات الطباعة');
        if (okRes.filePath) setPrintSettingsPath(okRes.filePath);
      } else {
        const msg =
          res && typeof res === 'object' && 'message' in res
            ? String((res as { message?: unknown }).message || '')
            : '';
        toast.error(msg || 'تعذر حفظ إعدادات الطباعة');
      }
    } catch {
      toast.error('تعذر حفظ إعدادات الطباعة');
    } finally {
      setPrintSettingsBusy(false);
    }
  };

  const refreshDocxTemplates = async () => {
    if (!window.desktopDb?.listTemplates) return;
    setDocxTemplatesBusy(true);
    try {
      const res = await window.desktopDb.listTemplates();
      if (
        res &&
        typeof res === 'object' &&
        'success' in res &&
        (res as { success: boolean }).success
      ) {
        const items = (res as { items?: string[] }).items || [];
        setDocxTemplates(items);
        if (!selectedDocxTemplate && items.length > 0) {
          const first = items[0];
          if (first) setSelectedDocxTemplate(first);
        }
      } else {
        const msg =
          (res as { message?: string } | undefined)?.message || 'تعذر تحميل قائمة القوالب';
        toast.error(msg);
      }
    } catch {
      toast.error('تعذر تحميل قائمة القوالب');
    } finally {
      setDocxTemplatesBusy(false);
    }
  };

  const importDocxTemplate = async () => {
    if (!window.desktopDb?.importTemplate) return;
    try {
      const res = await window.desktopDb.importTemplate();
      if (res?.success) {
        toast.success('تم استيراد القالب بنجاح');
        await refreshDocxTemplates();
      } else {
        toast.error(res?.message || 'تم الإلغاء أو فشل الاستيراد');
      }
    } catch {
      toast.error('فشل استيراد القالب');
    }
  };

  const generateSampleLeaseTempPdf = async () => {
    if (!window.desktopPrintDispatch?.run && !window.desktopPrintEngine?.run) {
      toast.error('ميزة التوليد متاحة في نسخة سطح المكتب فقط');
      return;
    }
    try {
      setLastGeneratedTempPath('');
      const qaData = getPrintingQaSampleData();
      const res = await generateTemplateUnified({
        documentType: 'settings_sample_lease',
        templateName: selectedDocxTemplate || undefined,
        data: qaData,
        outputType: 'pdf',
        defaultFileName: 'عقد_إيجار_تجريبي',
      });

      if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok) {
        const okRes = res as { ok: true; tempPath?: string; savedPath?: string };
        const p = okRes.tempPath || okRes.savedPath || '';
        setLastGeneratedTempPath(p);
        toast.success('تم توليد PDF مؤقت بنجاح');
      } else {
        const msg =
          res && typeof res === 'object' && 'message' in res
            ? String((res as { message?: unknown }).message || '')
            : '';
        toast.error(msg || 'فشل توليد PDF مؤقت');
      }
    } catch {
      toast.error('فشل توليد PDF مؤقت');
    }
  };

  const openPrintPreviewWindow = async () => {
    if (!window.desktopPrintPreview?.open) return;
    try {
      const qaData = getPrintingQaSampleData();
      const res = await window.desktopPrintPreview.open({
        templateName: selectedDocxTemplate || undefined,
        data: qaData,
        defaultFileName: 'عقد_إيجار_تجريبي',
      });

      if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok) {
        toast.success('تم فتح نافذة المعاينة');
      } else {
        const msg =
          res && typeof res === 'object' && 'message' in res
            ? String((res as { message?: unknown }).message || '')
            : '';
        toast.error(msg || 'تعذر فتح نافذة المعاينة');
      }
    } catch {
      toast.error('تعذر فتح نافذة المعاينة');
    }
  };

  const generateSampleLeaseDocx = async () => {
    if (!window.desktopPrintDispatch?.run && !window.desktopPrintEngine?.run) {
      toast.error('ميزة التوليد متاحة في نسخة سطح المكتب فقط');
      return;
    }

    const userName = (
      typeof user === 'object' && user
        ? ((user as unknown as Record<string, unknown>).name ??
          (user as unknown as Record<string, unknown>).username)
        : undefined
    ) as string | undefined;

    const headerEnabled =
      (settings as unknown as Record<string, unknown> | null | undefined)?.letterheadEnabled !==
      false;
    const companyName = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companyName || ''
    );
    const companySlogan = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companySlogan || ''
    );
    const companyIdentityText = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companyIdentityText || ''
    );

    const qaData = getPrintingQaSampleData();
    const result = await exportDocxUnified({
      documentType: 'settings_sample_lease',
      templateName: selectedDocxTemplate || undefined,
      defaultFileName: 'عقد إيجار (تجريبي)',
      headerFooter: {
        headerEnabled,
        footerEnabled: true,
        companyName,
        companySlogan,
        companyIdentityText,
        userName: userName ? String(userName) : undefined,
        dateIso: new Date().toISOString().slice(0, 10),
      },
      data: qaData,
    });

    if (!result) {
      toast.error('فشل توليد ملف Word');
      return;
    }

    if (result.ok) toast.success('تم توليد ملف Word بنجاح');
    else toast.error(('message' in result ? result.message : '') || 'فشل توليد ملف Word');
  };

  const generateSampleLeaseTempDocx = async () => {
    if (!window.desktopPrintDispatch?.run && !window.desktopPrintEngine?.run) {
      toast.error('ميزة التوليد متاحة في نسخة سطح المكتب فقط');
      return;
    }

    const userName = (
      typeof user === 'object' && user
        ? ((user as unknown as Record<string, unknown>).name ??
          (user as unknown as Record<string, unknown>).username)
        : undefined
    ) as string | undefined;

    const headerEnabled =
      (settings as unknown as Record<string, unknown> | null | undefined)?.letterheadEnabled !==
      false;
    const companyName = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companyName || ''
    );
    const companySlogan = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companySlogan || ''
    );
    const companyIdentityText = String(
      (settings as unknown as Record<string, unknown> | null | undefined)?.companyIdentityText || ''
    );

    const qaData = getPrintingQaSampleData();
    const result = await generateTemplateUnified({
      documentType: 'settings_sample_lease',
      outputType: 'docx',
      templateName: selectedDocxTemplate || undefined,
      defaultFileName: 'عقد إيجار (مؤقت)',
      headerFooter: {
        headerEnabled,
        footerEnabled: true,
        companyName,
        companySlogan,
        companyIdentityText,
        userName: userName ? String(userName) : undefined,
        dateIso: new Date().toISOString().slice(0, 10),
      },
      data: qaData,
    });

    if (!result) {
      toast.error('فشل التوليد المؤقت');
      return;
    }

    if (result.ok) {
      setLastGeneratedTempPath(result.tempPath || '');
      toast.success('تم توليد ملف مؤقت بنجاح');
    } else {
      toast.error(('message' in result ? result.message : '') || 'فشل التوليد المؤقت');
    }
  };

  useEffect(() => {
    if (!isDesktop) return;
    if (activeSection !== 'general') return;
    void refreshDocxTemplates();
    void loadPrintSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, activeSection]);

  const [appLastErrorRaw, setAppLastErrorRaw] = useState<string>('');
  const [appLastError, setAppLastError] = useState<AppLastError | null>(null);
  const [appErrorLogRaw, setAppErrorLogRaw] = useState<string>('');
  const [appErrorLog, setAppErrorLog] = useState<AppErrorLogEntry[]>([]);
  const [diagnosticsSessionId, setDiagnosticsSessionId] = useState<string>('');

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [categories, setCategories] = useState<LookupCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<LookupCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<LookupCategory | null>(null);
  const [lookupItems, setLookupItems] = useState<SystemLookup[]>([]);
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<العمليات_tbl[]>([]);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ id: '', name: '', label: '' });
  const [isEditingTable, setIsEditingTable] = useState(false);

  const loadSettings = useCallback(() => {
    setSettingsLoading(true);
    try {
      const s = DbService.getSettings();
      setSettings(s);
    } catch (e: unknown) {
      setSettings(null);
      toast.error(getErrorMessage(e) || 'فشل تحميل إعدادات النظام');
    } finally {
      setSettingsLoading(false);
    }
  }, [toast]);

  const loadCategories = useCallback(() => {
    const cats = DbService.getLookupCategories();
    setCategories(cats);
    setFilteredCategories(cats);
    setActiveCategory((prev) => {
      if (prev) {
        const stillExists = cats.find((c) => c.id === prev.id);
        return stillExists ?? (cats.length > 0 ? cats[0] : null);
      }
      return cats.length > 0 ? cats[0] : null;
    });
  }, []);

  const loadAuditLogs = useCallback(() => {
    const allLogs = DbService.getLogs();
    const settingLogs = allLogs
      .filter(
        (l) =>
          l.نوع_العملية.includes('SETTINGS') ||
          l.اسم_الجدول === 'Settings' ||
          l.اسم_الجدول.includes('Lookup')
      )
      .reverse()
      .slice(0, 20);
    setAuditLogs(settingLogs);
  }, []);

  const loadBackupSection = useCallback(async () => {
    if (window.desktopDb?.getBackupDir) {
      try {
        const d = await window.desktopDb.getBackupDir();
        setBackupDir(d || '');
      } catch {
        setBackupDir('');
      }
    } else {
      setBackupDir('');
    }

    if (window.desktopDb?.getBackupEncryptionSettings) {
      try {
        const st =
          (await window.desktopDb.getBackupEncryptionSettings()) as unknown as BackupEncryptionStatus | null;
        setBackupEncAvailable(st?.available === true);
        setBackupEncEnabled(st?.enabled === true);
        setBackupEncHasPassword(st?.hasPassword === true);
      } catch {
        setBackupEncAvailable(false);
        setBackupEncEnabled(false);
        setBackupEncHasPassword(false);
      }
    } else {
      setBackupEncAvailable(false);
      setBackupEncEnabled(false);
      setBackupEncHasPassword(false);
    }

    if (window.desktopDb?.getLocalBackupAutomationSettings) {
      try {
        const st =
          (await window.desktopDb.getLocalBackupAutomationSettings()) as unknown as LocalBackupAutomationSettings | null;
        setLocalBackupEnabled(st?.enabled === true);
        setLocalBackupTime(String(st?.timeHHmm || '02:00'));
        setLocalBackupRetentionDays(Number(st?.retentionDays || 30) || 30);
        setLocalBackupLastRunAt(String(st?.lastRunAt || ''));
      } catch {
        setLocalBackupEnabled(false);
        setLocalBackupTime('02:00');
        setLocalBackupRetentionDays(30);
        setLocalBackupLastRunAt('');
      }
    } else {
      setLocalBackupEnabled(false);
      setLocalBackupTime('02:00');
      setLocalBackupRetentionDays(30);
      setLocalBackupLastRunAt('');
    }

    if (window.desktopDb?.getLocalBackupStats) {
      try {
        const st =
          (await window.desktopDb.getLocalBackupStats()) as unknown as LocalBackupStats | null;
        setLocalBackupStats(st || null);
      } catch {
        setLocalBackupStats(null);
      }
    } else {
      setLocalBackupStats(null);
    }

    if (window.desktopDb?.getLocalBackupLog) {
      try {
        setLocalBackupLogBusy(true);
        const items = (await window.desktopDb.getLocalBackupLog({ limit: 200 })) as unknown as
          | LocalBackupLogEntry[]
          | null;
        setLocalBackupLog(Array.isArray(items) ? items.slice().reverse() : []);
      } catch {
        setLocalBackupLog([]);
      } finally {
        setLocalBackupLogBusy(false);
      }
    } else {
      setLocalBackupLog([]);
    }
  }, []);

  const saveBackupEncryption = async (payload: {
    enabled?: boolean;
    password?: string;
    clearPassword?: boolean;
  }) => {
    if (!window.desktopDb?.saveBackupEncryptionSettings) {
      toast.warning('هذه النسخة لا تحتوي على ميزة تشفير النسخ الاحتياطية بعد');
      return;
    }
    try {
      setBackupEncBusy(true);
      const res = (await window.desktopDb.saveBackupEncryptionSettings(
        payload
      )) as unknown as BackupEncryptionStatus | null;
      if (res?.success) {
        setBackupEncAvailable(res?.available === true);
        setBackupEncEnabled(res?.enabled === true);
        setBackupEncHasPassword(res?.hasPassword === true);
        if (payload.clearPassword) setBackupEncPassword('');
        toast.success(res?.message || 'تم حفظ إعدادات التشفير');
      } else {
        toast.error(res?.message || 'فشل حفظ إعدادات التشفير');
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as Record<string, unknown>).message ?? '')
          : '';
      toast.error(msg || 'فشل حفظ إعدادات التشفير');
    } finally {
      setBackupEncBusy(false);
    }
  };

  const saveLocalBackupAutomation = async (payload: {
    enabled?: boolean;
    timeHHmm?: string;
    retentionDays?: number;
  }) => {
    if (!window.desktopDb?.saveLocalBackupAutomationSettings) {
      toast.warning('هذه النسخة لا تحتوي على ميزة النسخ الاحتياطي التلقائي بعد');
      return;
    }
    try {
      setLocalBackupBusy(true);
      const res = (await window.desktopDb.saveLocalBackupAutomationSettings(
        payload
      )) as unknown as {
        success?: boolean;
        message?: string;
        settings?: LocalBackupAutomationSettings;
      } | null;
      if (res?.success) {
        const st = res?.settings;
        if (st) {
          setLocalBackupEnabled(st.enabled === true);
          setLocalBackupTime(String(st.timeHHmm || '02:00'));
          setLocalBackupRetentionDays(Number(st.retentionDays || 30) || 30);
          setLocalBackupLastRunAt(String(st.lastRunAt || ''));
        } else {
          setLocalBackupEnabled(payload.enabled === true);
        }
        toast.success(res?.message || 'تم حفظ إعدادات النسخ الاحتياطي التلقائي');
      } else {
        toast.error(res?.message || 'فشل حفظ إعدادات النسخ الاحتياطي التلقائي');
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل حفظ إعدادات النسخ الاحتياطي التلقائي');
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const runLocalBackupNow = async () => {
    if (!window.desktopDb?.runLocalBackupNow) {
      toast.warning('هذه النسخة لا تحتوي على ميزة النسخ الاحتياطي التلقائي بعد');
      return;
    }
    try {
      setLocalBackupBusy(true);
      const res = (await window.desktopDb.runLocalBackupNow()) as unknown as {
        success?: boolean;
        message?: string;
      } | null;
      if (res?.success) {
        toast.success(res?.message || 'تم إنشاء نسخة احتياطية');
        setLocalBackupLastRunAt(new Date().toISOString());
        // refresh stats + log
        try {
          const st = await window.desktopDb?.getLocalBackupStats?.();
          setLocalBackupStats((st as unknown as LocalBackupStats) || null);
        } catch {
          // ignore
        }
        try {
          const items = await window.desktopDb?.getLocalBackupLog?.({ limit: 200 });
          setLocalBackupLog(
            Array.isArray(items)
              ? (items as unknown as LocalBackupLogEntry[]).slice().reverse()
              : []
          );
        } catch {
          // ignore
        }
      } else {
        toast.error(res?.message || 'فشل إنشاء النسخة الاحتياطية');
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل إنشاء النسخة الاحتياطية');
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const refreshLocalBackupInsights = async () => {
    if (!window.desktopDb) return;
    try {
      setLocalBackupLogBusy(true);
      const st = await window.desktopDb?.getLocalBackupStats?.();
      setLocalBackupStats((st as unknown as LocalBackupStats) || null);
      const items = await window.desktopDb?.getLocalBackupLog?.({ limit: 200 });
      setLocalBackupLog(
        Array.isArray(items) ? (items as unknown as LocalBackupLogEntry[]).slice().reverse() : []
      );
    } catch {
      // ignore
    } finally {
      setLocalBackupLogBusy(false);
    }
  };

  const clearLocalBackupHistory = async () => {
    if (!window.desktopDb?.clearLocalBackupLog) return;
    const ok = await toast.confirm({
      title: 'تأكيد',
      message: 'هل تريد مسح سجل النسخ الاحتياطي؟',
      confirmText: 'مسح',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    try {
      setLocalBackupLogBusy(true);
      await window.desktopDb.clearLocalBackupLog();
      setLocalBackupLog([]);
      toast.success('تم مسح سجل النسخ');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل مسح السجل');
    } finally {
      setLocalBackupLogBusy(false);
    }
  };

  const loadDiagnostics = useCallback(() => {
    try {
      const raw = String(localStorage.getItem('app_last_error') || '').trim();
      setAppLastErrorRaw(raw);

      const rawLog = String(localStorage.getItem('app_error_log') || '').trim();
      setAppErrorLogRaw(rawLog);
      if (!rawLog) {
        setAppErrorLog([]);
      } else {
        try {
          const parsed = JSON.parse(rawLog) as unknown;
          if (Array.isArray(parsed)) {
            setAppErrorLog(parsed as AppErrorLogEntry[]);
          } else {
            setAppErrorLog([]);
          }
        } catch {
          setAppErrorLog([]);
        }
      }

      // Session ID helps correlate multiple reports from the same session.
      try {
        let sid = String(sessionStorage.getItem('app_session_id') || '').trim();
        if (!sid && rawLog) {
          try {
            const parsed = JSON.parse(rawLog) as unknown;
            if (Array.isArray(parsed)) {
              const firstWithSid = (parsed as AppErrorLogEntry[]).find(
                (e) => typeof e?.sessionId === 'string' && e.sessionId.trim()
              );
              if (firstWithSid?.sessionId) sid = firstWithSid.sessionId.trim();
            }
          } catch {
            // ignore
          }
        }
        if (!sid) {
          sid = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
        try {
          sessionStorage.setItem('app_session_id', sid);
        } catch {
          // ignore
        }
        setDiagnosticsSessionId(sid);
      } catch {
        setDiagnosticsSessionId('');
      }

      if (!raw) {
        setAppLastError(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'object' && parsed !== null) {
          const rec = parsed as Record<string, unknown>;
          setAppLastError({
            at: typeof rec.at === 'string' ? rec.at : undefined,
            message: typeof rec.message === 'string' ? rec.message : undefined,
            stack: typeof rec.stack === 'string' ? rec.stack : undefined,
          });
          return;
        }
      } catch {
        // ignore
      }
      setAppLastError({ message: raw });
    } catch {
      setAppLastErrorRaw('');
      setAppLastError(null);
    }
  }, []);

  const handleCopyDiagnosticsSessionId = async () => {
    const sid = String(diagnosticsSessionId || '').trim();
    if (!sid) {
      toast.info('لا يوجد معرّف جلسة متاح');
      return;
    }
    await copyToClipboard(sid, {
      successMessage: 'تم نسخ معرّف الجلسة',
      failureMessage: 'تعذر النسخ (قد تكون صلاحيات النسخ غير متاحة)',
    });
  };

  const handleCopyDiagnosticsReport = async () => {
    try {
      const report = buildDiagnosticsReport();
      const text = JSON.stringify(report, null, 2);
      await copyToClipboard(text, {
        successMessage: 'تم نسخ تقرير التشخيص',
        failureMessage: 'تعذر النسخ (قد تكون صلاحيات النسخ غير متاحة)',
      });
    } catch {
      toast.error('تعذر النسخ (قد تكون صلاحيات المتصفح غير متاحة)');
    }
  };

  const handleCopyDiagnostics = async () => {
    const text = appLastErrorRaw || '';
    if (!text.trim()) {
      toast.info('لا يوجد سجل أخطاء لنسخه');
      return;
    }
    await copyToClipboard(text, {
      successMessage: 'تم نسخ سجل الأخطاء',
      failureMessage: 'تعذر النسخ (قد تكون صلاحيات النسخ غير متاحة)',
    });
  };

  const buildDiagnosticsReport = () => {
    const now = new Date();
    let sessionId: string | undefined;
    try {
      sessionId = String(sessionStorage.getItem('app_session_id') || '').trim() || undefined;
    } catch {
      sessionId = undefined;
    }

    return {
      generatedAt: now.toISOString(),
      app: {
        version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown',
        mode: import.meta.env.MODE,
        isDev: import.meta.env.DEV,
        isProd: import.meta.env.PROD,
      },
      runtime: {
        sessionId,
        isDesktop: !!window.desktopDb,
        hasDesktopUpdater: !!(window as unknown as { desktopUpdater?: unknown })?.desktopUpdater,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        language: typeof navigator !== 'undefined' ? navigator.language : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      },
      lastError: appLastErrorRaw ? (appLastError ?? { raw: appLastErrorRaw }) : null,
      lastErrorRaw: appLastErrorRaw || '',
      errorLog: appErrorLogRaw ? (appErrorLog.length ? appErrorLog : { raw: appErrorLogRaw }) : [],
      errorLogRaw: appErrorLogRaw || '',
    };
  };

  const getDesktopDbCapabilities = () => {
    const db = (window as unknown as { desktopDb?: Record<string, unknown> }).desktopDb;
    if (!db) return null;

    const hasFn = (k: string) => typeof (db as Record<string, unknown>)[k] === 'function';
    const hasVal = (k: string) => typeof (db as Record<string, unknown>)[k] !== 'undefined';

    return {
      hasDesktopDb: true,
      methods: {
        get: hasFn('get'),
        set: hasFn('set'),
        del: hasFn('del'),
        sqlStatus: hasFn('sqlStatus'),
        sqlGetSettings: hasFn('sqlGetSettings'),
        sqlSaveSettings: hasFn('sqlSaveSettings'),
        sqlTestConnection: hasFn('sqlTestConnection'),
        sqlConnect: hasFn('sqlConnect'),
        sqlCoverage: hasFn('sqlCoverage'),
        sqlSyncNow: hasFn('sqlSyncNow'),
        getBackupDir: hasFn('getBackupDir'),
        chooseBackupDir: hasFn('chooseBackupDir'),
        getLocalBackupAutomationSettings: hasFn('getLocalBackupAutomationSettings'),
        saveLocalBackupAutomationSettings: hasFn('saveLocalBackupAutomationSettings'),
        runLocalBackupNow: hasFn('runLocalBackupNow'),
        saveAttachmentFile: hasFn('saveAttachmentFile'),
        readAttachmentFile: hasFn('readAttachmentFile'),
        openAttachmentFile: hasFn('openAttachmentFile'),
      },
      values: {
        isDesktop: hasVal('isDesktop'),
      },
    };
  };

  const downloadTextFile = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportDiagnosticsFile = async () => {
    try {
      const base = buildDiagnosticsReport();
      const desktopCaps = getDesktopDbCapabilities();

      const sql = await (async () => {
        if (!window.desktopDb) return null;
        const out: Record<string, unknown> = {};
        try {
          if (window.desktopDb.sqlStatus) out.status = await window.desktopDb.sqlStatus();
        } catch (e: unknown) {
          out.statusError = getErrorMessage(e) || String(e ?? 'sqlStatus failed');
        }
        try {
          if (window.desktopDb.sqlGetSettings)
            out.settings = await window.desktopDb.sqlGetSettings();
        } catch (e: unknown) {
          out.settingsError = getErrorMessage(e) || String(e ?? 'sqlGetSettings failed');
        }
        return out;
      })();

      const report = { ...base, desktop: desktopCaps, sql };
      const safeStamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sid = typeof base?.runtime?.sessionId === 'string' ? base.runtime.sessionId.trim() : '';
      const safeSid = sid ? sid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
      const filename = safeSid
        ? `azrar-diagnostics-${safeSid}-${safeStamp}.json`
        : `azrar-diagnostics-${safeStamp}.json`;
      downloadTextFile(filename, JSON.stringify(report, null, 2));
      toast.success('تم تصدير ملف التشخيص');
    } catch {
      toast.error('تعذر تصدير ملف التشخيص');
    }
  };

  const handleClearDiagnostics = () => {
    try {
      localStorage.removeItem('app_last_error');
      localStorage.removeItem('app_error_log');
    } catch {
      // ignore
    }
    setAppLastErrorRaw('');
    setAppLastError(null);
    setAppErrorLogRaw('');
    setAppErrorLog([]);
    toast.success('تم مسح سجل الأخطاء');
  };

  const visibleTabs = useMemo(() => {
    const tabs = [
      {
        id: 'general',
        label: 'الإعدادات العامة',
        icon: Building,
        desc: 'الهوية والاتصال',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'templates',
        label: 'قوالب Word',
        icon: FileText,
        desc: 'إدارة القوالب',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'contractWord',
        label: 'متغيرات قالب العقد',
        icon: FileSpreadsheet,
        desc: 'تصدير Excel + شرح',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'messages',
        label: 'الرسائل والإشعارات',
        icon: Bell,
        desc: 'متغيرات ما بعد البيع',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'commissions',
        label: 'قواعد العمولات',
        icon: BadgeDollarSign,
        desc: 'نسب الإيجار والبيع',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'lookups',
        label: 'الجداول المساعدة',
        icon: List,
        desc: 'القوائم المنسدلة',
        permission: 'SETTINGS_ADMIN' as PermissionCode,
      },
      {
        id: 'server',
        label: 'إعدادات المخدم',
        icon: Globe,
        desc: 'SQL Server والمزامنة',
        role: 'SuperAdmin',
      },
      {
        id: 'backup',
        label: 'النسخ الاحتياطي',
        icon: Database,
        desc: 'تصدير واستيراد',
        role: 'SuperAdmin',
      },
      {
        id: 'audit',
        label: 'سجل التغييرات',
        icon: History,
        desc: 'تتبع تعديلات النظام',
        permission: 'SETTINGS_AUDIT' as PermissionCode,
      },
      {
        id: 'diagnostics',
        label: 'التشخيص',
        icon: FileJson,
        desc: 'آخر أخطاء الواجهة',
        role: 'SuperAdmin',
      },
      {
        id: 'about',
        label: 'حول النظام',
        icon: Info,
        desc: 'حقوق النشر والإصدار',
        role: 'SuperAdmin',
      },
    ];

    if (serverOnly) {
      return tabs
        .filter((t) => t.id === 'server')
        .filter((t) => {
          if (isSuperAdmin(user?.الدور)) return true;
          if (t.role && !isRole(user?.الدور, t.role)) return false;
          return true;
        });
    }

    return tabs.filter((t) => {
      if (t.id === 'about') return true; // Always visible
      if (isSuperAdmin(user?.الدور)) return true;
      if (t.role && !isRole(user?.الدور, t.role)) return false;
      if (t.permission && !DbService.userHasPermission(user?.id || '', t.permission)) return false;
      return true;
    });
  }, [user, serverOnly]);

  useEffect(() => {
    if (serverOnly) {
      if (activeSection !== 'server') setActiveSection('server');
      return;
    }
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.id === activeSection)) {
      setActiveSection(visibleTabs[0].id);
    }
  }, [visibleTabs, serverOnly, activeSection]);

  useEffect(() => {
    if (visibleTabs.some((t) => t.id === activeSection)) {
      loadSettings();
      if (activeSection === 'lookups') loadCategories();
      if (activeSection === 'audit') loadAuditLogs();
      if (activeSection === 'diagnostics') loadDiagnostics();
      if (activeSection === 'backup') void loadBackupSection();
    }
  }, [
    activeSection,
    visibleTabs,
    dbSignal,
    loadSettings,
    loadCategories,
    loadAuditLogs,
    loadDiagnostics,
    loadBackupSection,
  ]);

  useEffect(() => {
    if (activeCategory) setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
  }, [activeCategory]);

  useEffect(() => {
    if (!catSearchTerm.trim()) setFilteredCategories(categories);
    else
      setFilteredCategories(
        categories.filter(
          (c) =>
            c.label.toLowerCase().includes(catSearchTerm.toLowerCase()) ||
            c.name.toLowerCase().includes(catSearchTerm.toLowerCase())
        )
      );
  }, [catSearchTerm, categories]);

  useEffect(() => {
    if (!settings) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      DbService.saveSettings(settings);
      setSaveStatus('saved');
    }, 700);
    return () => clearTimeout(timer);
  }, [settings]);

  const wordTemplatesRefreshInFlightRef = useRef(false);

  const refreshWordTemplates = useCallback(
    async (templateType?: WordTemplateType) => {
      const t: WordTemplateType = templateType || activeWordTemplateType;
      if (!DbService.listWordTemplates) {
        setWordTemplates([]);
        setWordTemplatesDir('');
        setWordTemplateKvKeysByName({});
        return;
      }

      if (wordTemplatesRefreshInFlightRef.current) return;
      wordTemplatesRefreshInFlightRef.current = true;

      setWordTemplatesBusy(true);
      try {
        if (DbService.listWordTemplatesDetailed) {
          const res = await DbService.listWordTemplatesDetailed(t);
          if (res?.success && res.data) {
            setWordTemplates(res.data.items || []);
            setWordTemplatesDir(String(res.data.dir || ''));

            const kvMap: Record<string, string> = {};
            for (const d of res.data.details || []) {
              const fileName = String(d?.fileName || '').trim();
              const kvKey = String(d?.kvKey || '').trim();
              if (fileName && kvKey) kvMap[fileName] = kvKey;
            }
            setWordTemplateKvKeysByName(kvMap);
          } else {
            setWordTemplates([]);
            setWordTemplatesDir('');
            setWordTemplateKvKeysByName({});
          }
        } else {
          const res = await DbService.listWordTemplates(t);
          if (res?.success) setWordTemplates(res.data || []);
          else setWordTemplates([]);
          setWordTemplatesDir('');
          setWordTemplateKvKeysByName({});
        }
      } catch (e: unknown) {
        setWordTemplates([]);
        setWordTemplatesDir('');
        setWordTemplateKvKeysByName({});
        toast.error(getErrorMessage(e) || 'تعذر جلب قائمة قوالب Word');
      } finally {
        setWordTemplatesBusy(false);
        wordTemplatesRefreshInFlightRef.current = false;
      }
    },
    [activeWordTemplateType, toast]
  );

  useEffect(() => {
    if (!isDesktop) return;
    if (activeSection !== 'templates') return;
    void refreshWordTemplates(activeWordTemplateType);
  }, [activeSection, activeWordTemplateType, isDesktop, refreshWordTemplates]);

  const getSelectedWordTemplateName = useCallback(
    (s: SystemSettings | null, t: WordTemplateType) => {
      if (!s) return '';
      if (t === 'contracts') return String(s.contractWordTemplateName || '');
      if (t === 'installments')
        return String((s as SystemSettings).installmentWordTemplateName || '');
      return String((s as SystemSettings).handoverWordTemplateName || '');
    },
    []
  );

  const setSelectedWordTemplateName = useCallback((t: WordTemplateType, nextName: string) => {
    const v = String(nextName || '');
    setSettings((prev) => {
      if (!prev) return prev;
      if (t === 'contracts') return { ...prev, contractWordTemplateName: v };
      if (t === 'installments') return { ...prev, installmentWordTemplateName: v };
      return { ...prev, handoverWordTemplateName: v };
    });
  }, []);

  const wordTemplatePrintPreviewBodyHtml = useMemo(() => {
    if (!settings) return '';
    return getWordTemplatePreviewBodyHtml(activeWordTemplateType, settings);
  }, [activeWordTemplateType, settings]);

  const templateTypeLabel = useCallback((t: WordTemplateType) => {
    if (t === 'contracts') return 'قالب العقد';
    if (t === 'installments') return 'قالب الكمبيالات';
    return 'قالب محضر التسليم';
  }, []);

  const handleImportWordTemplate = useCallback(async () => {
    if (!DbService.importWordTemplate) {
      toast.warning('استيراد القالب متاح في نسخة سطح المكتب فقط');
      return;
    }
    setWordTemplateImportBusy(true);
    try {
      const res = await DbService.importWordTemplate(activeWordTemplateType);
      if (!res?.success || !res.data) {
        toast.error(res?.message || 'تم الإلغاء');
        return;
      }

      setSelectedWordTemplateName(activeWordTemplateType, res.data);
      await refreshWordTemplates(activeWordTemplateType);
      toast.success(
        `تم استيراد ${templateTypeLabel(activeWordTemplateType)} وتعيينه كقالب افتراضي`
      );
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل استيراد قالب Word');
    } finally {
      setWordTemplateImportBusy(false);
    }
  }, [
    activeWordTemplateType,
    refreshWordTemplates,
    setSelectedWordTemplateName,
    templateTypeLabel,
    toast,
  ]);

  /** معاينة PrintPreviewModal ببيانات تجريبية حسب نوع القالب (لا تعتمد على ملف DOCX). */
  const handlePreviewSelectedWordTemplate = useCallback(() => {
    if (!settings) {
      toast.warning('يرجى انتظار تحميل الإعدادات');
      return;
    }
    setIsWordTemplatePreviewOpen(true);
  }, [settings, toast]);

  const handleExportWordTemplateByName = useCallback(
    async (templateName: string) => {
      const name = String(templateName || '').trim();
      if (!name) return;
      if (!DbService.readWordTemplate) {
        toast.warning('التصدير متاح في نسخة سطح المكتب فقط');
        return;
      }
      setWordTemplateExportBusyName(name);
      try {
        const tpl = await DbService.readWordTemplate(name, activeWordTemplateType);
        if (!tpl?.success || !tpl.data) {
          toast.error(tpl?.message || 'تعذر تحميل قالب Word');
          return;
        }
        const lines = getPlaceholderGuideLines(activeWordTemplateType);
        const bytes = applyPlaceholderGuideToDocx(tpl.data, lines);
        const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('تم تنزيل القالب');
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'تعذر تصدير القالب');
      } finally {
        setWordTemplateExportBusyName(null);
      }
    },
    [activeWordTemplateType, toast]
  );

  const handleDownloadSelectedWordTemplate = useCallback(async () => {
    const tplName = getSelectedWordTemplateName(settings, activeWordTemplateType).trim();
    if (!tplName) {
      toast.warning('يرجى اختيار قالب أولاً');
      return;
    }
    if (!DbService.readWordTemplate) {
      toast.warning('التحميل متاح في نسخة سطح المكتب فقط');
      return;
    }

    try {
      const tpl = await DbService.readWordTemplate(tplName, activeWordTemplateType);
      if (!tpl?.success || !tpl.data) {
        toast.error(tpl?.message || 'تعذر تحميل قالب Word');
        return;
      }
      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const blob = new Blob([new Uint8Array(tpl.data)], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tplName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('تم تنزيل القالب');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'تعذر تنزيل القالب');
    }
  }, [activeWordTemplateType, getSelectedWordTemplateName, settings, toast]);

  const [wordTemplateDeleteBusy, setWordTemplateDeleteBusy] = useState(false);

  const handleDeleteSelectedWordTemplate = useCallback(async () => {
    const tplName = getSelectedWordTemplateName(settings, activeWordTemplateType).trim();
    if (!tplName) {
      toast.warning('يرجى اختيار قالب أولاً');
      return;
    }

    const ok = await toast.confirm({
      title: 'حذف قالب Word',
      message: `هل أنت متأكد من حذف القالب: ${tplName} ؟`,
      confirmText: 'نعم، احذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    if (!DbService.deleteWordTemplate) {
      toast.warning('الحذف متاح في نسخة سطح المكتب فقط');
      return;
    }

    if (wordTemplateDeleteBusy) return;
    setWordTemplateDeleteBusy(true);
    try {
      const res = await DbService.deleteWordTemplate(tplName, activeWordTemplateType);
      if (!res?.success) {
        toast.error(res?.message || 'فشل حذف القالب');
        return;
      }

      setSelectedWordTemplateName(activeWordTemplateType, '');
      setWordTemplates((prev) => prev.filter((x) => x !== tplName));
      await refreshWordTemplates(activeWordTemplateType);
      toast.success('تم حذف القالب');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل حذف القالب');
    } finally {
      setWordTemplateDeleteBusy(false);
    }
  }, [
    activeWordTemplateType,
    getSelectedWordTemplateName,
    refreshWordTemplates,
    setSelectedWordTemplateName,
    settings,
    toast,
    wordTemplateDeleteBusy,
  ]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (settings && ev.target?.result)
          setSettings({ ...settings, logoUrl: ev.target.result as string });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const openAddTableModal = () => {
    setTableForm({ id: '', name: '', label: '' });
    setIsEditingTable(false);
    setIsTableModalOpen(true);
  };
  const openEditTableModal = (cat: LookupCategory) => {
    setTableForm({ id: cat.id, name: cat.name, label: cat.label });
    setIsEditingTable(true);
    setIsTableModalOpen(true);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.label.trim()) return toast.warning('يرجى إدخال اسم الجدول');

    let res;
    if (isEditingTable) {
      res = DbService.updateLookupCategory(tableForm.id, { label: tableForm.label });
    } else {
      if (!tableForm.name.trim()) return toast.warning('يرجى إدخال المعرف البرمجي');
      const finalName = tableForm.name.toLowerCase().replace(/\s+/g, '_');
      res = DbService.addLookupCategory(finalName, tableForm.label);
    }

    if (res && res.success === false) {
      toast.error(res.message);
    } else {
      toast.success(isEditingTable ? 'تم تحديث الجدول' : 'تم إنشاء الجدول');
      setIsTableModalOpen(false);
      loadCategories();
    }
  };

  const handleDeleteCategory = (id: string) => {
    openPanel('CONFIRM_MODAL', id, {
      title: 'حذف جدول البيانات',
      message: 'هل أنت متأكد؟ سيؤدي هذا لحذف القائمة وجميع العناصر المرتبطة بها نهائياً.',
      confirmText: 'نعم، احذف',
      variant: 'danger',
      onConfirm: () => {
        const res = DbService.deleteLookupCategory(id);
        if (res.success) {
          loadCategories();
          toast.success('تم حذف الجدول بنجاح');
        } else {
          toast.error('فشل الحذف');
        }
      },
    });
  };

  const handleAddLookup = () => {
    if (!activeCategory) return;
    openPanel('SMART_PROMPT', 'new_lookup', {
      title: 'إضافة عنصر جديد',
      message: `إضافة قيمة جديدة للقائمة: ${activeCategory.label}`,
      placeholder: 'القيمة (مثال: شقة أرضية)',
      required: true,
      onConfirm: (val: string) => {
        const raw = String(val ?? '');
        const trimmed = raw.trim();
        if (!trimmed) {
          toast.warning('يرجى إدخال قيمة صحيحة');
          return;
        }

        const norm = (s: string) =>
          String(s ?? '')
            .trim()
            .toLowerCase();
        const nextKey = activeCategory?.name
          ? `${norm(activeCategory.name)}||${norm(trimmed)}`
          : norm(trimmed);
        const hasDup = DbService.getLookupsByCategory(activeCategory.name).some((item) => {
          const k = norm(item?.key || '');
          const lbl = norm(item?.label || '');
          const dkey = `${norm(item?.category || '')}||${k || lbl}`;
          return dkey === nextKey;
        });
        if (hasDup) {
          toast.error('هذه القيمة موجودة مسبقاً في القائمة');
          return;
        }

        const before = DbService.getLookupsByCategory(activeCategory.name).length;
        DbService.addLookup(activeCategory.name, trimmed);
        const afterItems = DbService.getLookupsByCategory(activeCategory.name);
        setLookupItems(afterItems);
        const after = afterItems.length;

        if (after > before) toast.success('تم إضافة العنصر');
        else toast.warning('لم يتم الإضافة (قد تكون القيمة مكررة)');
      },
    });
  };

  const handleDeleteLookup = (id: string) => {
    DbService.deleteLookup(id);
    if (activeCategory) setLookupItems(DbService.getLookupsByCategory(activeCategory.name));
  };

  const downloadCSV = (content: string, fileName: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLookupsJSON = () => {
    if (!activeCategory) return;
    const items = DbService.getLookupsByCategory(activeCategory.name).map((l) => l.label);
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCategory.name}_lookups.json`;
    a.click();
  };

  const handleExportLookupsCSV = () => {
    if (!activeCategory) return;
    const items = DbService.getLookupsByCategory(activeCategory.name);
    if (items.length === 0) return toast.warning('لا توجد بيانات للتصدير');

    const csv =
      'ID,Label,Category\n' + items.map((i) => `${i.id},"${i.label}",${i.category}`).join('\n');
    downloadCSV(csv, `${activeCategory.name}_lookups.csv`);
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) return toast.warning('لا توجد سجلات');
    const csv =
      'User,Action,Table,Details,Date\n' +
      auditLogs
        .map(
          (l) =>
            `"${l.اسم_المستخدم}","${l.نوع_العملية}","${l.اسم_الجدول}","${l.details?.replace(/"/g, '""')}","${l.تاريخ_العملية}"`
        )
        .join('\n');
    downloadCSV(csv, `settings_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleImportLookups = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCategory || !e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          const before = DbService.getLookupsByCategory(activeCategory.name).length;
          DbService.importLookups(activeCategory.name, data);
          const afterItems = DbService.getLookupsByCategory(activeCategory.name);
          setLookupItems(afterItems);
          const added = Math.max(0, afterItems.length - before);
          toast.success(`تم استيراد ${added} عنصر بنجاح`);
        } else {
          toast.error('صيغة الملف غير صحيحة');
        }
      } catch {
        toast.error('فشل قراءة الملف');
      }
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
  };

  const handleBackup = async () => {
    // Desktop: export sqlite DB via Electron (creates latest + dated archive)
    if (window.desktopDb?.export) {
      try {
        const res = (await window.desktopDb.export()) as unknown as DesktopSuccessMessage | null;
        if (res?.success) {
          toast.success(
            res?.archivePath
              ? 'تم حفظ النسخة (Latest + أرشيف اليوم)'
              : res?.message || 'تم التصدير بنجاح'
          );
        } else {
          toast.error(res?.message || 'فشل تصدير قاعدة البيانات');
        }
      } catch (e: unknown) {
        const msg =
          typeof e === 'object' && e !== null && 'message' in e
            ? String((e as Record<string, unknown>).message ?? '')
            : '';
        toast.error(msg || 'فشل تصدير قاعدة البيانات');
      }
      return;
    }

    // Web/fallback: export JSON from mockDb
    const url = DbService.backupSystem();
    const a = document.createElement('a');
    a.href = url;
    a.download = `khaberni_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const preview = DbService.previewRestore(json);
      openPanel('CONFIRM_MODAL', 'restore', {
        title: 'استعادة نسخة احتياطية',
        message: `سيتم استرجاع: ${preview.people} أشخاص، ${preview.contracts} عقود. هل أنت متأكد؟ سيتم استبدال البيانات الحالية.`,
        confirmText: 'استعادة',
        variant: 'danger',
        onConfirm: () => {
          DbService.restoreSystem(json);
          toast.success('تم الاسترجاع بنجاح');
          window.location.reload();
        },
      });
    } catch {
      toast.error('ملف النسخة الاحتياطية غير صالح أو تالف');
    }
  };

  const handleDesktopImport = async () => {
    if (!window.desktopDb?.import) {
      toast.warning('ميزة الاستيراد متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    try {
      const res = (await window.desktopDb.import()) as unknown as DesktopSuccessMessage | null;
      if (res?.success) {
        toast.success(res?.message || 'تم الاستيراد بنجاح - أعد تشغيل التطبيق');
      } else {
        toast.error(res?.message || 'فشل استيراد قاعدة البيانات');
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as Record<string, unknown>).message ?? '')
          : '';
      toast.error(msg || 'فشل استيراد قاعدة البيانات');
    }
  };

  const goToDatabaseReset = () => {
    openPanel('CONFIRM_MODAL', 'go_database_reset', {
      title: 'إعادة ضبط المصنع',
      variant: 'danger',
      confirmText: 'متابعة',
      cancelText: 'إلغاء',
      message: `سيتم فتح شاشة "إدارة قاعدة البيانات" التي تسمح بتصفير النظام.

ننصح بتصدير نسخة احتياطية قبل المتابعة.`,
      onConfirm: () => {
        window.location.hash = ROUTE_PATHS.RESET_DATABASE;
      },
    });
  };

  const resetOnboarding = () => {
    localStorage.removeItem('khaberni_onboarding_completed');
    window.location.reload();
  };

  const clearSystemCache = async () => {
    const ok = await toast.confirm({
      title: 'تأكيد',
      message:
        'هل أنت متأكد؟ سيتم مسح الكاش المحلي وإعادة بناء الفهارس. لن يتم حذف البيانات الأساسية.',
      confirmText: 'متابعة',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    // Keep critical keys, clear cache keys
    void storage.removeItem('db_dashboard_config'); // Reset dashboard layout
    localStorage.removeItem('db_dashboard_config');
    // Force reload to rebuild cache via mockDb init
    window.location.reload();
  };

  const inputClass =
    'w-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm';
  const labelClass =
    'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2';

  const exportContractWordVariablesExcel = async () => {
    type Row = { placeholder: string; key: string; label: string; example: string };
    const rows: Row[] = CONTRACT_WORD_TEMPLATE_VARIABLES.map((v) => ({
      placeholder: `{{${v.key}}}`,
      key: v.key,
      label: v.label,
      example: v.example || '',
    }));

    await exportToXlsx<Row>(
      'قالب العقد (Word)',
      [
        { key: 'placeholder', header: 'المتغير (للنسخ)' },
        { key: 'key', header: 'المفتاح' },
        { key: 'label', header: 'الوصف' },
        { key: 'example', header: 'مثال' },
      ],
      rows,
      'متغيرات-قالب-العقد-Word.xlsx',
      {
        extraSheets: [
          {
            name: 'شرح',
            rows: [
              ['طريقة الاستخدام'],
              ['انسخ من عمود "المتغير (للنسخ)" والصق داخل ملف Word. مثال:'],
              ['اسم المؤجر: {{ownerName}}'],
              ['مدة الإيجار: {{contractDurationText}}'],
              ['كيفية أداء البدل: {{contractRentPaymentText}}'],
              ['ملاحظة'],
              ['القوالب القديمة التي تعتمد على نجوم (****) ما زالت تعمل تلقائياً.'],
            ],
          },
        ],
      }
    );
  };

  const parseMultilineList = (raw: string): string[] => {
    return String(raw || '')
      .split(/\r?\n/)
      .flatMap((line) => line.split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  };

  const settingsNoAccessFallback = (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-slate-500 dark:text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
        <Shield size={24} className="opacity-70" />
      </div>
      <div className="text-slate-800 dark:text-slate-200 font-bold">
        لا تملك صلاحية الوصول لهذا القسم
      </div>
      <div className="text-sm mt-1">يرجى تسجيل الدخول بحساب مخوّل أو مراجعة صلاحيات المستخدم.</div>
    </div>
  );

  return {
    toast,
    dbSignal,
    isDesktop,
    handleChooseBackupDir,
    formatBytes,
    computeNextRunAt,
    copyToClipboard,
    loadPrintSettings,
    savePrintSettings,
    refreshDocxTemplates,
    importDocxTemplate,
    generateSampleLeaseTempPdf,
    openPrintPreviewWindow,
    generateSampleLeaseDocx,
    generateSampleLeaseTempDocx,
    loadSettings,
    loadCategories,
    loadAuditLogs,
    loadBackupSection,
    saveBackupEncryption,
    saveLocalBackupAutomation,
    runLocalBackupNow,
    refreshLocalBackupInsights,
    clearLocalBackupHistory,
    loadDiagnostics,
    handleCopyDiagnosticsSessionId,
    handleCopyDiagnosticsReport,
    handleCopyDiagnostics,
    buildDiagnosticsReport,
    getDesktopDbCapabilities,
    downloadTextFile,
    handleExportDiagnosticsFile,
    handleClearDiagnostics,
    visibleTabs,
    wordTemplatesRefreshInFlightRef,
    refreshWordTemplates,
    getSelectedWordTemplateName,
    setSelectedWordTemplateName,
    templateTypeLabel,
    handleImportWordTemplate,
    handlePreviewSelectedWordTemplate,
    handleExportWordTemplateByName,
    handleDownloadSelectedWordTemplate,
    handleDeleteSelectedWordTemplate,
    handleLogoUpload,
    openAddTableModal,
    openEditTableModal,
    handleSaveTable,
    handleDeleteCategory,
    handleAddLookup,
    handleDeleteLookup,
    downloadCSV,
    handleExportLookupsJSON,
    handleExportLookupsCSV,
    handleExportAuditCSV,
    handleImportLookups,
    handleBackup,
    handleRestore,
    handleDesktopImport,
    goToDatabaseReset,
    resetOnboarding,
    clearSystemCache,
    inputClass,
    labelClass,
    exportContractWordVariablesExcel,
    parseMultilineList,
    settingsNoAccessFallback,
    activeSection,
    setActiveSection,
    backupDir,
    setBackupDir,
    backupEncAvailable,
    setBackupEncAvailable,
    backupEncEnabled,
    setBackupEncEnabled,
    backupEncHasPassword,
    setBackupEncHasPassword,
    backupEncPassword,
    setBackupEncPassword,
    backupEncBusy,
    setBackupEncBusy,
    localBackupEnabled,
    setLocalBackupEnabled,
    localBackupTime,
    setLocalBackupTime,
    localBackupRetentionDays,
    setLocalBackupRetentionDays,
    localBackupLastRunAt,
    setLocalBackupLastRunAt,
    localBackupBusy,
    setLocalBackupBusy,
    localBackupStats,
    setLocalBackupStats,
    localBackupLog,
    setLocalBackupLog,
    localBackupLogBusy,
    setLocalBackupLogBusy,
    wordTemplates,
    setWordTemplates,
    wordTemplateKvKeysByName,
    setWordTemplateKvKeysByName,
    wordTemplatesBusy,
    setWordTemplatesBusy,
    wordTemplateImportBusy,
    setWordTemplateImportBusy,
    activeWordTemplateType,
    setActiveWordTemplateType,
    wordTemplatesDir,
    setWordTemplatesDir,
    isWordTemplatePreviewOpen,
    setIsWordTemplatePreviewOpen,
    wordTemplatePrintPreviewBodyHtml,
    wordTemplateExportBusyName,
    docxTemplates,
    setDocxTemplates,
    docxTemplatesBusy,
    setDocxTemplatesBusy,
    selectedDocxTemplate,
    setSelectedDocxTemplate,
    lastGeneratedTempPath,
    setLastGeneratedTempPath,
    printSettingsBusy,
    setPrintSettingsBusy,
    printSettingsPath,
    setPrintSettingsPath,
    printSettingsForm,
    setPrintSettingsForm,
    appLastErrorRaw,
    setAppLastErrorRaw,
    appLastError,
    setAppLastError,
    appErrorLogRaw,
    setAppErrorLogRaw,
    appErrorLog,
    setAppErrorLog,
    diagnosticsSessionId,
    setDiagnosticsSessionId,
    settings,
    setSettings,
    settingsLoading,
    setSettingsLoading,
    saveStatus,
    setSaveStatus,
    categories,
    setCategories,
    filteredCategories,
    setFilteredCategories,
    activeCategory,
    setActiveCategory,
    lookupItems,
    setLookupItems,
    catSearchTerm,
    setCatSearchTerm,
    auditLogs,
    setAuditLogs,
    isTableModalOpen,
    setIsTableModalOpen,
    tableForm,
    setTableForm,
    isEditingTable,
    setIsEditingTable,
    wordTemplateDeleteBusy,
    setWordTemplateDeleteBusy,
    t,
    openPanel,
    user,
    embedded,
    serverOnly,
  };
}

export type SettingsPageModel = ReturnType<typeof useSettingsPage>;

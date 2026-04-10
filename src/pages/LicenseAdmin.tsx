import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { ROUTE_PATHS } from '@/routes/paths';
import {
  Activity,
  LayoutDashboard,
  Key,
  Users as UsersIcon,
  Users2 as CustomersIcon,
  Settings as SettingsIcon,
  LogOut,
  Globe,
  Search,
  Plus,
  Trash2,
  FileText,
  Save,
  ShieldCheck,
  Smartphone,
  History,
  Info
} from 'lucide-react';
import {
  loadLicenseAdminServerSettings,
  normalizeServerOrigin,
  saveLicenseAdminSelectedServer,
  saveLicenseAdminServers,
} from '@/features/licenseAdmin/settings';
import {
  cancelFingerprintRecord,
  deleteFingerprintRecord,
  loadFingerprintRegistry,
  type FingerprintRegistryRecord,
  upsertFingerprintRecord,
} from '@/features/licenseAdmin/fingerprintRegistry';
import { fmtDateTime, getErrorMessage, licenseStatusToArabic } from '@/features/licenseAdmin/utils';
import { useToast } from '@/context/ToastContext';

type AdminListItem = {
  licenseKey: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  maxActivations?: number;
  activationsCount?: number;
  statusUpdatedAt?: string;
  statusNote?: string;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerCity?: string;
  followUpStatus?: string;
  followUpLastContactAt?: string;
  followUpNextAt?: string;
};

type AfterSales = {
  customer?: { name?: string; company?: string; phone?: string; city?: string };
  note?: string;
  followUp?: { status?: string; lastContactAt?: string; nextAt?: string };
  updatedAt?: string;
};

type AuditEntry = { at?: string; action?: string; note?: string; meta?: Record<string, unknown> };

type AdminRecord = {
  licenseKey: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  features?: Record<string, unknown>;
  maxActivations?: number;
  activations?: Array<{ deviceId?: string; at?: string }>;
  lastSeenAt?: string;
  statusUpdatedAt?: string;
  statusNote?: string;
  afterSales?: AfterSales;
  audit?: AuditEntry[];
};

const followUpStatusOptions = [
  { value: '', label: 'بدون' },
  { value: 'new', label: 'جديد' },
  { value: 'needs-followup', label: 'يحتاج متابعة' },
  { value: 'in-progress', label: 'قيد المتابعة' },
  { value: 'done', label: 'تم' },
  { value: 'cancelled', label: 'ملغي' },
];

type IssueDuration = '' | 'trial14d' | '1m' | '3m' | '6m' | '1y' | 'custom';

const toIsoDate = (d: Date): string => {
  // yyyy-mm-dd in UTC is sufficient for server parsing.
  return d.toISOString().slice(0, 10);
};

const computeExpiresAtFromDuration = (duration: IssueDuration): string => {
  const now = new Date();
  const d = new Date(now);
  if (!duration) return '';
  if (duration === 'trial14d') {
    d.setDate(d.getDate() + 14);
    return toIsoDate(d);
  }
  if (duration === '1m') {
    d.setMonth(d.getMonth() + 1);
    return toIsoDate(d);
  }
  if (duration === '3m') {
    d.setMonth(d.getMonth() + 3);
    return toIsoDate(d);
  }
  if (duration === '6m') {
    d.setMonth(d.getMonth() + 6);
    return toIsoDate(d);
  }
  if (duration === '1y') {
    d.setFullYear(d.getFullYear() + 1);
    return toIsoDate(d);
  }
  return '';
};

type TabKey = 'dashboard' | 'licenses' | 'customers' | 'settings';

export const LicenseAdmin: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5056');
  const [servers, setServers] = useState<string[]>([]);
  const [newServer, setNewServer] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [serverAdminToken, setServerAdminToken] = useState('');
  const [serverAdminTokenConfigured, setServerAdminTokenConfigured] = useState<boolean | null>(
    null
  );
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Licensing State
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<AdminRecord | null>(null);

  const [issueMaxActivations, setIssueMaxActivations] = useState('1');
  const [issueExpiresAt, setIssueExpiresAt] = useState('');
  const [issueDuration, setIssueDuration] = useState<IssueDuration>('custom');
  const [issueFeaturesJson, setIssueFeaturesJson] = useState('');

  const [setStatusValue, setSetStatusValue] = useState<'active' | 'suspended' | 'revoked'>(
    'active'
  );
  const [setStatusNote, setSetStatusNote] = useState('');

  const [activateDeviceId, setActivateDeviceId] = useState('');
  const [activateResultJson, setActivateResultJson] = useState('');
  const [activateMeta, setActivateMeta] = useState('');
  const [savePath, setSavePath] = useState('');
  
  // Customers State
  const [customerSearch, setCustomerSearch] = useState('');

  const [fpOwner, setFpOwner] = useState('');
  const [fpComment, setFpComment] = useState('');
  const [fpItems, setFpItems] = useState<FingerprintRegistryRecord[]>([]);

  const [statusCheckDeviceId, setStatusCheckDeviceId] = useState('');
  const [statusCheckResult, setStatusCheckResult] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [afterSalesNote, setAfterSalesNote] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('');
  const [followUpLastContactAt, setFollowUpLastContactAt] = useState('');
  const [followUpNextAt, setFollowUpNextAt] = useState('');

  const [afterSalesLogNote, setAfterSalesLogNote] = useState('');

  const [exportConfirmPassword, setExportConfirmPassword] = useState('');

  const canUseBridge = typeof window !== 'undefined' && !!window.desktopLicenseAdmin;

  useEffect(() => {
    const st = loadLicenseAdminServerSettings();
    setServers(st.servers);
    if (st.selectedServer) setServerUrl(st.selectedServer);
    setFpItems(loadFingerprintRegistry());
  }, []);

  useEffect(() => {
    // Best-effort autofill owner/comment when fingerprint matches saved item.
    const fp = activateDeviceId.trim();
    if (!fp) return;
    const match = fpItems.find((x) => x.fingerprint === fp) || null;
    if (!match) return;
    if (!fpOwner.trim()) setFpOwner(match.owner || '');
    if (!fpComment.trim()) setFpComment(match.comment || '');
  }, [activateDeviceId, fpItems, fpOwner, fpComment]);

  useEffect(() => {
    if (serverUrl) {
      saveLicenseAdminSelectedServer(serverUrl);
    }
  }, [serverUrl]);

  const doAddServer = () => {
    const origin = normalizeServerOrigin(newServer);
    if (!origin) {
      toast.error('رابط السيرفر غير صالح');
      return;
    }
    const next = Array.from(new Set([origin, ...servers]));
    setServers(next);
    setServerUrl(origin);
    saveLicenseAdminServers(next);
    setNewServer('');
    toast.success('تمت إضافة السيرفر');
  };

  const doRemoveServer = (url: string) => {
    const next = servers.filter((s) => s !== url);
    setServers(next);
    saveLicenseAdminServers(next);
    if (serverUrl === url) {
      setServerUrl(next[0] || 'http://127.0.0.1:5056');
    }
    toast.success('تم حذف السيرفر');
  };

  const selectedItem = useMemo(
    () => items.find((x) => x.licenseKey === selectedKey) || null,
    [items, selectedKey]
  );

  const refreshList = async () => {
    if (!canUseBridge) {
      setError('Desktop bridge not available. Run in Electron.');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.list({ serverUrl, q, limit: 500 });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const arr = Array.isArray(result.items) ? result.items : [];
      const parsed = arr
        .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : null))
        .filter((r): r is Record<string, unknown> => r !== null)
        .map((r) => ({
          licenseKey: String(r.licenseKey || ''),
          status: typeof r.status === 'string' ? String(r.status) : undefined,
          createdAt: typeof r.createdAt === 'string' ? String(r.createdAt) : undefined,
          expiresAt: typeof r.expiresAt === 'string' ? String(r.expiresAt) : undefined,
          maxActivations: typeof r.maxActivations === 'number' ? r.maxActivations : undefined,
          activationsCount: typeof r.activationsCount === 'number' ? r.activationsCount : undefined,
          statusUpdatedAt:
            typeof r.statusUpdatedAt === 'string' ? String(r.statusUpdatedAt) : undefined,
          statusNote: typeof r.statusNote === 'string' ? String(r.statusNote) : undefined,
          customerName: typeof r.customerName === 'string' ? String(r.customerName) : undefined,
          customerCompany:
            typeof r.customerCompany === 'string' ? String(r.customerCompany) : undefined,
          customerPhone: typeof r.customerPhone === 'string' ? String(r.customerPhone) : undefined,
          customerCity: typeof r.customerCity === 'string' ? String(r.customerCity) : undefined,
        }))
        .filter((x) => x.licenseKey);

      setItems(parsed);
      setInfo(`تم تحميل ${parsed.length} ترخيص`);
    } catch (e: unknown) {
      const msg = getErrorMessage(e) || 'Failed to refresh';
      if (/admin token not configured/i.test(msg)) {
        setError('توكن السيرفر غير مُعد. أدخل توكن الأدمن ثم اضغط “حفظ التوكن”.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshTokenStatus = async () => {
    if (!canUseBridge) return;
    if (!loggedIn) {
      setServerAdminTokenConfigured(null);
      return;
    }
    try {
      const res = await window.desktopLicenseAdmin?.getAdminTokenStatus({ serverUrl });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok === true) {
        setServerAdminTokenConfigured(Boolean(rec.configured));
      }
    } catch {
      // ignore
    }
  };

  const loadRecord = async (licenseKey: string) => {
    if (!canUseBridge) return;
    setError('');
    setInfo('');
    setBusy(true);
    setSavePath('');
    try {
      const res = await window.desktopLicenseAdmin?.get({ serverUrl, licenseKey });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const record =
        result.record && typeof result.record === 'object'
          ? (result.record as Record<string, unknown>)
          : {};

      const parsed: AdminRecord = {
        licenseKey: String(record.licenseKey || ''),
        status: typeof record.status === 'string' ? String(record.status) : undefined,
        createdAt: typeof record.createdAt === 'string' ? String(record.createdAt) : undefined,
        expiresAt: typeof record.expiresAt === 'string' ? String(record.expiresAt) : undefined,
        features:
          record.features && typeof record.features === 'object'
            ? (record.features as Record<string, unknown>)
            : undefined,
        maxActivations:
          typeof record.maxActivations === 'number' ? record.maxActivations : undefined,
        activations: Array.isArray(record.activations)
          ? record.activations
              .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null))
              .filter((a): a is Record<string, unknown> => a !== null)
              .map((a) => ({
                deviceId: typeof a.deviceId === 'string' ? String(a.deviceId) : undefined,
                at: typeof a.at === 'string' ? String(a.at) : undefined,
              }))
          : [],
        lastSeenAt: typeof record.lastSeenAt === 'string' ? String(record.lastSeenAt) : undefined,
        statusUpdatedAt:
          typeof record.statusUpdatedAt === 'string' ? String(record.statusUpdatedAt) : undefined,
        statusNote: typeof record.statusNote === 'string' ? String(record.statusNote) : undefined,
        afterSales:
          record.afterSales && typeof record.afterSales === 'object'
            ? (record.afterSales as AfterSales)
            : undefined,
        audit: Array.isArray(record.audit)
          ? record.audit
              .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null))
              .filter((a): a is Record<string, unknown> => a !== null)
              .map((a) => ({
                at: typeof a.at === 'string' ? String(a.at) : undefined,
                action: typeof a.action === 'string' ? String(a.action) : undefined,
                note: typeof a.note === 'string' ? String(a.note) : undefined,
                meta:
                  a.meta && typeof a.meta === 'object'
                    ? (a.meta as Record<string, unknown>)
                    : undefined,
              }))
          : [],
      };

      setSelectedRecord(parsed);
      setInfo('تم تحميل تفاصيل الترخيص');
      if (
        parsed.status === 'active' ||
        parsed.status === 'suspended' ||
        parsed.status === 'revoked'
      ) {
        setSetStatusValue(parsed.status);
      }
      setSetStatusNote(parsed.statusNote || '');

      const as = parsed.afterSales || {};
      const cust = as.customer || {};
      const fu = as.followUp || {};
      setCustomerName(String(cust.name || ''));
      setCustomerCompany(String(cust.company || ''));
      setCustomerPhone(String(cust.phone || ''));
      setCustomerCity(String(cust.city || ''));
      setAfterSalesNote(String(as.note || ''));
      setFollowUpStatus(String(fu.status || ''));
      setFollowUpLastContactAt(String(fu.lastContactAt || ''));
      setFollowUpNextAt(String(fu.nextAt || ''));
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to load record');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!canUseBridge) {
      setError('Desktop bridge not available. Run in Electron.');
      return;
    }
    if (!selectedKey) return;

    const ok = window.confirm(
      `تأكيد حذف الكود نهائياً؟\n\n${selectedKey}\n\nلا يمكن التراجع عن هذه العملية.`
    );
    if (!ok) return;

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.delete({ serverUrl, licenseKey: selectedKey });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      setSelectedKey('');
      setSelectedRecord(null);
      await refreshList();
      setInfo('تم حذف الكود');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    if (!canUseBridge) {
      setError('Desktop bridge not available. Run in Electron.');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.login({ username, password });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Login failed'));
      setLoggedIn(true);
      setInfo('تم تسجيل الدخول');
      await refreshTokenStatus();
      await refreshList();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Login failed');
      setLoggedIn(false);
    } finally {
      setBusy(false);
    }
  };

  const doSaveAdminToken = async () => {
    if (!canUseBridge) return;
    if (!loggedIn) {
      setError('يرجى تسجيل الدخول أولاً');
      return;
    }
    const t = serverAdminToken.trim();
    if (!t) {
      setError('يرجى إدخال توكن السيرفر');
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await window.desktopLicenseAdmin?.setAdminToken({ token: t, serverUrl });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      setInfo('تم حفظ توكن السيرفر');
      await refreshTokenStatus();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to save token');
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    if (!canUseBridge) return;
    setBusy(true);
    setError('');
    try {
      await window.desktopLicenseAdmin?.logout();
    } catch {
      // ignore
    } finally {
      setLoggedIn(false);
      setItems([]);
      setSelectedKey('');
      setSelectedRecord(null);
      setActivateResultJson('');
      setActivateMeta('');
      setStatusCheckResult('');
      setSavePath('');
      setInfo('');
      setError('');
      setBusy(false);
    }
  };

  const doIssue = async () => {
    if (!canUseBridge) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const maxActivations = Number(issueMaxActivations);
      const expiresAt = issueExpiresAt.trim();

      let features: Record<string, unknown> | undefined;
      const rawFeatures = issueFeaturesJson.trim();
      if (rawFeatures) {
        const parsed = JSON.parse(rawFeatures) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Features JSON must be an object.');
        }
        features = parsed as Record<string, unknown>;
      }

      const res = await window.desktopLicenseAdmin?.issue({
        serverUrl,
        maxActivations: Number.isFinite(maxActivations) ? maxActivations : undefined,
        expiresAt: expiresAt || undefined,
        features,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Issue failed'));

      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const licenseKey = typeof result.licenseKey === 'string' ? String(result.licenseKey) : '';
      if (licenseKey) {
        setQ(licenseKey);
        await refreshList();
        setSelectedKey(licenseKey);
        await loadRecord(licenseKey);
        void safeCopyToClipboard(licenseKey);
        setInfo('تم إصدار ترخيص جديد (وتم نسخ المفتاح)');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Issue failed');
    } finally {
      setBusy(false);
    }
  };

  const doSetStatus = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    if (!licenseKey) {
      setError('يرجى اختيار ترخيص أولاً');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.setStatus({
        serverUrl,
        licenseKey,
        status: setStatusValue,
        note: setStatusNote.trim() || undefined,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      await refreshList();
      await loadRecord(licenseKey);
      setInfo('تم تحديث حالة الترخيص');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  const doActivate = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    if (!licenseKey) {
      setError('يرجى اختيار ترخيص أولاً');
      return;
    }
    if (!deviceId) {
      setError('يرجى إدخال بصمة جهاز العميل (fingerprint)');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    setActivateResultJson('');
    setActivateMeta('');
    setSavePath('');
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.activate({ serverUrl, licenseKey, deviceId });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Activate failed'));

      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const signed =
        result.signedLicense && typeof result.signedLicense === 'object'
          ? (result.signedLicense as Record<string, unknown>)
          : null;

      if (!signed) throw new Error('استجابة السيرفر لا تحتوي signedLicense');

      // IMPORTANT: save the signed license object ONLY (payload+sig). This is what the client app expects.
      setActivateResultJson(JSON.stringify(signed, null, 2));
      const issuedAt = (() => {
        const payload =
          signed.payload && typeof signed.payload === 'object'
            ? (signed.payload as Record<string, unknown>)
            : null;
        return payload && typeof payload.issuedAt === 'string' ? String(payload.issuedAt) : '';
      })();
      const exp = (() => {
        const payload =
          signed.payload && typeof signed.payload === 'object'
            ? (signed.payload as Record<string, unknown>)
            : null;
        return payload && typeof payload.expiresAt === 'string' ? String(payload.expiresAt) : '';
      })();
      setActivateMeta(
        `تم إنشاء ملف ترخيص لجهاز: ${deviceId}${issuedAt ? ` — issuedAt: ${issuedAt}` : ''}${exp ? ` — expiresAt: ${exp}` : ''}`
      );
      await loadRecord(licenseKey);
      setInfo('تم إنشاء ملف الترخيص (جاهز للحفظ)');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Activate failed');
    } finally {
      setBusy(false);
    }
  };

  const refreshFpItems = () => setFpItems(loadFingerprintRegistry());

  const doSaveFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) {
      setError('يرجى إدخال بصمة جهاز العميل أولاً');
      return;
    }
    setError('');
    const next = upsertFingerprintRecord({
      fingerprint: fp,
      owner: fpOwner.trim(),
      comment: fpComment.trim(),
    });
    setFpItems(next);
    setInfo('تم حفظ بيانات البصمة');
  };

  const doCancelFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) {
      setError('يرجى إدخال/اختيار بصمة أولاً');
      return;
    }
    setError('');
    setFpItems(cancelFingerprintRecord(fp));
    setInfo('تم إلغاء البصمة (لن تُستخدم إلا إذا فعلتها مرة أخرى)');
  };

  const doDeleteFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) {
      setError('يرجى إدخال/اختيار بصمة أولاً');
      return;
    }
    setError('');
    setFpItems(deleteFingerprintRecord(fp));
    setInfo('تم حذف البصمة من السجل');
  };

  const doSaveLicenseFile = async () => {
    if (!canUseBridge) return;
    if (!activateResultJson.trim()) {
      setError('لا يوجد ملف ترخيص جاهز للحفظ');
      return;
    }

    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    const name = `azrar-license_${licenseKey || 'license'}_${deviceId || 'device'}.json`;

    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.saveLicenseFile({
        defaultFileName: name,
        content: activateResultJson,
        confirmPassword: exportConfirmPassword,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Save failed'));
      const p = typeof rec.filePath === 'string' ? String(rec.filePath) : '';
      setSavePath(p);
      setInfo('تم حفظ ملف الترخيص');
      setExportConfirmPassword('');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const doUnbindDeviceFromLicense = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    if (!licenseKey) {
      setError('يرجى اختيار ترخيص أولاً');
      return;
    }
    if (!deviceId) {
      setError('يرجى إدخال بصمة جهاز العميل (fingerprint)');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.unbindDevice({
        serverUrl,
        licenseKey,
        deviceId,
        note: fpComment.trim() || undefined,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      await refreshList();
      await loadRecord(licenseKey);
      setInfo('تم فصل الترخيص عن هذا الجهاز. يمكن للعميل التفعيل على جهاز آخر الآن.');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to unbind device');
    } finally {
      setBusy(false);
    }
  };

  const doUpdateAfterSales = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    if (!licenseKey) {
      setError('يرجى اختيار ترخيص أولاً');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const patch = {
        customer: {
          name: customerName.trim() || undefined,
          company: customerCompany.trim() || undefined,
          phone: customerPhone.trim() || undefined,
          city: customerCity.trim() || undefined,
        },
        note: afterSalesNote,
        followUp: {
          status: followUpStatus || undefined,
          lastContactAt: followUpLastContactAt.trim() || undefined,
          nextAt: followUpNextAt.trim() || undefined,
        },
        logNote: afterSalesLogNote.trim() || undefined,
      };

      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.updateAfterSales({
        serverUrl,
        licenseKey,
        patch,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      await refreshList();
      await loadRecord(licenseKey);
      setAfterSalesLogNote('');
      setInfo('تم تحديث بيانات ما بعد البيع');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const doCheckDeviceStatus = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = statusCheckDeviceId.trim();
    if (!licenseKey) {
      setError('يرجى اختيار ترخيص أولاً');
      return;
    }
    if (!deviceId) {
      setError('يرجى إدخال بصمة جهاز العميل (fingerprint)');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    setStatusCheckResult('');
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.checkStatus({ serverUrl, licenseKey, deviceId });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      setStatusCheckResult(JSON.stringify(result, null, 2));
      setInfo('تم جلب حالة الجهاز');
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to check status');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setSelectedRecord(null);
    setActivateResultJson('');
    setActivateMeta('');
    setSavePath('');
    setStatusCheckResult('');
    if (loggedIn && selectedKey) {
      void loadRecord(selectedKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const applyIssueDuration = (duration: IssueDuration) => {
    setIssueDuration(duration);
    if (duration === 'custom') return;
    setIssueExpiresAt(computeExpiresAtFromDuration(duration));
  };
  
  // --- Customers Logic ---
  const customerGroups = useMemo(() => {
    const byKey = new Map<string, { label: string; company?: string; name?: string; phone?: string; city?: string; items: AdminListItem[] }>();
    const norm = (v: unknown) => String(v ?? '').trim();
    
    for (const it of items) {
      const company = norm(it.customerCompany);
      const name = norm(it.customerName);
      const phone = norm(it.customerPhone);
      const city = norm(it.customerCity);
      const k = [company, name, phone, city].filter(Boolean).join(' | ') || 'بدون بيانات';
      
      if (!byKey.has(k)) {
        byKey.set(k, {
          label: company || name || 'عميل غير مسجل',
          company: company || undefined,
          name: name || undefined,
          phone: phone || undefined,
          city: city || undefined,
          items: [it]
        });
      } else {
        byKey.get(k)?.items.push(it);
      }
    }
    
    const out = Array.from(byKey.values());
    out.sort((a,b) => b.items.length - a.items.length || a.label.localeCompare(b.label, 'ar'));
    return out;
  }, [items]);

  const filteredCustomerGroups = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customerGroups;
    return customerGroups.filter(g => 
      g.label.toLowerCase().includes(q) || 
      g.company?.toLowerCase().includes(q) || 
      g.phone?.includes(q)
    );
  }, [customerGroups, customerSearch]);

  // --- Server User Settings Logic ---
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const doUpdateServerUser = async () => {
    if (!canUseBridge) return;
    const u = newUsername.trim();
    if (!u) {
      toast.error('اسم المستخدم مطلوب');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.updateUser({
        username: u,
        newPassword: newPassword || undefined
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      toast.success('تم تحديث بيانات الدخول للسيرفر');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل التحديث');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Globe className="text-indigo-600" size={28} />
              مركز إدارة التراخيص (Hub)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              إدارة تفعيل الأنظمة، متابعة العملاء، وإعدادات خادم الترخيص المركزي.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void refreshList()} disabled={busy || !loggedIn}>
              <Activity size={16} className={busy ? 'animate-spin' : ''} />
              تحديث البيانات
            </Button>
            {loggedIn && (
              <Button variant="danger" onClick={() => void doLogout()}>
                <LogOut size={16} />
                خروج
              </Button>
            )}
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          {[
            { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
            { id: 'licenses', label: 'إدارة التراخيص', icon: Key },
            { id: 'customers', label: 'العملاء والمتابعة', icon: CustomersIcon },
            { id: 'settings', label: 'إعدادات الحساب', icon: SettingsIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error/Info Banner */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3 transition-all animate-shake">
            <ShieldCheck size={20} />
            {error}
          </div>
        )}

        {/* Content Area */}
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                {/* Server Selection */}
                <Card className="p-6 rounded-3xl space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Globe size={20} className="text-indigo-600" />
                    خوادم الترخيص المتاحة
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      {servers.map((s) => (
                        <div
                          key={s}
                          onClick={() => setServerUrl(s)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                            serverUrl === s
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`p-2 rounded-xl ${serverUrl === s ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Globe size={16} />
                            </div>
                            <span className="text-sm font-bold truncate">{s}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); doRemoveServer(s); }}
                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-full text-slate-400">
                        <Plus size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold">إضافة خادم جديد</p>
                        <p className="text-[10px] text-slate-400">يمكنك إضافة روابط خوادم تفعيل أخرى</p>
                      </div>
                      <div className="w-full space-y-2">
                        <Input
                          value={newServer}
                          onChange={(e) => setNewServer(e.target.value)}
                          placeholder="https://license.yoursite.com"
                        />
                        <Button onClick={doAddServer} className="w-full">إضافة للسجل</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                {/* Login Status */}
                <Card className="p-6 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Key size={20} className="text-indigo-600" />
                        حالة الدخول
                      </h3>
                      <StatusBadge status={loggedIn ? 'متصل' : 'غير متصل'} />
                    </div>

                    {!loggedIn ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 px-1">اسم المستخدم (Admin)</label>
                          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 px-1">كلمة المرور</label>
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        </div>
                        <Button onClick={() => void doLogin()} isLoading={busy} className="w-full py-6 text-lg">
                          تسجيل الدخول للسيرفر
                        </Button>
                      </div>
                    ) : (
                      <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
                          <ShieldCheck size={32} />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-800 dark:text-emerald-300">أنت الآن في وضع التحكم</p>
                          <p className="text-[10px] text-emerald-600/70 mt-1">يمكنك إدارة التراخيص والعملاء عبر التبويبات أعلاه.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="space-y-6">
              {!loggedIn ? (
                <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <Key size={48} className="mx-auto text-slate-300" />
                  <p className="text-slate-500">يرجى تسجيل الدخول أولاً من لوحة التحكم للوصول لإدارة التراخيص.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Management */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <Card className="p-6 rounded-3xl space-y-6">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Activity size={20} className="text-indigo-600" />
                          قائمة المفاتيح المصدرة
                        </h3>
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                          <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <Input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && refreshList()}
                              placeholder="بحث برقم الكود أو الاسم..."
                              className="pr-10"
                            />
                          </div>
                          <Button onClick={() => void refreshList()} disabled={busy}>تحديث</Button>
                        </div>
                      </div>

                      <div className="app-table-wrapper rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="app-table">
                          <thead className="app-table-thead">
                            <tr>
                              <th className="app-table-th">المفتاح</th>
                              <th className="app-table-th">العميل</th>
                              <th className="app-table-th text-center">الحالة</th>
                              <th className="app-table-th text-center">التفعيل</th>
                              <th className="app-table-th text-center">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                            {items.slice(0, 50).map((it) => (
                              <tr
                                key={it.licenseKey}
                                onClick={() => setSelectedKey(it.licenseKey)}
                                className={`app-table-row group transition-all cursor-pointer ${
                                  selectedKey === it.licenseKey ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                                }`}
                              >
                                <td className="app-table-td">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded">
                                      <Key size={12} />
                                    </div>
                                    <span className="font-mono text-xs font-black" dir="ltr">{it.licenseKey}</span>
                                  </div>
                                </td>
                                <td className="app-table-td">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold">{it.customerName || '—'}</span>
                                    <span className="text-[10px] text-slate-400">{it.customerCompany || 'بدون شركة'}</span>
                                  </div>
                                </td>
                                <td className="app-table-td text-center">
                                  <StatusBadge status={licenseStatusToArabic(it.status || '')} className="!text-[10px] !px-2 !py-0.5" />
                                </td>
                                <td className="app-table-td text-center">
                                  <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                    {it.activationsCount || 0} / {it.maxActivations || '—'}
                                  </span>
                                </td>
                                <td className="app-table-td">
                                  <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-indigo-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                      <Info size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: Actions & Details */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Issue New */}
                    <Card className="p-6 rounded-3xl space-y-4 border-2 border-indigo-100 dark:border-indigo-900/30">
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Plus size={18} className="text-indigo-600" />
                        إصدار مفتاح جديد
                      </h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">الأجهزة (Max)</label>
                            <Input type="number" value={issueMaxActivations} onChange={(e) => setIssueMaxActivations(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">المدة</label>
                            <Select
                              value={issueDuration}
                              onChange={(e) => applyIssueDuration(e.target.value as IssueDuration)}
                              options={[
                                { value: 'trial14d', label: 'تجريبي 14 يوم' },
                                { value: '1m', label: 'شهر واحد' },
                                { value: '3m', label: '3 أشهر' },
                                { value: '6m', label: '6 أشهر' },
                                { value: '1y', label: 'سنة كاملة' },
                                { value: 'custom', label: 'مخصص' },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الانتهاء</label>
                          <Input type="date" value={issueExpiresAt} onChange={(e) => setIssueExpiresAt(e.target.value)} />
                        </div>
                        <Button onClick={() => void doIssue()} isLoading={busy} className="w-full">إصدار الآن</Button>
                      </div>
                    </Card>

                    {/* Selected Item Details (Drawer alternative) */}
                    {selectedRecord && (
                      <Card className="p-6 rounded-3xl space-y-6 border-l-4 border-l-indigo-600 animate-slide-left">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-slate-800 dark:text-white">تفاصيل: {selectedKey.slice(0, 8)}...</h4>
                          <button onClick={() => void doDelete()} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                            <span className="text-xs text-slate-500">حالة الكود</span>
                            <Select
                              className="w-32 !py-1 !px-2 !text-xs"
                              value={setStatusValue}
                              onChange={(e) => setSetStatusValue(e.target.value as any)}
                              options={[
                                { value: 'active', label: 'فعال' },
                                { value: 'suspended', label: 'معلق' },
                                { value: 'revoked', label: 'ملغي' },
                              ]}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase px-1">بصمة العميل (تفعيل)</label>
                            <div className="flex gap-2">
                              <Input
                                value={activateDeviceId}
                                onChange={(e) => setActivateDeviceId(e.target.value)}
                                placeholder="Fingerprint..."
                                className="font-mono text-xs"
                              />
                              <Button variant="secondary" onClick={() => void doActivate()} disabled={busy}><Smartphone size={16} /></Button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase px-1">بيانات العميل (تعديل سريع)</label>
                            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسم العميل" className="text-xs" />
                            <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="اسم المكتب/الشركة" className="text-xs" />
                          </div>

                          <Button onClick={() => void doUpdateAfterSales()} isLoading={busy} className="w-full" variant="secondary">حفظ التعديلات</Button>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <Card className="p-6 rounded-3xl space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                      <CustomersIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">قائمة العملاء النشطين</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">تجميع المفاتيح الصادرة حسب بيانات كل عميل.</p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="بحث بالاسم أو الشركة..."
                      className="pr-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCustomerGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className="app-card p-5 rounded-3xl space-y-4 hover:shadow-lg transition-all border border-slate-100 dark:border-slate-800 group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 dark:text-white truncate" title={g.label}>{g.label}</h4>
                          <p className="text-xs text-slate-400 mt-1 truncate">{g.company || 'فردي'}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-black">
                          {g.items.length} كود
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {g.items.slice(0, 3).map(it => (
                          <div key={it.licenseKey} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="font-mono" dir="ltr">{it.licenseKey.slice(0, 8)}...</span>
                            <StatusBadge status={licenseStatusToArabic(it.status || '')} className="!text-[9px] !px-1.5 !py-0" />
                          </div>
                        ))}
                        {g.items.length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center">+ {g.items.length - 3} رموز أخرى</p>
                        )}
                      </div>

                      <button
                        onClick={() => { setActiveTab('licenses'); setQ(g.label); refreshList(); }}
                        className="w-full py-2 rounded-xl text-xs font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all border border-indigo-100 dark:border-indigo-900/30"
                      >
                        عرض كافة التفاصيل
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="p-8 rounded-3xl space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <SettingsIcon size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">إعدادات ملف المشغل (Server Admin)</h3>
                  <p className="text-sm text-slate-500">تعديل بيانات الدخول الخاصة بك لهذا الخادم فقط.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اسم المستخدم الجديد</label>
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="admin_new"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">كلمة المرور الجديدة</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">تأكيد كلمة المرور</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex gap-3 text-amber-700 dark:text-amber-400">
                      <History size={20} className="shrink-0" />
                      <p className="text-xs leading-relaxed">
                        ⚠️ تنبيه: تغيير كلمة المرور سيؤدي إلى إنهاء الجلسة الحالية. سيتعين عليك تسجيل الدخول مرة أخرى بالبيانات الجديدة.
                      </p>
                    </div>
                  </div>

                  <Button onClick={() => void doUpdateServerUser()} isLoading={busy} className="w-full py-6 text-lg">
                    <Save size={18} className="ml-2" />
                    حفظ وتحديث الحساب
                  </Button>
                </div>
              </Card>

              {/* Server Info / Token Area */}
              <Card className="p-6 rounded-3xl space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Key size={18} className="text-indigo-600" />
                  توكن الأمان للسيرفر (Admin Token)
                </h4>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={serverAdminToken}
                    onChange={(e) => setServerAdminToken(e.target.value)}
                    placeholder="الصق التوكن هنا..."
                  />
                  <Button onClick={() => void doSaveAdminToken()} isLoading={busy} variant="secondary">حفظ التوكن</Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  * هذا التوكن يستخدم للمصادقة بين تطبيقك وسيرفر التراخيص المركزي. تأكد من تطابقه مع توكن السيرفر.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseAdmin;

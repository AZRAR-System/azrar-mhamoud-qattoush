import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { ROUTE_PATHS } from '@/routes/paths';
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

const fmt = (iso?: string) => {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toLocaleString();
};

const getErr = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  return String(e || '');
};

const statusToArabic = (s?: string): string => {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'active') return 'نشط';
  if (v === 'suspended') return 'معلق';
  if (v === 'revoked') return 'ملغي';
  if (v === 'expired') return 'منتهي';
  if (v === 'mismatch') return 'غير مطابق';
  return s || '';
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

export const LicenseAdmin: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5056');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [serverAdminToken, setServerAdminToken] = useState('');
  const [serverAdminTokenConfigured, setServerAdminTokenConfigured] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [info, setInfo] = useState('');

  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<AdminRecord | null>(null);

  const [issueMaxActivations, setIssueMaxActivations] = useState('1');
  const [issueExpiresAt, setIssueExpiresAt] = useState('');
  const [issueDuration, setIssueDuration] = useState<IssueDuration>('custom');
  const [issueFeaturesJson, setIssueFeaturesJson] = useState('');

  const [setStatusValue, setSetStatusValue] = useState<'active' | 'suspended' | 'revoked'>('active');
  const [setStatusNote, setSetStatusNote] = useState('');

  const [activateDeviceId, setActivateDeviceId] = useState('');
  const [activateResultJson, setActivateResultJson] = useState('');
  const [activateMeta, setActivateMeta] = useState('');
  const [savePath, setSavePath] = useState('');

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

      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
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
          statusUpdatedAt: typeof r.statusUpdatedAt === 'string' ? String(r.statusUpdatedAt) : undefined,
          statusNote: typeof r.statusNote === 'string' ? String(r.statusNote) : undefined,
          customerName: typeof r.customerName === 'string' ? String(r.customerName) : undefined,
          customerCompany: typeof r.customerCompany === 'string' ? String(r.customerCompany) : undefined,
          customerPhone: typeof r.customerPhone === 'string' ? String(r.customerPhone) : undefined,
          customerCity: typeof r.customerCity === 'string' ? String(r.customerCity) : undefined,
        }))
        .filter((x) => x.licenseKey);

      setItems(parsed);
      setInfo(`تم تحميل ${parsed.length} ترخيص`);
    } catch (e: unknown) {
      const msg = getErr(e) || 'Failed to refresh';
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

      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const record = result.record && typeof result.record === 'object' ? (result.record as Record<string, unknown>) : {};

      const parsed: AdminRecord = {
        licenseKey: String(record.licenseKey || ''),
        status: typeof record.status === 'string' ? String(record.status) : undefined,
        createdAt: typeof record.createdAt === 'string' ? String(record.createdAt) : undefined,
        expiresAt: typeof record.expiresAt === 'string' ? String(record.expiresAt) : undefined,
        features: record.features && typeof record.features === 'object' ? (record.features as Record<string, unknown>) : undefined,
        maxActivations: typeof record.maxActivations === 'number' ? record.maxActivations : undefined,
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
        statusUpdatedAt: typeof record.statusUpdatedAt === 'string' ? String(record.statusUpdatedAt) : undefined,
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
                meta: a.meta && typeof a.meta === 'object' ? (a.meta as Record<string, unknown>) : undefined,
              }))
          : [],
      };

      setSelectedRecord(parsed);
      setInfo('تم تحميل تفاصيل الترخيص');
      if (parsed.status === 'active' || parsed.status === 'suspended' || parsed.status === 'revoked') {
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
      setError(getErr(e) || 'Failed to load record');
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

    const ok = window.confirm(`تأكيد حذف الكود نهائياً؟\n\n${selectedKey}\n\nلا يمكن التراجع عن هذه العملية.`);
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
      setError(getErr(e) || 'Failed to delete');
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
      setError(getErr(e) || 'Login failed');
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
      setError(getErr(e) || 'Failed to save token');
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

      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
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
      setError(getErr(e) || 'Issue failed');
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
      setError(getErr(e) || 'Failed to update status');
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

      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const signed = result.signedLicense && typeof result.signedLicense === 'object'
        ? (result.signedLicense as Record<string, unknown>)
        : null;

      if (!signed) throw new Error('استجابة السيرفر لا تحتوي signedLicense');

      // IMPORTANT: save the signed license object ONLY (payload+sig). This is what the client app expects.
      setActivateResultJson(JSON.stringify(signed, null, 2));
      const issuedAt = (() => {
        const payload = signed.payload && typeof signed.payload === 'object' ? (signed.payload as Record<string, unknown>) : null;
        return payload && typeof payload.issuedAt === 'string' ? String(payload.issuedAt) : '';
      })();
      const exp = (() => {
        const payload = signed.payload && typeof signed.payload === 'object' ? (signed.payload as Record<string, unknown>) : null;
        return payload && typeof payload.expiresAt === 'string' ? String(payload.expiresAt) : '';
      })();
      setActivateMeta(`تم إنشاء ملف ترخيص لجهاز: ${deviceId}${issuedAt ? ` — issuedAt: ${issuedAt}` : ''}${exp ? ` — expiresAt: ${exp}` : ''}`);
      await loadRecord(licenseKey);
      setInfo('تم إنشاء ملف الترخيص (جاهز للحفظ)');
    } catch (e: unknown) {
      setError(getErr(e) || 'Activate failed');
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
    const next = upsertFingerprintRecord({ fingerprint: fp, owner: fpOwner.trim(), comment: fpComment.trim() });
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
      setError(getErr(e) || 'Save failed');
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
      setError(getErr(e) || 'Failed to unbind device');
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
      const res = await window.desktopLicenseAdmin.updateAfterSales({ serverUrl, licenseKey, patch });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      await refreshList();
      await loadRecord(licenseKey);
      setAfterSalesLogNote('');
      setInfo('تم تحديث بيانات ما بعد البيع');
    } catch (e: unknown) {
      setError(getErr(e) || 'Failed to update');
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
      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      setStatusCheckResult(JSON.stringify(result, null, 2));
      setInfo('تم جلب حالة الجهاز');
    } catch (e: unknown) {
      setError(getErr(e) || 'Failed to check status');
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

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">إدارة التراخيص</h1>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            إدارة الأكواد والأجهزة + متابعة ما بعد البيع (بيانات عميل / ملاحظات / مواعيد)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={ROUTE_PATHS.LICENSE_ADMIN}>
            <Button variant="secondary" disabled={busy}>
              لوحة التحكم
            </Button>
          </Link>
          {loggedIn ? (
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_USERS}>
              <Button variant="secondary" disabled={busy}>
                المستخدمين
              </Button>
            </Link>
          ) : null}
          {loggedIn ? (
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_CUSTOMERS}>
              <Button variant="secondary" disabled={busy}>
                العملاء
              </Button>
            </Link>
          ) : null}
          {loggedIn ? (
            <Button variant="secondary" onClick={() => void doLogout()} disabled={busy}>
              تسجيل الخروج
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">رابط سيرفر التفعيل</div>
            <Input
              value={serverUrl}
              onChange={(e) => {
                const nextRaw = e.target.value;
                setServerUrl(nextRaw);
                const origin = normalizeServerOrigin(nextRaw);
                if (origin) {
                  const st = loadLicenseAdminServerSettings();
                  saveLicenseAdminSelectedServer(origin);
                  saveLicenseAdminServers(Array.from(new Set([origin, ...st.servers])));
                }
              }}
              placeholder="http://127.0.0.1:5056"
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">اسم المستخدم</div>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" disabled={loggedIn} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">كلمة مرور الأدمن</div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              disabled={loggedIn}
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">توكن السيرفر</div>
            <Input
              value={serverAdminToken}
              onChange={(e) => setServerAdminToken(e.target.value)}
              placeholder="X-Admin-Token"
              type="password"
              disabled={busy}
            />
            {loggedIn ? (
              <div className="mt-2 flex items-center gap-2">
                <Button variant="secondary" onClick={() => void doSaveAdminToken()} disabled={busy}>
                  حفظ التوكن
                </Button>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  الحالة: {serverAdminTokenConfigured === null ? '—' : serverAdminTokenConfigured ? 'مُعد' : 'غير مُعد'}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!loggedIn ? (
            <Button onClick={() => void doLogin()} disabled={busy}>
              دخول
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void refreshList()} disabled={busy}>
              تحديث القائمة
            </Button>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {canUseBridge ? (loggedIn ? 'الحالة: مُسجل دخول' : 'الحالة: غير مُسجل') : 'هذه الصفحة تعمل داخل Electron فقط'}
          </div>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {info ? <div className="text-sm text-slate-600 dark:text-slate-300">{info}</div> : null}
      </Card>

      {loggedIn ? (
        <Card className="p-4 space-y-3 overflow-visible">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">إصدار ترخيص جديد</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">عدد الأجهزة المسموح (maxActivations)</div>
              <Input value={issueMaxActivations} onChange={(e) => setIssueMaxActivations(e.target.value)} placeholder="1" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">مدة الاشتراك</div>
              <Select
                value={issueDuration}
                onChange={(e) => applyIssueDuration(String(e.target.value) as IssueDuration)}
                disabled={busy}
                options={[
                  { value: 'trial14d', label: 'تجربة 14 يوم' },
                  { value: '1m', label: 'شهر' },
                  { value: '3m', label: '3 شهور' },
                  { value: '6m', label: '6 شهور' },
                  { value: '1y', label: 'سنة' },
                  { value: '', label: 'بدون انتهاء' },
                  { value: 'custom', label: 'مخصص (يدوي)' },
                ]}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">تاريخ الانتهاء (expiresAt)</div>
              <Input
                value={issueExpiresAt}
                onChange={(e) => {
                  setIssueExpiresAt(e.target.value);
                  setIssueDuration('custom');
                }}
                placeholder="2026-02-10"
                dir="ltr"
                lang="en"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">المزايا (features JSON)</div>
              <Input
                value={issueFeaturesJson}
                onChange={(e) => setIssueFeaturesJson(e.target.value)}
                placeholder='{"featureA": true}'
                dir="ltr"
                lang="en"
                className="font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
          <div>
            <Button onClick={() => void doIssue()} disabled={busy}>
              إصدار الترخيص + نسخ المفتاح
            </Button>
          </div>
        </Card>
      ) : null}

      {loggedIn ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">قائمة التراخيص</div>
              <div className="flex items-center gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="بحث بالمفتاح (licenseKey)"
                  className="min-w-[16rem]"
                />
                <Button variant="secondary" onClick={() => void refreshList()} disabled={busy}>
                  بحث
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                {items.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 text-center">لا توجد بيانات</div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((it) => {
                      const active = it.licenseKey === selectedKey;
                      const customerLabel =
                        String(it.customerCompany || '').trim() || String(it.customerName || '').trim() || '';
                      return (
                        <button
                          key={it.licenseKey}
                          type="button"
                          className={`w-full text-right p-3 transition-colors ${
                            active
                              ? 'bg-indigo-50 dark:bg-indigo-950/20'
                              : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/20'
                          }`}
                          onClick={() => setSelectedKey(it.licenseKey)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-mono text-xs overflow-x-auto whitespace-nowrap" dir="ltr" title={it.licenseKey}>
                                {it.licenseKey}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                                <span className="whitespace-nowrap">الإنشاء: {it.createdAt ? fmt(it.createdAt) : '—'}</span>
                                <span className="whitespace-nowrap">الانتهاء: {it.expiresAt ? fmt(it.expiresAt) : '—'}</span>
                                <span className="whitespace-nowrap">
                                  الأجهزة: {typeof it.activationsCount === 'number' ? it.activationsCount : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {it.status ? <StatusBadge status={statusToArabic(it.status)} /> : null}
                              {customerLabel ? (
                                <div className="text-xs text-slate-600 dark:text-slate-300 max-w-[12rem] truncate" title={customerLabel}>
                                  {customerLabel}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">تفاصيل الترخيص</div>
              {selectedKey ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void safeCopyToClipboard(selectedKey);
                    }}
                    disabled={!selectedKey}
                  >
                    نسخ المفتاح
                  </Button>
                  <Button variant="danger" onClick={() => void doDelete()} disabled={busy || !selectedKey}>
                    حذف الكود
                  </Button>
                </div>
              ) : null}
            </div>

            {!selectedKey ? (
              <div className="text-sm text-slate-500">اختر ترخيصاً من القائمة</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">licenseKey</div>
                    <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 px-2 py-1 overflow-x-auto">
                      <span className="font-mono text-xs whitespace-nowrap" dir="ltr">
                        {selectedKey}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">status</div>
                    <div>
                      {(selectedRecord?.status || selectedItem?.status) ? (
                        <StatusBadge status={statusToArabic(selectedRecord?.status || selectedItem?.status)} />
                      ) : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">createdAt</div>
                    <div>{selectedRecord?.createdAt ? fmt(selectedRecord.createdAt) : selectedItem?.createdAt ? fmt(selectedItem.createdAt) : ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">expiresAt</div>
                    <div>{selectedRecord?.expiresAt ? fmt(selectedRecord.expiresAt) : selectedItem?.expiresAt ? fmt(selectedItem.expiresAt) : ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">maxActivations</div>
                    <div>{typeof selectedRecord?.maxActivations === 'number' ? selectedRecord.maxActivations : selectedItem?.maxActivations ?? ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">activationsCount</div>
                    <div>{selectedRecord?.activations?.length ?? selectedItem?.activationsCount ?? ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">lastSeenAt</div>
                    <div>{selectedRecord?.lastSeenAt ? fmt(selectedRecord.lastSeenAt) : ''}</div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">المزايا (Features)</div>
                  <textarea
                    className="w-full h-28 p-2 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-x-auto"
                    value={selectedRecord?.features ? JSON.stringify(selectedRecord.features, null, 2) : ''}
                    readOnly
                    placeholder="لا يوجد"
                    dir="ltr"
                    wrap="off"
                    spellCheck={false}
                  />
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">تغيير الحالة</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={setStatusValue}
                      onChange={(e) => setSetStatusValue(String(e.target.value) as 'active' | 'suspended' | 'revoked')}
                      disabled={busy}
                      options={[
                        { value: 'active', label: 'نشط' },
                        { value: 'suspended', label: 'معلق' },
                        { value: 'revoked', label: 'ملغي' },
                      ]}
                    />
                    <Input
                      value={setStatusNote}
                      onChange={(e) => setSetStatusNote(e.target.value)}
                      placeholder="ملاحظة (اختياري)"
                      disabled={busy}
                    />
                    <Button variant="secondary" onClick={() => void doSetStatus()} disabled={busy}>
                      تطبيق
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    آخر تغيير: {selectedRecord?.statusUpdatedAt ? fmt(selectedRecord.statusUpdatedAt) : selectedItem?.statusUpdatedAt ? fmt(selectedItem.statusUpdatedAt) : ''}
                    {selectedRecord?.statusNote || selectedItem?.statusNote ? ` — ${selectedRecord?.statusNote || selectedItem?.statusNote}` : ''}
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">ما بعد البيع</div>
                    <div className="text-xs text-slate-500">
                      آخر تحديث: {selectedRecord?.afterSales?.updatedAt ? fmt(selectedRecord.afterSales.updatedAt) : '—'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">اسم العميل</div>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="مثال: أحمد محمد" disabled={busy} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">اسم الشركة</div>
                      <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="مثال: مؤسسة ..." disabled={busy} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">الهاتف</div>
                      <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05xxxxxxxx" disabled={busy} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">المدينة</div>
                      <Input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} placeholder="الرياض" disabled={busy} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">حالة المتابعة</div>
                      <Select
                        value={followUpStatus}
                        onChange={(e) => setFollowUpStatus(String(e.target.value))}
                        disabled={busy}
                        options={followUpStatusOptions}
                        placeholder="اختر"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">آخر تواصل (ISO)</div>
                      <Input
                        value={followUpLastContactAt}
                        onChange={(e) => setFollowUpLastContactAt(e.target.value)}
                        placeholder="2026-02-09T12:00:00.000Z"
                        disabled={busy}
                        dir="ltr"
                        lang="en"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">موعد المتابعة القادم (ISO)</div>
                      <Input
                        value={followUpNextAt}
                        onChange={(e) => setFollowUpNextAt(e.target.value)}
                        placeholder="2026-02-15T10:00:00.000Z"
                        disabled={busy}
                        dir="ltr"
                        lang="en"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-1">ملاحظات الدعم (داخلية)</div>
                    <textarea
                      className="w-full min-h-28 p-3 text-sm rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35"
                      value={afterSalesNote}
                      onChange={(e) => setAfterSalesNote(e.target.value)}
                      placeholder="اكتب ملخص الحالة/المشكلة/ما تم عمله..."
                      disabled={busy}
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={afterSalesLogNote}
                      onChange={(e) => setAfterSalesLogNote(e.target.value)}
                      placeholder="سبب التحديث (اختياري يظهر في سجل الإجراءات)"
                      disabled={busy}
                    />
                    <Button variant="secondary" onClick={() => void doUpdateAfterSales()} disabled={busy}>
                      حفظ بيانات ما بعد البيع
                    </Button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">التفعيل (أونلاين / ملف Offline)</div>
                  <div className="text-xs text-slate-500">
                    الصق بصمة جهاز العميل (fingerprint) ثم اكتب اسم العميل وتعليق. بعدها اختر:
                    <br />- إنشاء ملف تفعيل Offline (JSON) للحفظ والإرسال للعميل
                    <br />- أو حفظ البصمة في السجل لتسهيل العمل لاحقاً
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-1">
                      <div className="text-xs text-slate-500 mb-1">اسم/جهة العميل</div>
                      <Input
                        value={fpOwner}
                        onChange={(e) => setFpOwner(e.target.value)}
                        placeholder="مثال: أبو أحمد / شركة كذا"
                        disabled={busy}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-slate-500 mb-1">تعليق</div>
                      <Input
                        value={fpComment}
                        onChange={(e) => setFpComment(e.target.value)}
                        placeholder="مثال: تم إرسال الملف عبر واتساب"
                        disabled={busy}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={activateDeviceId}
                      onChange={(e) => setActivateDeviceId(e.target.value)}
                      placeholder="fingerprint (الصقه من جهاز العميل)"
                      disabled={busy}
                    />
                    <Button onClick={() => void doActivate()} disabled={busy}>
                      إنشاء ملف تفعيل Offline
                    </Button>
                    <Button variant="secondary" onClick={() => void doUnbindDeviceFromLicense()} disabled={busy}>
                      فصل الترخيص عن هذا الجهاز
                    </Button>
                    <Button variant="secondary" onClick={() => doSaveFingerprint()} disabled={busy}>
                      حفظ البصمة
                    </Button>
                    <Button variant="secondary" onClick={() => doCancelFingerprint()} disabled={busy}>
                      إلغاء
                    </Button>
                    <Button variant="secondary" onClick={() => doDeleteFingerprint()} disabled={busy}>
                      حذف
                    </Button>
                  </div>

                  {fpItems.length ? (
                    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/20 p-2">
                      <div className="text-xs text-slate-500 mb-2">سجل البصمات المحفوظة على هذا الجهاز</div>
                      <div className="space-y-1">
                        {fpItems.slice(0, 20).map((it) => (
                          <div key={it.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {it.owner || 'بدون اسم'}
                              </div>
                              <div className="text-[11px] text-slate-500 break-all">{it.fingerprint}</div>
                              {it.comment ? <div className="text-xs text-slate-500 truncate">{it.comment}</div> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge
                                status={it.status === 'cancelled' ? 'ملغي' : 'نشط'}
                              />
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setActivateDeviceId(it.fingerprint);
                                  setFpOwner(it.owner || '');
                                  setFpComment(it.comment || '');
                                }}
                                disabled={busy}
                              >
                                اختيار
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => void safeCopyToClipboard(it.fingerprint)}
                                disabled={busy}
                              >
                                نسخ
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setFpItems(cancelFingerprintRecord(it.id));
                                  refreshFpItems();
                                }}
                                disabled={busy}
                              >
                                إلغاء
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setFpItems(deleteFingerprintRecord(it.id));
                                  refreshFpItems();
                                }}
                                disabled={busy}
                              >
                                حذف
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {fpItems.length > 20 ? (
                        <div className="mt-2 text-[11px] text-slate-500">عرض 20 فقط (لتسريع الواجهة).</div>
                      ) : null}
                    </div>
                  ) : null}

                  {activateMeta ? (
                    <div className="text-xs text-slate-500 whitespace-normal break-words">{activateMeta}</div>
                  ) : null}

                  {activateResultJson ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">كلمة المرور قبل تنزيل/حفظ الملف</div>
                          <Input
                            value={exportConfirmPassword}
                            onChange={(e) => setExportConfirmPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور للتأكيد"
                            type="password"
                            disabled={busy}
                          />
                        </div>
                        <div className="text-xs text-slate-500 self-end">
                          لن يتم حفظ الملف بدون إدخال كلمة المرور.
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          onClick={() => void safeCopyToClipboard(activateResultJson)}
                          disabled={busy}
                        >
                          نسخ ملف الترخيص (JSON)
                        </Button>
                        <Button variant="secondary" onClick={() => void doSaveLicenseFile()} disabled={busy}>
                          حفظ الملف
                        </Button>
                        {savePath ? <div className="text-xs text-slate-500">تم الحفظ: {savePath}</div> : null}
                      </div>
                      <textarea
                        className="w-full h-48 p-2 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-x-auto"
                        value={activateResultJson}
                        readOnly
                        dir="ltr"
                        wrap="off"
                        spellCheck={false}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">تحقق حالة جهاز (Status Check)</div>
                  <div className="text-xs text-slate-500">
                    يفيد للتأكد هل الجهاز مربوط لهذا الترخيص أم سيظهر mismatch / suspended / revoked.
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={statusCheckDeviceId}
                      onChange={(e) => setStatusCheckDeviceId(e.target.value)}
                      placeholder="fingerprint (الصقه من جهاز العميل)"
                      disabled={busy}
                    />
                    <Button variant="secondary" onClick={() => void doCheckDeviceStatus()} disabled={busy}>
                      تحقق
                    </Button>
                    {statusCheckResult ? (
                      <Button
                        variant="secondary"
                        onClick={() => void safeCopyToClipboard(statusCheckResult)}
                        disabled={busy}
                      >
                        نسخ النتيجة
                      </Button>
                    ) : null}
                  </div>
                  {statusCheckResult ? (
                    <textarea
                      className="w-full h-36 p-2 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-x-auto"
                      value={statusCheckResult}
                      readOnly
                      dir="ltr"
                      wrap="off"
                      spellCheck={false}
                    />
                  ) : null}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">سجل التفعيلات</div>
                  {selectedRecord?.activations && selectedRecord.activations.length ? (
                    <div className="space-y-1 text-sm">
                      {selectedRecord.activations.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <div className="font-mono break-all">{a.deviceId || ''}</div>
                          <div className="text-xs text-slate-500">{a.at ? fmt(a.at) : ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">لا يوجد</div>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">سجل الإجراءات</div>
                  {selectedRecord?.audit && selectedRecord.audit.length ? (
                    <div className="space-y-2 text-sm">
                      {selectedRecord.audit.slice(0, 30).map((a, idx) => (
                        <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
                              {a.action || ''}
                            </div>
                            <div className="text-xs text-slate-500">{a.at ? fmt(a.at) : ''}</div>
                          </div>
                          {a.note ? <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{a.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">لا يوجد</div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}
      </div>
    </div>
  );
};

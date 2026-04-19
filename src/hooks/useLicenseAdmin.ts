import { useEffect, useMemo, useState } from 'react';
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
import { getErrorMessage } from '@/features/licenseAdmin/utils';
import { useToast } from '@/context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { safeCopyToClipboard } from '@/utils/clipboard';

// --- TYPES & HELPERS ---

export type AdminListItem = {
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

export type AfterSales = {
  customer?: { name?: string; company?: string; phone?: string; city?: string };
  note?: string;
  followUp?: { status?: string; lastContactAt?: string; nextAt?: string };
  updatedAt?: string;
};

export type AuditEntry = { at?: string; action?: string; note?: string; meta?: Record<string, unknown> };

export type AdminRecord = {
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

export type IssueDuration = '' | 'trial14d' | '1m' | '3m' | '6m' | '1y' | 'custom';

const toIsoDate = (d: Date): string => {
  return d.toISOString().slice(0, 10);
};

const computeExpiresAtFromDuration = (duration: IssueDuration): string => {
  const now = new Date();
  const d = new Date(now);
  if (!duration) return '';
  if (duration === 'trial14d') { d.setDate(d.getDate() + 14); return toIsoDate(d); }
  if (duration === '1m') { d.setMonth(d.getMonth() + 1); return toIsoDate(d); }
  if (duration === '3m') { d.setMonth(d.getMonth() + 3); return toIsoDate(d); }
  if (duration === '6m') { d.setMonth(d.getMonth() + 6); return toIsoDate(d); }
  if (duration === '1y') { d.setFullYear(d.getFullYear() + 1); return toIsoDate(d); }
  return '';
};

export type TabKey = 'dashboard' | 'licenses' | 'customers' | 'settings';

// --- HOOK ---

export const useLicenseAdmin = (_isVisible: boolean) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Guard
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    if (role !== 'superadmin') navigate('/');
  }, [isAuthenticated, user, navigate]);

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5056');
  const [servers, setServers] = useState<string[]>([]);
  const [newServer, setNewServer] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [serverAdminToken, setServerAdminToken] = useState('');
  const [serverAdminTokenConfigured, setServerAdminTokenConfigured] = useState<boolean | null>(null);
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

  const [setStatusValue, setSetStatusValue] = useState<'active' | 'suspended' | 'revoked'>('active');
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

  const [statusCheckDeviceId] = useState('');
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

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const canUseBridge = typeof window !== 'undefined' && !!window.desktopLicenseAdmin;

  useEffect(() => {
    const st = loadLicenseAdminServerSettings();
    setServers(st.servers);
    if (st.selectedServer) setServerUrl(st.selectedServer);
    setFpItems(loadFingerprintRegistry());
  }, []);

  useEffect(() => {
    const fp = activateDeviceId.trim();
    if (!fp) return;
    const match = fpItems.find((x) => x.fingerprint === fp) || null;
    if (!match) return;
    if (!fpOwner.trim()) setFpOwner(match.owner || '');
    if (!fpComment.trim()) setFpComment(match.comment || '');
  }, [activateDeviceId, fpItems, fpOwner, fpComment]);

  useEffect(() => {
    if (serverUrl) saveLicenseAdminSelectedServer(serverUrl);
  }, [serverUrl]);

  const doAddServer = () => {
    const origin = normalizeServerOrigin(newServer);
    if (!origin) { toast.error('رابط السيرفر غير صالح'); return; }
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
    if (serverUrl === url) setServerUrl(next[0] || 'http://127.0.0.1:5056');
    toast.success('تم حذف السيرفر');
  };

  const refreshList = async () => {
    if (!canUseBridge) { setError('Desktop bridge not available. Run in Electron.'); return; }
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
      const msg = getErrorMessage(e) || 'Failed to refresh';
      if (/admin token not configured/i.test(msg)) {
        setError('توكن السيرفر غير مُعد. أدخل توكن الأدمن ثم اضغط “حفظ التوكن”.');
      } else { setError(msg); }
    } finally { setBusy(false); }
  };

  const refreshTokenStatus = async () => {
    if (!canUseBridge) return;
    if (!loggedIn) { setServerAdminTokenConfigured(null); return; }
    try {
      const res = await window.desktopLicenseAdmin?.getAdminTokenStatus({ serverUrl });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok === true) setServerAdminTokenConfigured(Boolean(rec.configured));
    } catch { /* ignore */ }
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
        activations: Array.isArray(record.activations) ? record.activations.map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null)).filter((a): a is Record<string, unknown> => a !== null).map((a) => ({ deviceId: typeof a.deviceId === 'string' ? String(a.deviceId) : undefined, at: typeof a.at === 'string' ? String(a.at) : undefined })) : [],
        lastSeenAt: typeof record.lastSeenAt === 'string' ? String(record.lastSeenAt) : undefined,
        statusUpdatedAt: typeof record.statusUpdatedAt === 'string' ? String(record.statusUpdatedAt) : undefined,
        statusNote: typeof record.statusNote === 'string' ? String(record.statusNote) : undefined,
        afterSales: record.afterSales && typeof record.afterSales === 'object' ? (record.afterSales as AfterSales) : undefined,
        audit: Array.isArray(record.audit) ? record.audit.map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null)).filter((a): a is Record<string, unknown> => a !== null).map((a) => ({ at: typeof a.at === 'string' ? String(a.at) : undefined, action: typeof a.action === 'string' ? String(a.action) : undefined, note: typeof a.note === 'string' ? String(a.note) : undefined, meta: a.meta && typeof a.meta === 'object' ? (a.meta as Record<string, unknown>) : undefined })) : [],
      };
      setSelectedRecord(parsed);
      setInfo('تم تحميل تفاصيل الترخيص');
      if (parsed.status === 'active' || parsed.status === 'suspended' || parsed.status === 'revoked') setSetStatusValue(parsed.status);
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
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to load record'); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!canUseBridge) { setError('Desktop bridge not available. Run in Electron.'); return; }
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
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to delete'); } finally { setBusy(false); }
  };

  const doLogin = async () => {
    if (!canUseBridge) { setError('Desktop bridge not available. Run in Electron.'); return; }
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
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Login failed'); setLoggedIn(false); } finally { setBusy(false); }
  };

  const doSaveAdminToken = async () => {
    if (!canUseBridge) return;
    if (!loggedIn) { setError('يرجى تسجيل الدخول أولاً'); return; }
    const t = serverAdminToken.trim();
    if (!t) { setError('يرجى إدخال توكن السيرفر'); return; }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await window.desktopLicenseAdmin?.setAdminToken({ token: t, serverUrl });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      setInfo('تم حفظ توكن السيرفر');
      await refreshTokenStatus();
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to save token'); } finally { setBusy(false); }
  };

  const doLogout = async () => {
    if (!canUseBridge) return;
    setBusy(true);
    setError('');
    try { await window.desktopLicenseAdmin?.logout(); } catch { /* ignore */ } finally {
      setLoggedIn(false); setItems([]); setSelectedKey(''); setSelectedRecord(null); setActivateResultJson('');
      setActivateMeta(''); setStatusCheckResult(''); setSavePath(''); setInfo(''); setError(''); setBusy(false);
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
        const parsed = JSON.parse(rawFeatures);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Features JSON must be an object.');
        features = parsed as Record<string, unknown>;
      }
      const res = await window.desktopLicenseAdmin?.issue({ serverUrl, maxActivations: Number.isFinite(maxActivations) ? maxActivations : undefined, expiresAt: expiresAt || undefined, features });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Issue failed'));
      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const licenseKey = typeof result.licenseKey === 'string' ? String(result.licenseKey) : '';
      if (licenseKey) {
        setQ(licenseKey); await refreshList(); setSelectedKey(licenseKey); await loadRecord(licenseKey);
        void safeCopyToClipboard(licenseKey); setInfo('تم إصدار ترخيص جديد (وتم نسخ المفتاح)');
      }
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Issue failed'); } finally { setBusy(false); }
  };

  const doSetStatus = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    if (!licenseKey) { setError('يرجى اختيار ترخيص أولاً'); return; }
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.setStatus({ serverUrl, licenseKey, status: setStatusValue, note: setStatusNote.trim() || undefined });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      await refreshList(); await loadRecord(licenseKey); setInfo('تم تحديث حالة الترخيص');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to update status'); } finally { setBusy(false); }
  };

  const doActivate = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    if (!licenseKey) { setError('يرجى اختيار ترخيص أولاً'); return; }
    if (!deviceId) { setError('يرجى إدخال بصمة جهاز العميل (fingerprint)'); return; }
    setError(''); setInfo(''); setBusy(true); setActivateResultJson(''); setActivateMeta(''); setSavePath('');
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.activate({ serverUrl, licenseKey, deviceId });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Activate failed'));
      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const signed = result.signedLicense && typeof result.signedLicense === 'object' ? (result.signedLicense as Record<string, unknown>) : null;
      if (!signed) throw new Error('استجابة السيرفر لا تحتوي signedLicense');
      setActivateResultJson(JSON.stringify(signed, null, 2));
      const payload = signed.payload && typeof signed.payload === 'object' ? (signed.payload as Record<string, unknown>) : null;
      const issuedAt = payload && typeof payload.issuedAt === 'string' ? String(payload.issuedAt) : '';
      const exp = payload && typeof payload.expiresAt === 'string' ? String(payload.expiresAt) : '';
      setActivateMeta(`تم إنشاء ملف ترخيص لجهاز: ${deviceId}${issuedAt ? ` — issuedAt: ${issuedAt}` : ''}${exp ? ` — expiresAt: ${exp}` : ''}`);
      await loadRecord(licenseKey); setInfo('تم إنشاء ملف الترخيص (جاهز للحفظ)');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Activate failed'); } finally { setBusy(false); }
  };

  const doSaveFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) { setError('يرجى إدخال بصمة جهاز العميل أولاً'); return; }
    setError('');
    const next = upsertFingerprintRecord({ fingerprint: fp, owner: fpOwner.trim(), comment: fpComment.trim() });
    setFpItems(next); setInfo('تم حفظ بيانات البصمة');
  };

  const doCancelFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) { setError('يرجى إدخال/اختيار بصمة أولاً'); return; }
    setError(''); setFpItems(cancelFingerprintRecord(fp)); setInfo('تم إلغاء البصمة (لن تُستخدم إلا إذا فعلتها مرة أخرى)');
  };

  const doDeleteFingerprint = () => {
    const fp = activateDeviceId.trim();
    if (!fp) { setError('يرجى إدخال/اختيار بصمة أولاً'); return; }
    setError(''); setFpItems(deleteFingerprintRecord(fp)); setInfo('تم حذف البصمة من السجل');
  };

  const doSaveLicenseFile = async () => {
    if (!canUseBridge) return;
    if (!activateResultJson.trim()) { setError('لا يوجد ملف ترخيص جاهز للحفظ'); return; }
    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    const name = `azrar-license_${licenseKey || 'license'}_${deviceId || 'device'}.json`;
    setError(''); setInfo(''); setBusy(true);
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.saveLicenseFile({ defaultFileName: name, content: activateResultJson, confirmPassword: exportConfirmPassword });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Save failed'));
      setSavePath(typeof rec.filePath === 'string' ? String(rec.filePath) : '');
      setInfo('تم حفظ ملف الترخيص'); setExportConfirmPassword('');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Save failed'); } finally { setBusy(false); }
  };

  const doUnbindDeviceFromLicense = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = activateDeviceId.trim();
    if (!licenseKey) { setError('يرجى اختيار ترخيص أولاً'); return; }
    if (!deviceId) { setError('يرجى إدخال بصمة جهاز العميل (fingerprint)'); return; }
    setError(''); setInfo(''); setBusy(true);
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.unbindDevice({ serverUrl, licenseKey, deviceId, note: fpComment.trim() || undefined });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      await refreshList(); await loadRecord(licenseKey); setInfo('تم فصل الترخيص عن هذا الجهاز. يمكن للعميل التفعيل على جهاز آخر الآن.');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to unbind device'); } finally { setBusy(false); }
  };

  const doUpdateAfterSales = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    if (!licenseKey) { setError('يرجى اختيار ترخيص أولاً'); return; }
    setError(''); setInfo(''); setBusy(true);
    try {
      const patch = {
        customer: { name: customerName.trim() || undefined, company: customerCompany.trim() || undefined, phone: customerPhone.trim() || undefined, city: customerCity.trim() || undefined },
        note: afterSalesNote,
        followUp: { status: followUpStatus || undefined, lastContactAt: followUpLastContactAt.trim() || undefined, nextAt: followUpNextAt.trim() || undefined },
        logNote: afterSalesLogNote.trim() || undefined,
      };
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.updateAfterSales({ serverUrl, licenseKey, patch });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      await refreshList(); await loadRecord(licenseKey); setAfterSalesLogNote(''); setInfo('تم تحديث بيانات ما بعد البيع');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to update'); } finally { setBusy(false); }
  };

  const doCheckDeviceStatus = async () => {
    if (!canUseBridge) return;
    const licenseKey = selectedKey.trim();
    const deviceId = statusCheckDeviceId.trim();
    if (!licenseKey) { setError('يرجى اختيار ترخيص أولاً'); return; }
    if (!deviceId) { setError('يرجى إدخال بصمة جهاز العميل (fingerprint)'); return; }
    setError(''); setInfo(''); setBusy(true); setStatusCheckResult('');
    try {
      if (!window.desktopLicenseAdmin) throw new Error('Desktop bridge not available');
      const res = await window.desktopLicenseAdmin.checkStatus({ serverUrl, licenseKey, deviceId });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      setStatusCheckResult(JSON.stringify(rec.result && typeof rec.result === 'object' ? rec.result : {}, null, 2));
      setInfo('تم جلب حالة الجهاز');
    } catch (e: unknown) { setError(getErrorMessage(e) || 'Failed to check status'); } finally { setBusy(false); }
  };

  useEffect(() => {
    setSelectedRecord(null); setActivateResultJson(''); setActivateMeta(''); setSavePath(''); setStatusCheckResult('');
    if (loggedIn && selectedKey) void loadRecord(selectedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const applyIssueDuration = (duration: IssueDuration) => {
    setIssueDuration(duration);
    if (duration === 'custom') return;
    setIssueExpiresAt(computeExpiresAtFromDuration(duration));
  };
  
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
        byKey.set(k, { label: company || name || 'عميل غير مسجل', company: company || undefined, name: name || undefined, phone: phone || undefined, city: city || undefined, items: [it] });
      } else { byKey.get(k)?.items.push(it); }
    }
    const out = Array.from(byKey.values());
    out.sort((a,b) => b.items.length - a.items.length || a.label.localeCompare(b.label, 'ar'));
    return out;
  }, [items]);

  const filteredCustomerGroups = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customerGroups;
    return customerGroups.filter(g => g.label.toLowerCase().includes(query) || g.company?.toLowerCase().includes(query) || g.phone?.includes(query));
  }, [customerGroups, customerSearch]);

  const doUpdateServerUser = async () => {
    if (!canUseBridge) return;
    const u = newUsername.trim();
    if (!u) { toast.error('اسم المستخدم مطلوب'); return; }
    if (newPassword && newPassword !== confirmPassword) { toast.error('كلمة المرور غير متطابقة'); return; }
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.updateUser({ username: u, newPassword: newPassword || undefined });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      toast.success('تم تحديث بيانات الدخول للسيرفر'); setNewPassword(''); setConfirmPassword('');
    } catch (e: unknown) { toast.error(getErrorMessage(e) || 'فشل التحديث'); } finally { setBusy(false); }
  };

  return {
    user, navigate, toast, activeTab, setActiveTab, serverUrl, setServerUrl, servers, setServers, newServer, setNewServer,
    username, setUsername, password, setPassword, serverAdminToken, setServerAdminToken, serverAdminTokenConfigured,
    loggedIn, setLoggedIn, busy, setBusy, error, setError, info, setInfo, q, setQ, items, setItems, selectedKey, setSelectedKey,
    selectedRecord, setSelectedRecord, issueMaxActivations, setIssueMaxActivations, issueExpiresAt, setIssueExpiresAt,
    issueDuration, setIssueDuration, issueFeaturesJson, setIssueFeaturesJson, setStatusValue, setSetStatusValue,
    setStatusNote, setSetStatusNote, activateDeviceId, setActivateDeviceId, activateResultJson, setActivateResultJson,
    activateMeta, setActivateMeta, savePath, setSavePath, customerSearch, setCustomerSearch, fpOwner, setFpOwner,
    fpComment, setFpComment, fpItems, setFpItems, statusCheckResult, setStatusCheckResult, customerName, setCustomerName,
    customerCompany, setCustomerCompany, customerPhone, setCustomerPhone, customerCity, setCustomerCity, afterSalesNote,
    setAfterSalesNote, followUpStatus, setFollowUpStatus, followUpLastContactAt, setFollowUpLastContactAt,
    followUpNextAt, setFollowUpNextAt, afterSalesLogNote, setAfterSalesLogNote, exportConfirmPassword, setExportConfirmPassword,
    newUsername, setNewUsername, newPassword, setNewPassword, confirmPassword, setConfirmPassword, canUseBridge,
    doAddServer, doRemoveServer, refreshList, refreshTokenStatus, loadRecord, doDelete, doLogin, doSaveAdminToken, doLogout,
    doIssue, doSetStatus, doActivate, doSaveFingerprint, doCancelFingerprint, doDeleteFingerprint, doSaveLicenseFile,
    doUnbindDeviceFromLicense, doUpdateAfterSales, doCheckDeviceStatus, applyIssueDuration, filteredCustomerGroups,
    doUpdateServerUser,
  };
};

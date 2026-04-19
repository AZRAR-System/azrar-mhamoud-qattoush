import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  ScrollText,
  Users,
  Wrench,
  HandCoins,
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { Attachment, ReferenceType, الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';

export function useDocuments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [viewingFile, setViewingFile] = useState<Attachment | null>(null);

  const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb;
  const isDesktopFast = isDesktop && !!window.desktopDb?.domainGet;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const dbSignal = useDbSignal();

  useEffect(() => {
    try {
      const all = DbService.getAllAttachments?.();
      setAttachments(Array.isArray(all) ? all : []);
    } catch {
      setAttachments([]);
    }
  }, [dbSignal]);

  const [fastPeopleById, setFastPeopleById] = useState<Map<string, الأشخاص_tbl>>(() => new Map());
  const [fastPropertiesById, setFastPropertiesById] = useState<Map<string, العقارات_tbl>>(() => new Map());
  const [fastContractsById, setFastContractsById] = useState<Map<string, العقود_tbl>>(() => new Map());

  const peopleById = useMemo(() => {
    void dbSignal;
    if (desktopUnsupported) return new Map<string, الأشخاص_tbl>();
    if (isDesktopFast) return fastPeopleById;
    const m = new Map<string, الأشخاص_tbl>();
    try {
      const people = DbService.getPeople() || [];
      for (const p of people) m.set(String(p?.رقم_الشخص), p);
    } catch { /* ignore */ }
    return m;
  }, [dbSignal, desktopUnsupported, isDesktopFast, fastPeopleById]);

  const propertiesById = useMemo(() => {
    void dbSignal;
    if (desktopUnsupported) return new Map<string, العقارات_tbl>();
    if (isDesktopFast) return fastPropertiesById;
    const m = new Map<string, العقارات_tbl>();
    try {
      const props = DbService.getProperties() || [];
      for (const p of props) m.set(String(p?.رقم_العقار), p);
    } catch { /* ignore */ }
    return m;
  }, [dbSignal, desktopUnsupported, isDesktopFast, fastPropertiesById]);

  const contractsById = useMemo(() => {
    void dbSignal;
    if (desktopUnsupported) return new Map<string, العقود_tbl>();
    if (isDesktopFast) return fastContractsById;
    const m = new Map<string, العقود_tbl>();
    try {
      const cs = DbService.getContracts() || [];
      for (const c of cs) m.set(String(c?.رقم_العقد), c);
    } catch { /* ignore */ }
    return m;
  }, [dbSignal, desktopUnsupported, isDesktopFast, fastContractsById]);

  useEffect(() => {
    if (!isDesktopFast) return;
    let cancelled = false;
    const MAX_RESOLVE_PER_TYPE = 400;

    const collectIds = (type: ReferenceType): string[] => {
      const ids = new Set<string>();
      for (const a of attachments || []) {
        if (a?.referenceType === type) {
          const id = String(a?.referenceId || '').trim();
          if (id) ids.add(id);
        }
      }
      return Array.from(ids);
    };

    const resolvePeople = async () => {
      const ids = collectIds('Person').filter((id) => !fastPeopleById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(ids.map(async (id) => [id, await domainGetSmart('people', id)] as const));
      if (!cancelled) setFastPeopleById((p) => { const n = new Map(p); for(const [id, x] of pairs) if(x) n.set(id, x); return n; });
    };

    const resolveProperties = async () => {
      const ids = collectIds('Property').filter((id) => !fastPropertiesById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(ids.map(async (id) => [id, await domainGetSmart('properties', id)] as const));
      if (!cancelled) setFastPropertiesById((p) => { const n = new Map(p); for(const [id, x] of pairs) if(x) n.set(id, x); return n; });
    };

    const resolveContracts = async () => {
      const ids = collectIds('Contract').filter((id) => !fastContractsById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(ids.map(async (id) => [id, await domainGetSmart('contracts', id)] as const));
      if (!cancelled) setFastContractsById((p) => { const n = new Map(p); for(const [id, x] of pairs) if(x) n.set(id, x); return n; });
    };

    Promise.all([resolvePeople(), resolveProperties(), resolveContracts()]).catch(() => {});
    return () => { cancelled = true; };
  }, [attachments, isDesktopFast, fastPeopleById, fastPropertiesById, fastContractsById]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const fileKind = (a: Attachment): 'صور' | 'PDF' | 'مستندات' => {
    const ext = String(a.fileExtension || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'صور';
    if (ext === 'pdf') return 'PDF';
    return 'مستندات';
  };

  const typeLabel = (t: ReferenceType): string => {
    if (t === 'Person') return 'الأشخاص';
    if (t === 'Property') return 'العقارات';
    if (t === 'Contract') return 'العقود';
    if (t === 'Maintenance') return 'الصيانة';
    if (t === 'Sales') return 'المبيعات';
    return String(t);
  };

  const typeIcon = (t: ReferenceType) => {
    if (t === 'Person') return Users;
    if (t === 'Property') return Building2;
    if (t === 'Contract') return ScrollText;
    if (t === 'Maintenance') return Wrench;
    if (t === 'Sales') return HandCoins;
    return FileText;
  };

  const describeReference = (a: Attachment): { title: string; subtitle?: string; roles?: string[] } => {
    const id = String(a.referenceId || '');
    if (a.referenceType === 'Person') {
      const p = peopleById.get(id);
      const name = String(p?.الاسم || '').trim() || `شخص #${id}`;
      const roles = (() => { if (desktopUnsupported) return []; try { return DbService.getPersonRoles(id) || []; } catch { return []; } })();
      return { title: name, subtitle: String(p?.رقم_الهاتف || '').trim() || undefined, roles };
    }
    if (a.referenceType === 'Property') {
      const p = propertiesById.get(id);
      const code = String(p?.الكود_الداخلي || '').trim();
      return { title: code ? `عقار ${code}` : `عقار #${id}`, subtitle: String(p?.العنوان || '').trim() || undefined };
    }
    if (a.referenceType === 'Contract') {
      const c = contractsById.get(id);
      return { title: `عقد #${String(c?.رقم_العقد || id).trim()}`, subtitle: String(c?.حالة_العقد || '').trim() || undefined };
    }
    if (a.referenceType === 'Maintenance') return { title: `صيانة #${id}` };
    if (a.referenceType === 'Sales') return { title: `مبيعات #${id}` };
    return { title: `${a.referenceType} #${id}` };
  };

  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Attachment[]>> = {};
    for (const a of attachments || []) {
      const t = String(a.referenceType || 'Other');
      const k = fileKind(a);
      out[t] ||= {}; out[t][k] ||= []; out[t][k].push(a);
    }
    for (const t of Object.keys(out)) for (const k of Object.keys(out[t])) out[t][k].sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')));
    return out;
  }, [attachments]);

  return {
    attachments, grouped, viewingFile, setViewingFile, desktopUnsupported,
    formatSize, fileKind, typeLabel, typeIcon, describeReference,
  };
}

export type UseDocumentsReturn = ReturnType<typeof useDocuments>;

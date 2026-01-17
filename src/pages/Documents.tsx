/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Documents - aggregated attachments view
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Image as ImageIcon, ScrollText, Users, Wrench, HandCoins, Eye } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { Attachment, ReferenceType, الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';
import { FileViewer } from '@/components/shared/FileViewer';
import { DS } from '@/constants/designSystem';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';

export const Documents: React.FC = () => {
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
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
    return m;
  }, [dbSignal, desktopUnsupported, isDesktopFast, fastContractsById]);

  useEffect(() => {
    if (!isDesktopFast) return;

    let cancelled = false;
    const MAX_RESOLVE_PER_TYPE = 400;

    const collectIds = (type: ReferenceType): string[] => {
      const ids = new Set<string>();
      for (const a of attachments || []) {
        if (a?.referenceType !== type) continue;
        const id = String(a?.referenceId || '').trim();
        if (id) ids.add(id);
      }
      return Array.from(ids);
    };

    const resolvePeople = async () => {
      const ids = collectIds('Person').filter((id) => !fastPeopleById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const p = await domainGetSmart('people', id);
          return [id, p] as const;
        })
      );
      if (cancelled) return;
      setFastPeopleById((prev) => {
        const next = new Map(prev);
        for (const [id, p] of pairs) if (p) next.set(id, p);
        return next;
      });
    };

    const resolveProperties = async () => {
      const ids = collectIds('Property').filter((id) => !fastPropertiesById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const p = await domainGetSmart('properties', id);
          return [id, p] as const;
        })
      );
      if (cancelled) return;
      setFastPropertiesById((prev) => {
        const next = new Map(prev);
        for (const [id, p] of pairs) if (p) next.set(id, p);
        return next;
      });
    };

    const resolveContracts = async () => {
      const ids = collectIds('Contract').filter((id) => !fastContractsById.has(id)).slice(0, MAX_RESOLVE_PER_TYPE);
      if (ids.length === 0) return;
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const c = await domainGetSmart('contracts', id);
          return [id, c] as const;
        })
      );
      if (cancelled) return;
      setFastContractsById((prev) => {
        const next = new Map(prev);
        for (const [id, c] of pairs) if (c) next.set(id, c);
        return next;
      });
    };

    Promise.all([resolvePeople(), resolveProperties(), resolveContracts()]).catch(() => {
      // ignore
    });

    return () => {
      cancelled = true;
    };
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
      const phone = String(p?.رقم_الهاتف || '').trim();
      const roles = (() => {
        if (desktopUnsupported) return [];
        try {
          return DbService.getPersonRoles(id) || [];
        } catch {
          return [];
        }
      })();

      return { title: name, subtitle: phone ? phone : undefined, roles };
    }

    if (a.referenceType === 'Property') {
      const p = propertiesById.get(id);
      const code = String(p?.الكود_الداخلي || '').trim();
      const addr = String(p?.العنوان || '').trim();
      return { title: code ? `عقار ${code}` : `عقار #${id}`, subtitle: addr || undefined };
    }

    if (a.referenceType === 'Contract') {
      const c = contractsById.get(id);
      const num = String(c?.رقم_العقد || id).trim();
      const status = String(c?.حالة_العقد || '').trim();
      return { title: `عقد #${num}`, subtitle: status || undefined };
    }

    if (a.referenceType === 'Maintenance') {
      return { title: `صيانة #${id}` };
    }

    if (a.referenceType === 'Sales') {
      return { title: `مبيعات #${id}` };
    }

    return { title: `${a.referenceType} #${id}` };
  };

  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Attachment[]>> = {};
    for (const a of attachments || []) {
      const t = String(a.referenceType || 'Other');
      const k = fileKind(a);
      out[t] ||= {};
      out[t][k] ||= [];
      out[t][k].push(a);
    }
    for (const t of Object.keys(out)) {
      for (const k of Object.keys(out[t])) {
        out[t][k].sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')));
      }
    }
    return out;
  }, [attachments]);

  const totalCount = attachments.length;
  const typeOrder: ReferenceType[] = ['Property', 'Person', 'Contract', 'Maintenance', 'Sales'];
  const kindOrder: Array<'PDF' | 'صور' | 'مستندات'> = ['PDF', 'صور', 'مستندات'];

  return (
    <div className="space-y-6">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>مستندات</h2>
          <p className={DS.components.pageSubtitle}>عرض مجمّع للمرفقات حسب الصنف والصفة</p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="text-orange-500" />
          <span className="text-xs text-slate-600 dark:text-slate-400">الإجمالي: {totalCount}</span>
        </div>
      </div>

      {desktopUnsupported ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 text-sm text-yellow-800 dark:text-yellow-200">
          عرض تفاصيل المرفقات على الديسكتوب يحتاج endpoint `domainGet` (وضع السرعة/SQL). يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة.
        </div>
      ) : null}

      {totalCount === 0 ? (
        <div className="app-card p-8 text-center text-slate-600 dark:text-slate-400">
          لا توجد مستندات مرفوعة حالياً.
        </div>
      ) : (
        <div className="space-y-4">
          {typeOrder
            .filter((t) => grouped[String(t)])
            .map((t) => {
              const groups = grouped[String(t)] || {};
              const count = Object.values(groups).reduce((s, arr) => s + (arr?.length || 0), 0);
              const Icon = typeIcon(t);

              return (
                <div key={t} className="app-card">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                      <Icon size={18} className="text-slate-600 dark:text-slate-300" />
                      {typeLabel(t)}
                      <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {count}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">مجمعة حسب الصفة (نوع الملف)</div>
                  </div>

                  <div className="p-3 space-y-3">
                    {kindOrder
                      .filter((k) => (groups[k] || []).length > 0)
                      .map((k) => {
                        const items = groups[k] || [];
                        return (
                          <div key={k} className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                            <div className="px-4 py-2 bg-white dark:bg-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                {k === 'صور' ? <ImageIcon size={16} className="text-purple-500" /> : <FileText size={16} className="text-indigo-500" />}
                                {k}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{items.length}</span>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                              {items.map((a) => {
                                const ref = describeReference(a);
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => setViewingFile(a)}
                                    className="w-full text-right p-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition flex items-start justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-800 dark:text-white truncate" title={a.fileName}>{a.fileName}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{ref.title}</span>
                                        {ref.subtitle ? <span className="ml-2 font-mono dir-ltr">• {ref.subtitle}</span> : null}
                                      </div>
                                      {Array.isArray(ref.roles) && ref.roles.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {ref.roles.slice(0, 4).map((r) => (
                                            <span
                                              key={r}
                                              className="text-[10px] px-2 py-0.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800"
                                            >
                                              {r}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                      <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-2">
                                        <span className="font-mono">{formatSize(a.fileSize)}</span>
                                        <span>•</span>
                                        <span dir="ltr">{new Date(a.uploadDate).toLocaleDateString()}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0 text-slate-500 dark:text-slate-300">
                                      <Eye size={16} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {viewingFile && (
        <FileViewer
          fileId={viewingFile.id}
          fileName={viewingFile.fileName}
          fileExtension={viewingFile.fileExtension}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
};

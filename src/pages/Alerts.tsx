import React, { useCallback, useEffect, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { tbl_Alerts } from '@/types';
import { Bell, CheckCircle, Clock, AlertTriangle, CheckCheck, ExternalLink, X, User, Home, MessageCircle, Send, StickyNote, FileText, Layers, Database, ShieldAlert, PenTool } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { DS } from '@/constants/designSystem';
import { ROUTE_PATHS } from '@/routes/paths';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useDbSignal } from '@/hooks/useDbSignal';
import { NotificationTemplates } from '@/services/notificationTemplates';

export const Alerts = () => {
  const [alerts, setAlerts] = useState<tbl_Alerts[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<tbl_Alerts | null>(null);
  const [noteText, setNoteText] = useState('');

    const [only, setOnly] = useState<'unread' | 'all'>('unread');
    const [category, setCategory] = useState<string>('');
    const [q, setQ] = useState<string>('');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);

    const [expiryKind, setExpiryKind] = useState<'pre_notice' | 'approved' | 'rejected' | 'auto'>('pre_notice');

  const { openPanel } = useSmartModal();
    const toast = useToast();

    const dbSignal = useDbSignal();

    const loadAlerts = useCallback(() => {
        const all = (DbService.getAlerts() || []) as any[];

        try {
            const cats = Array.from(
                new Set(
                    all
                        .map((a: any) => String(a?.category || '').trim())
                        .filter(Boolean)
                )
            ).sort((a, b) => a.localeCompare(b));
            setAvailableCategories(cats);
        } catch {
            setAvailableCategories([]);
        }

        let next = all;

        if (only === 'unread') {
            next = next.filter((a: any) => !a.تم_القراءة);
        }

        if (category) {
            next = next.filter((a: any) => String(a.category || '').trim() === category);
        }

        const needle = q.trim().toLowerCase();
        if (needle) {
            next = next.filter((a: any) => {
                const parts = [
                    a?.نوع_التنبيه,
                    a?.الوصف,
                    a?.tenantName,
                    a?.propertyCode,
                    a?.phone,
                ]
                    .map((x) => String(x ?? '').toLowerCase());
                return parts.some((p) => p.includes(needle));
            });
        }

        setAlerts(next as tbl_Alerts[]);
    }, [only, category, q]);

    useEffect(() => {
        loadAlerts();
    }, [dbSignal, loadAlerts]);

    // Support deep links: #/alerts?only=unread|all&category=...&q=...
    useEffect(() => {
        const applyFromHash = () => {
            try {
                const raw = String(window.location.hash || '').startsWith('#')
                    ? String(window.location.hash || '').slice(1)
                    : String(window.location.hash || '');
                const qIndex = raw.indexOf('?');
                const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
                const params = new URLSearchParams(search);

                const onlyParam = String(params.get('only') || '').trim();
                if (onlyParam === 'all' || onlyParam === 'unread') {
                    setOnly(onlyParam as any);
                }

                const cat = String(params.get('category') || '').trim();
                setCategory(cat);

                if (params.has('q')) {
                    setQ(String(params.get('q') || ''));
                }
            } catch {
                // ignore
            }
        };

        applyFromHash();
        window.addEventListener('hashchange', applyFromHash);
        return () => window.removeEventListener('hashchange', applyFromHash);
    }, []);

    useEffect(() => {
        // Reset expiry kind when opening a new alert
        setExpiryKind('pre_notice');
    }, [selectedAlert?.id]);

    const handleMarkAllRead = async () => {
        const ok = await toast.confirm({
            title: 'تأكيد',
            message: 'هل تريد فعلاً تعليم كل التنبيهات كمقروءة؟ ستختفي من القائمة.',
            confirmText: 'نعم',
            cancelText: 'إلغاء',
            isDangerous: false,
        });
        if (!ok) return;
        DbService.markAllAlertsAsRead();
        loadAlerts();
    };

  const handleDismiss = (alert: tbl_Alerts) => {
    // If it's a grouped financial alert, handle grouped dismissal
    if (alert.category === 'Financial' && alert.details && alert.details.length > 0) {
        const childIds = alert.details.map(d => d.id);
        DbService.markMultipleAlertsAsRead(childIds);
    } else {
        // For Data/Risk alerts or single financial, dismiss the ID
        DbService.markAlertAsRead(alert.id);
    }
    
    loadAlerts();
    if (selectedAlert?.id === alert.id) setSelectedAlert(null);
  };

  const handleNavigate = (alert: tbl_Alerts) => {
    if (alert.مرجع_الجدول === 'العقود_tbl') {
      openPanel('CONTRACT_DETAILS', alert.مرجع_المعرف);
    } else if (alert.مرجع_الجدول === 'الكمبيالات_tbl') {
      // Find contract related to this installment if possible or navigate
      // Since installment doesn't have a direct panel yet, let's navigate to installments
      window.location.hash = ROUTE_PATHS.INSTALLMENTS + '?filter=due';
    } else if (alert.مرجع_الجدول === 'العقارات_tbl') {
            if (alert.مرجع_المعرف === 'batch') {
                window.location.hash = ROUTE_PATHS.PROPERTIES;
            } else {
                openPanel('PROPERTY_DETAILS', alert.مرجع_المعرف);
            }
    } else if (alert.مرجع_الجدول === 'الأشخاص_tbl') {
            if (alert.مرجع_المعرف === 'batch') {
                window.location.hash = ROUTE_PATHS.PEOPLE;
            } else {
                openPanel('PERSON_DETAILS', alert.مرجع_المعرف);
            }
    } else {
      window.location.hash = ROUTE_PATHS.DASHBOARD;
    }
  };

  const resolveAlertPhones = (alert: tbl_Alerts): string[] => {
      const phones: Array<string | null | undefined> = [alert.phone];

      // If linked directly to a person
      if (alert.مرجع_الجدول === 'الأشخاص_tbl' && alert.مرجع_المعرف) {
          const person = (DbService.getPeople?.() || []).find((p: any) => String(p?.رقم_الشخص) === String(alert.مرجع_المعرف));
          phones.push(person?.رقم_الهاتف, person?.رقم_هاتف_اضافي);
      }

      // If linked to a contract, derive tenant
      if (alert.مرجع_الجدول === 'العقود_tbl' && alert.مرجع_المعرف) {
          const contract = (DbService.getContracts?.() || []).find((c: any) => String(c?.رقم_العقد) === String(alert.مرجع_المعرف));
          if (contract?.رقم_المستاجر) {
              const tenant = (DbService.getPeople?.() || []).find((p: any) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
              phones.push(tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي);
          }
      }

      // Dedupe by trimmed value (actual normalization happens in openWhatsAppForPhones)
      const uniq = new Set<string>();
      for (const p of phones) {
          const v = String(p ?? '').trim();
          if (v) uniq.add(v);
      }
      return Array.from(uniq);
  };

  const resolveOwnerPhonesForContract = (contractId: string): string[] => {
      const contract = (DbService.getContracts?.() || []).find((c: any) => String(c?.رقم_العقد) === String(contractId));
      const property = contract?.رقم_العقار
          ? (DbService.getProperties?.() || []).find((p: any) => String(p?.رقم_العقار) === String(contract.رقم_العقار))
          : null;
      const owner = property?.رقم_المالك
          ? (DbService.getPeople?.() || []).find((p: any) => String(p?.رقم_الشخص) === String(property.رقم_المالك))
          : null;

      const phones: Array<string | null | undefined> = [owner?.رقم_الهاتف, owner?.رقم_هاتف_اضافي];
      const uniq = new Set<string>();
      for (const p of phones) {
          const v = String(p ?? '').trim();
          if (v) uniq.add(v);
      }
      return Array.from(uniq);
  };

  const getFixedExpiryTemplateId = (target: 'tenant' | 'owner') => {
      const map = {
          pre_notice: {
              tenant: 'contract_expiry_pre_notice_tenant_fixed',
              owner: 'contract_expiry_pre_notice_owner_fixed',
          },
          approved: {
              tenant: 'contract_renewal_approved_tenant_fixed',
              owner: 'contract_renewal_approved_owner_fixed',
          },
          rejected: {
              tenant: 'contract_renewal_rejected_tenant_fixed',
              owner: 'contract_renewal_rejected_owner_fixed',
          },
          auto: {
              tenant: 'contract_renewal_auto_tenant_fixed',
              owner: 'contract_renewal_auto_owner_fixed',
          },
      } as const;
      return map[expiryKind][target];
  };

  const sendFixedExpiryWhatsApp = (target: 'tenant' | 'owner') => {
      if (!selectedAlert) return;
      if (selectedAlert.مرجع_الجدول !== 'العقود_tbl') return;
      if (!selectedAlert.مرجع_المعرف || selectedAlert.مرجع_المعرف === 'batch') return;

      const contractId = String(selectedAlert.مرجع_المعرف);
      const tmplId = getFixedExpiryTemplateId(target);
      const generated = DbService.generateLegalNotice(tmplId, contractId, {
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });

      const message = String(generated?.text || '').trim();
      if (!message) return;

      const phones = target === 'tenant' ? resolveAlertPhones(selectedAlert) : resolveOwnerPhonesForContract(contractId);
      if (phones.length === 0) return;

      void openWhatsAppForPhones(message, phones, { defaultCountryCode: '962', delayMs: 10_000 });
  };

  const sendWhatsApp = () => {
      if (!selectedAlert) return;

      // Data Quality (Properties): send fixed templates to owners (grouped)
      if (selectedAlert.category === 'DataQuality' && selectedAlert.مرجع_الجدول === 'العقارات_tbl') {
          void sendDataQualityPropertyWhatsApp();
          return;
      }

      // Expiry quick alerts must use the fixed legal templates (no hardcoded edits)
      if (selectedAlert.category === 'Expiry' && selectedAlert.مرجع_الجدول === 'العقود_tbl' && selectedAlert.مرجع_المعرف && selectedAlert.مرجع_المعرف !== 'batch') {
          sendFixedExpiryWhatsApp('tenant');
          return;
      }

      const phones = resolveAlertPhones(selectedAlert);
      if (phones.length === 0) return;
      
      let message = '';
      if (selectedAlert.count && selectedAlert.count > 1 && selectedAlert.category === 'Financial') {
          message = `مرحباً ${selectedAlert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود ${selectedAlert.count} دفعات قريبة الاستحقاق للعقار (${selectedAlert.propertyCode}).\n${selectedAlert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
      } else if (selectedAlert.category === 'Financial') {
          message = `مرحباً ${selectedAlert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود دفعة قريبة الاستحقاق للعقار (${selectedAlert.propertyCode}).\n${selectedAlert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
      } else if (selectedAlert.category === 'Expiry') {
          message = `مرحباً ${selectedAlert.tenantName}،\nعقد الإيجار الخاص بالعقار (${selectedAlert.propertyCode}) قارب على الانتهاء.\nيرجى مراجعة المكتب للتجديد.`;
      } else if (selectedAlert.category === 'Risk') {
          message = `مرحباً ${selectedAlert.tenantName}،\nيرجى مراجعة المكتب للأهمية بخصوص تسوية الذمم المالية العالقة.`;
      } else {
          message = `مرحباً ${selectedAlert.tenantName}،\nإشعار بخصوص العقار (${selectedAlert.propertyCode}):\n${selectedAlert.الوصف}`;
      }

      void openWhatsAppForPhones(message, phones, { defaultCountryCode: '962', delayMs: 10_000 });
  };

  const openLegalNotice = () => {
      if (selectedAlert?.مرجع_المعرف && selectedAlert.مرجع_المعرف !== 'batch') {
          openPanel('LEGAL_NOTICE_GENERATOR', selectedAlert.مرجع_المعرف);
      }
  };

  const saveNote = () => {
      if (!selectedAlert || !noteText.trim()) return;
      // Use entity note for specific IDs, or general log for batch alerts
      if (selectedAlert.مرجع_المعرف !== 'batch') {
          DbService.addEntityNote(selectedAlert.مرجع_الجدول, selectedAlert.مرجع_المعرف, noteText);
          setNoteText('');
          toast.success('تم حفظ الملاحظة بنجاح');
      } else {
          toast.warning('يرجى الانتقال للسجل المحدد لإضافة ملاحظة، هذا تنبيه مجمّع.');
      }
  };

  const getMissingFieldLabel = (field: string) => {
      if (field === 'رقم_اشتراك_الكهرباء') return 'رقم اشتراك الكهرباء';
      if (field === 'رقم_اشتراك_المياه') return 'رقم اشتراك المياه';
      return field;
  };

  const resolveOwnerForProperty = (propertyId: string) => {
      const property = (DbService.getProperties?.() || []).find((p: any) => String(p?.رقم_العقار) === String(propertyId));
      const ownerId = property?.رقم_المالك;
      const owner = ownerId
          ? (DbService.getPeople?.() || []).find((p: any) => String(p?.رقم_الشخص) === String(ownerId))
          : null;
      return { property, owner };
  };

  const sendDataQualityPropertyWhatsApp = async () => {
      if (!selectedAlert) return;
      if (selectedAlert.category !== 'DataQuality') return;
      if (selectedAlert.مرجع_الجدول !== 'العقارات_tbl') return;
      if (!selectedAlert.details || selectedAlert.details.length === 0) return;

      const tmpl = NotificationTemplates.getById('data_quality_missing_property_utils_fixed');
      if (!tmpl || !tmpl.enabled) {
          toast.warning('قالب إشعار نقص بيانات العقار غير متاح');
          return;
      }

      type OwnerGroup = {
          ownerId: string;
          ownerName: string;
          phones: string[];
          lines: string[];
      };

      const groups = new Map<string, OwnerGroup>();
      const missingOwners: string[] = [];
      const missingPhones: string[] = [];

      for (const d of selectedAlert.details as any[]) {
          const propertyId = String(d?.id ?? '');
          if (!propertyId) continue;

          const { property, owner } = resolveOwnerForProperty(propertyId);
          const propLabel = String(d?.name || property?.الكود_الداخلي || property?.رقم_العقار || propertyId);
          const missingFields: string[] = Array.isArray(d?.missingFields) ? d.missingFields : [];
          const missingText = missingFields.length ? missingFields.map(getMissingFieldLabel).join('، ') : 'بيانات ناقصة';
          const line = `• ${propLabel} (ناقص: ${missingText})`;

          if (!owner || !property?.رقم_المالك) {
              missingOwners.push(propLabel);
              continue;
          }

          const phones = [owner?.رقم_الهاتف, owner?.رقم_هاتف_اضافي]
              .filter(Boolean)
              .map((x: any) => String(x).trim())
              .filter(Boolean);

          if (phones.length === 0) {
              missingPhones.push(String(owner?.الاسم || propLabel));
              continue;
          }

          const ownerId = String(property.رقم_المالك);
          const existing = groups.get(ownerId);
          if (!existing) {
              groups.set(ownerId, {
                  ownerId,
                  ownerName: String(owner?.الاسم || 'المالك'),
                  phones,
                  lines: [line],
              });
          } else {
              existing.lines.push(line);
              const merged = new Set([...(existing.phones || []), ...phones]);
              existing.phones = Array.from(merged);
          }
      }

      const list = Array.from(groups.values());
      if (list.length === 0) {
          toast.warning('لا يمكن الإرسال: لم يتم العثور على مالك/هاتف صالح للعقارات المطلوبة');
          return;
      }

      for (const g of list) {
          const message = NotificationTemplates.fill(tmpl, {
              اسم_المالك: g.ownerName,
              قائمة_العقارات: g.lines.join('\n'),
          });
          await openWhatsAppForPhones(message, g.phones, { defaultCountryCode: '962', delayMs: 10_000 });
          await new Promise(r => setTimeout(r, 250));
      }

      if (missingOwners.length > 0) {
          toast.warning(`تعذر تحديد المالك لبعض العقارات: ${missingOwners.slice(0, 3).join('، ')}${missingOwners.length > 3 ? '…' : ''}`);
      }
      if (missingPhones.length > 0) {
          toast.warning(`لا يوجد هاتف لبعض المالكين: ${missingPhones.slice(0, 3).join('، ')}${missingPhones.length > 3 ? '…' : ''}`);
      }
  };

  const getAlertStyle = (alert: tbl_Alerts) => {
    if (alert.category === 'Financial') return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400';
        if (alert.category === 'DataQuality') return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    if (alert.category === 'Risk') return 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400';
    return 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-400';
  };

  const getAlertIcon = (category: string) => {
      switch(category) {
          case 'Financial': return <AlertTriangle size={24} />;
          case 'DataQuality': return <Database size={24} />;
          case 'Risk': return <ShieldAlert size={24} />;
          case 'Expiry': return <Clock size={24} />;
          default: return <Bell size={24} />;
      }
  };

  return (
    <div className="animate-fade-in relative">
      
            <div className={`${DS.components.pageHeader} mb-6`}>
                <div>
                    <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
                        <Bell size={22} />
                        التنبيهات والإشعارات
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        مركز العمليات: متابعة التحصيل، جودة البيانات، والمخاطر
                    </p>
                </div>

                {alerts.length > 0 && (
                    <Button
                        variant="secondary"
                        onClick={handleMarkAllRead}
                        rightIcon={<CheckCheck size={18} />}
                    >
                        تعليم الكل كمقروء
                    </Button>
                )}
            </div>

            <Card className="p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <Input
                        type="text"
                        placeholder="بحث في التنبيهات..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />

                    <select
                        className="w-full text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded px-3 py-2 outline-none"
                        value={only}
                        onChange={(e) => setOnly(e.target.value as any)}
                    >
                        <option value="unread">غير مقروء فقط</option>
                        <option value="all">الكل</option>
                    </select>

                    <select
                        className="w-full text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded px-3 py-2 outline-none"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">كل الأنواع</option>
                        {availableCategories.map((cat) => {
                            const labels: Record<string, string> = {
                                Financial: 'تحصيل/مالي',
                                Expiry: 'انتهاء/تجديد',
                                Risk: 'مخاطر',
                                DataQuality: 'جودة البيانات',
                                SmartBehavior: 'سلوك/ذكاء',
                                System: 'النظام',
                                Security: 'أمان',
                                Maintenance: 'صيانة',
                            };
                            return (
                                <option key={cat} value={cat}>
                                    {labels[cat] || cat}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </Card>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden min-h-[400px]">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
               <CheckCircle size={40} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">لا توجد تنبيهات جديدة</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">النظام يعمل بكفاءة ولا توجد مشاكل معلقة.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                onClick={() => setSelectedAlert(alert)}
                className="p-5 flex flex-col md:flex-row items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition group cursor-pointer"
              >
                
                {/* Icon */}
                <div className={`p-3 rounded-2xl flex-shrink-0 relative ${getAlertStyle(alert)}`}>
                  {getAlertIcon(alert.category)}
                  {alert.count && alert.count > 1 && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
                          {alert.count}
                      </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                        {alert.نوع_التنبيه}
                        {alert.count && alert.count > 1 && (
                            <span className="text-xs font-normal bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300">
                                {alert.count} عناصر
                            </span>
                        )}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono" dir="ltr">
                      {new Date(alert.تاريخ_الانشاء).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  
                  {/* Context Badges (Only if specific tenant/prop exists) */}
                  {(alert.tenantName || alert.propertyCode) && alert.propertyCode !== 'N/A' && (
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 mb-2">
                          {alert.tenantName && (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                  <User size={14} className="text-indigo-500" />
                                  <span className="font-bold">{alert.tenantName}</span>
                              </div>
                          )}
                          {alert.propertyCode && (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                  <Home size={14} className="text-purple-500" />
                                  <span className="font-mono">{alert.propertyCode}</span>
                              </div>
                          )}
                      </div>
                  )}

                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    {alert.الوصف}
                  </p>
                </div>

                {/* Quick Action Trigger */}
                <div className="text-slate-300 group-hover:text-indigo-500 transition">
                    <ExternalLink size={20} />
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* QUICK ACTION MODAL */}
      {selectedAlert && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
                  
                  {/* Header */}
                  <div className={`p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-start ${getAlertStyle(selectedAlert)} bg-opacity-20 dark:bg-opacity-10`}>
                      <div>
                          <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                              {selectedAlert.نوع_التنبيه}
                              {selectedAlert.count && selectedAlert.count > 1 && (
                                  <span className="bg-white/50 dark:bg-black/20 text-sm px-2 py-0.5 rounded">مجمع</span>
                              )}
                          </h3>
                          <p className="text-sm opacity-80">{selectedAlert.الوصف}</p>
                      </div>
                      <button
                        onClick={() => setSelectedAlert(null)}
                        className="p-2 rounded-full text-slate-700 hover:bg-black/10 dark:text-slate-200 dark:hover:bg-white/10 transition"
                        title="إغلاق"
                        aria-label="إغلاق"
                      >
                        <X size={20}/>
                      </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">

                      {/* Fixed expiry/renewal quick notifications */}
                      {selectedAlert.category === 'Expiry' && selectedAlert.مرجع_الجدول === 'العقود_tbl' && selectedAlert.مرجع_المعرف !== 'batch' && (
                          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                                  رسائل انتهاء/تجديد العقد (ثابتة)
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                  <div className="flex items-center gap-2">
                                      <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">نوع الرسالة</label>
                                      <select
                                          className="flex-1 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded px-3 py-2 outline-none"
                                          value={expiryKind}
                                          onChange={(e) => setExpiryKind(e.target.value as any)}
                                      >
                                          <option value="pre_notice">إخطار مبدئي قبل نهاية العقد</option>
                                          <option value="approved">الموافقة على التجديد</option>
                                          <option value="rejected">عدم التجديد</option>
                                          <option value="auto">التجديد التلقائي</option>
                                      </select>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                      <button
                                          onClick={() => sendFixedExpiryWhatsApp('tenant')}
                                          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition"
                                      >
                                          <MessageCircle size={18} /> للمستأجر
                                      </button>
                                      <button
                                          onClick={() => sendFixedExpiryWhatsApp('owner')}
                                          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold transition"
                                      >
                                          <MessageCircle size={18} /> للمالك
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}
                      
                      {/* --- GROUPED DETAILS TABLE (Generic) --- */}
                      {selectedAlert.details && selectedAlert.details.length > 0 && (
                          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
                              <div className="bg-gray-50 dark:bg-slate-800 p-3 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                                  <Layers size={16} className="text-orange-500"/>
                                  التفاصيل ({selectedAlert.details.length})
                              </div>
                              
                              {selectedAlert.category === 'DataQuality' ? (
                                  /* DATA QUALITY (READ-ONLY + SEND) */
                                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                      {selectedAlert.مرجع_الجدول === 'العقارات_tbl' && (
                                          <div className="p-4 bg-indigo-50/40 dark:bg-indigo-900/10 border-b border-gray-100 dark:border-slate-800">
                                              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                                                  إرسال إخطار نقص بيانات العقارات
                                              </div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                                  يتم الإرسال للمالك/المالكين حسب كل عقار باستخدام قالب ثابت.
                                              </div>
                                              <button
                                                  onClick={() => void sendDataQualityPropertyWhatsApp()}
                                                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition"
                                              >
                                                  <MessageCircle size={18} /> إرسال واتساب للمالكين
                                              </button>
                                          </div>
                                      )}

                                      {selectedAlert.details.map((d: any) => {
                                          const missingFields: string[] = Array.isArray(d?.missingFields) ? d.missingFields : [];
                                          const missingText = missingFields.length ? missingFields.map(getMissingFieldLabel).join('، ') : '—';
                                          return (
                                              <div key={d.id} className="p-4">
                                                  <div className="flex justify-between items-center mb-2">
                                                      <span className="font-bold text-slate-700 dark:text-white">{d.name}</span>
                                                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded">نقص بيانات</span>
                                                  </div>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                                      الحقول الناقصة: <span className="font-bold text-slate-600 dark:text-slate-200">{missingText}</span>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              ) : (
                                  /* STANDARD LIST (Financial/Risk) */
                                  <table className="w-full text-right text-xs">
                                      <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500">
                                          <tr>
                                              {selectedAlert.category === 'Financial' && <th className="p-3">التاريخ</th>}
                                              <th className="p-3">{selectedAlert.category === 'Risk' ? 'الاسم' : 'القيمة'}</th>
                                              <th className="p-3">ملاحظات</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                          {selectedAlert.details.map(d => (
                                              <tr key={d.id}>
                                                  {selectedAlert.category === 'Financial' && <td className="p-3 font-medium text-red-600">{d.date}</td>}
                                                  <td className="p-3 font-bold">
                                                      {selectedAlert.category === 'Risk' ? d.name : `${d.amount?.toLocaleString()} د.أ`}
                                                  </td>
                                                  <td className="p-3 text-gray-400 dark:text-slate-400">{d.note || '-'}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              )}
                          </div>
                      )}

                      {/* Actions Grid */}
                      <div className="grid grid-cols-2 gap-3">
                          <button 
                             onClick={sendWhatsApp}
                             className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20"
                          >
                              <MessageCircle size={20} /> إرسال واتساب
                          </button>
                          
                          <button 
                             onClick={() => handleNavigate(selectedAlert)}
                                      className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 py-3 rounded-xl font-bold transition"
                          >
                              <FileText size={20} /> التفاصيل الكاملة
                          </button>

                          {/* Legal Notice Button (If Financial/Risk/Expiry) */}
                          {selectedAlert.category !== 'DataQuality' && selectedAlert.مرجع_المعرف !== 'batch' && (
                              <button 
                                 onClick={openLegalNotice}
                                 className="col-span-2 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 rounded-xl font-bold transition"
                              >
                                  <PenTool size={20} /> إرسال إخطار قانوني
                              </button>
                          )}
                      </div>

                      {/* Add Note Section (Only for specific/single alerts) */}
                      {selectedAlert.مرجع_المعرف !== 'batch' && (
                          <div>
                              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                  <StickyNote size={16} /> إضافة ملاحظة سريعة
                              </label>
                              <div className="flex gap-2">
                                  <input 
                                      type="text" 
                                      className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                      placeholder="ملاحظة للمتابعة..."
                                      value={noteText}
                                      onChange={e => setNoteText(e.target.value)}
                                  />
                                  <button 
                                      onClick={saveNote}
                                      className="bg-slate-800 dark:bg-slate-700 text-white p-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600"
                                  >
                                      <Send size={20} />
                                  </button>
                              </div>
                          </div>
                      )}

                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex justify-between items-center">
                      <button 
                          onClick={() => handleDismiss(selectedAlert)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
                      >
                          <CheckCircle size={16} /> تعليم كمقروء (تجاهل)
                      </button>
                                            <button
                                                onClick={() => setSelectedAlert(null)}
                                                className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white text-sm"
                                            >
                                                إغلاق
                                            </button>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
};

import { BadgeDollarSign, Bell, FileText, MessageCircle, Phone } from 'lucide-react';
import { SettingsMessageTemplatesSection } from '@/components/settings/sections/SettingsMessageTemplatesSection';
import { ROUTE_PATHS } from '@/routes/paths';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsMessagesSection({ page }: Props) {
  const {
    inputClass,
    labelClass,
    openPanel,
    parseMultilineList,
    setSettings,
    settings,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="space-y-8 animate-fade-in">
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <Bell className="text-indigo-500" size={20} /> إعدادات الرسائل والإشعارات
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            عدّل هذه القيم بسهولة بعد البيع (اسم الشركة، طرق الدفع، وأرقام الهواتف) لتنعكس
            على قوالب الرسائل/الإشعارات.
          </div>
    
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-6">
            يمكنك استخدام المتغيرات داخل أي رسالة مثل: {'{{اسم_الشركة}}'}،{' '}
            {'{{هاتف_الشركة}}'}، {'{{طرق_الدفع}}'}.
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass} htmlFor="settings-msg-company-name">
                اسم الشركة
              </label>
              <input
                id="settings-msg-company-name"
                className={inputClass}
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              />
            </div>
    
            <div>
              <label className={labelClass} htmlFor="settings-msg-company-phone">
                الهاتف الأساسي
              </label>
              <input
                id="settings-msg-company-phone"
                className={inputClass}
                value={settings.companyPhone}
                onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
              />
            </div>
          </div>
        </section>

        <SettingsMessageTemplatesSection page={page} />
    
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <MessageCircle className="text-indigo-500" size={20} /> طريقة الإرسال (واتساب)
          </h3>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass} htmlFor="settings-msg-whatsapp-target">
                طريقة فتح واتساب
              </label>
              <select
                id="settings-msg-whatsapp-target"
                className={inputClass}
                value={settings.whatsAppTarget || 'auto'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    whatsAppTarget:
                      (e.target.value as 'auto' | 'web' | 'desktop') || 'auto',
                  })
                }
              >
                <option value="auto">
                  تلقائي (Desktop داخل البرنامج / Web في المتصفح)
                </option>
                <option value="web">واتساب ويب (api.whatsapp.com)</option>
                <option value="desktop">واتساب سطح المكتب (whatsapp://)</option>
              </select>
            </div>
    
            <div>
              <label className={labelClass} htmlFor="settings-msg-whatsapp-delay">
                تأخير فتح المحادثات (مللي ثانية)
              </label>
              <input
                id="settings-msg-whatsapp-delay"
                type="number"
                className={inputClass}
                value={Number(settings.whatsAppDelayMs ?? 10_000)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    whatsAppDelayMs: Math.max(0, Number(e.target.value || 0) || 0),
                  })
                }
              />
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                مثال شائع: 10000 (10 ثواني) عند الإرسال لعدة أرقام.
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="settings-msg-whatsapp-auto-enabled"
                type="checkbox"
                className="mt-1 rounded border-slate-300"
                checked={!!settings.whatsAppAutoEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, whatsAppAutoEnabled: e.target.checked })
                }
              />
              <div>
                <label
                  htmlFor="settings-msg-whatsapp-auto-enabled"
                  className="text-sm font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  الإرسال التلقائي للتذكيرات (مسح الخلفية)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  عند التفعيل، يُفتح واتساب تلقائياً حسب الجدولة أدناه (ضمن ساعات العمل فقط، وليس
                  أكثر من مرة كل 24 ساعة لكل دفعة). معطّل افتراضياً.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass} htmlFor="settings-msg-whatsapp-work-start">
                  بداية ساعات الإرسال (0–23)
                </label>
                <input
                  id="settings-msg-whatsapp-work-start"
                  type="number"
                  min={0}
                  max={23}
                  className={inputClass}
                  value={Number(settings.whatsAppWorkHoursStart ?? 8)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      whatsAppWorkHoursStart: Math.max(
                        0,
                        Math.min(23, Math.floor(Number(e.target.value) || 0))
                      ),
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-msg-whatsapp-work-end">
                  نهاية ساعات الإرسال (0–24)
                </label>
                <input
                  id="settings-msg-whatsapp-work-end"
                  type="number"
                  min={0}
                  max={24}
                  className={inputClass}
                  value={Number(settings.whatsAppWorkHoursEnd ?? 20)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      whatsAppWorkHoursEnd: Math.max(
                        0,
                        Math.min(24, Math.floor(Number(e.target.value) || 0))
                      ),
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-msg-whatsapp-auto-delay-days">
                  تذكير قبل الاستحقاق (أيام)
                </label>
                <input
                  id="settings-msg-whatsapp-auto-delay-days"
                  type="number"
                  min={1}
                  max={30}
                  className={inputClass}
                  value={Number(settings.whatsAppAutoDelayDays ?? 3)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      whatsAppAutoDelayDays: Math.max(
                        1,
                        Math.min(30, Math.floor(Number(e.target.value) || 3))
                      ),
                    })
                  }
                />
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  يُرسل تذكير ودي عندما يبقى على الاستحقاق هذا العدد من الأيام (افتراضي 3). يُرسل
                  تنبيه يوم الاستحقاق، وتنبيه تأخر بعد 3 أيام.
                </div>
              </div>
            </div>
          </div>
        </section>
    
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <FileText className="text-slate-700 dark:text-slate-200" size={20} /> النماذج
            (القوالب)
          </h3>
    
          <div className="flex flex-col md:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={() => openPanel('NOTIFICATION_TEMPLATES', 'notification_templates')}
            >
              تعديل نماذج الرسائل والإشعارات
            </Button>
    
            <Button
              variant="secondary"
              onClick={() => {
                window.location.hash = ROUTE_PATHS.LEGAL;
              }}
            >
              القوالب القانونية (المركز القانوني)
            </Button>
          </div>
    
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
            ملاحظة: تم حقن اسم الشركة/الهواتف/طرق الدفع تلقائياً في جميع الرسائل التي تدعم{' '}
            {'{{...}}'}.
          </div>
        </section>
    
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Phone className="text-green-500" size={20} /> أرقام هواتف إضافية
          </h3>
          <div>
            <label className={labelClass} htmlFor="settings-msg-company-phones">
              رقم في كل سطر (أو افصل بفاصلة)
            </label>
            <textarea
              id="settings-msg-company-phones"
              className={inputClass + ' min-h-[120px]'}
              value={(settings.companyPhones ?? []).join('\n')}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  companyPhones: parseMultilineList(e.target.value),
                })
              }
              placeholder={'مثال:\n0790000000\n0780000000'}
            />
          </div>
        </section>
    
        <section className="settings-section-panel">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <BadgeDollarSign className="text-amber-500" size={20} /> طرق الدفع
          </h3>
          <div>
            <label className={labelClass} htmlFor="settings-msg-payment-methods">
              طريقة دفع في كل سطر
            </label>
            <textarea
              id="settings-msg-payment-methods"
              className={inputClass + ' min-h-[120px]'}
              value={(settings.paymentMethods ?? []).join('\n')}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  paymentMethods: parseMultilineList(e.target.value),
                })
              }
              placeholder={'مثال:\nنقداً\nتحويل بنكي\nمحفظة إلكترونية'}
            />
          </div>
        </section>
      </div>
    </RBACGuard>
  );
}

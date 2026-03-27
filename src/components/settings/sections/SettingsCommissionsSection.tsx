import React from 'react';
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
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsCommissionsSection({ page }: Props) {
  const {
    inputClass,
    labelClass,
    setSettings,
    settings,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-8 animate-fade-in">
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            عمولات البيع
          </h3>
          <div>
            <label className={labelClass} htmlFor="settings-sales-commission-percent">
              نسبة عمولة البيع (%)
            </label>
            <input
              id="settings-sales-commission-percent"
              type="number"
              className={inputClass}
              value={settings.salesCommissionPercent}
              onChange={(e) =>
                setSettings({ ...settings, salesCommissionPercent: Number(e.target.value) })
              }
            />
          </div>
        </section>
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            عمولات الإيجار
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                className={labelClass}
                htmlFor="settings-rental-commission-owner-percent"
              >
                عمولة المالك (%)
              </label>
              <input
                id="settings-rental-commission-owner-percent"
                type="number"
                className={inputClass}
                value={settings.rentalCommissionOwnerPercent || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rentalCommissionOwnerPercent: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label
                className={labelClass}
                htmlFor="settings-rental-commission-tenant-percent"
              >
                عمولة المستأجر (%)
              </label>
              <input
                id="settings-rental-commission-tenant-percent"
                type="number"
                className={inputClass}
                value={settings.rentalCommissionTenantPercent || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rentalCommissionTenantPercent: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </section>
      </div>
    </RBACGuard>
  );
}

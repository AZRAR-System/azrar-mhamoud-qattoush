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
import { ServerSqlSection } from '@/components/settings/ServerSqlSection';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsServerSection({ page }: Props) {
  const {
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredRole="SuperAdmin" fallback={settingsNoAccessFallback}>
      <ServerSqlSection />
    </RBACGuard>
  );
}

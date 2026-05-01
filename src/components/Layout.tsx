import { useEffect, useState, memo, useRef, Fragment, useCallback } from 'react';
import { useAutoLock } from '@/hooks/useAutoLock';
import { SessionLockOverlay } from '@/components/SessionLockOverlay';
import { getSettings } from '@/services/db/settings';
import { KEYS } from '@/services/db/keys';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants';
import {
  Bell,
  Menu,
  UserCircle,
  Moon,
  Sun,
  LogOut,
  Calendar,
  Clock as ClockIcon,
  X,
  ChevronRight,
  ChevronDown,
  Server,
} from 'lucide-react';
import { SmartModalEngine } from '@/components/shared/SmartModalEngine';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { OnboardingGuide } from '@/components/shared/OnboardingGuide';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_SUBTITLES, ROUTE_TITLES } from '@/routes/registry';
import { storage } from '@/services/storage';
import { isRole } from '@/utils/roles';
import { formatTimeHM } from '@/utils/format';
import { useInAppReminderNotifier } from '@/hooks/useInAppReminderNotifier';
import { getDatabaseStats as _getDatabaseStats } from '@/services/resetDatabase';
import { useToast } from '@/context/ToastContext';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';
import type { NotificationCenterItem } from '@/services/notificationCenter';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { ScrollToTopButton } from '@/components/shared/ScrollToTopButton';
import { المستخدمين_tbl } from '@/types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isCollectionCategory(cat: string): boolean {
  const c = String(cat || '').toLowerCase();
  return c === 'payments' || c === 'collection' || c.includes('payment');
}

/** أولوية الشارة: عاجل (أحمر) ثم تحصيل (أزرق) ثم عادي (رمادي) */
function headerUnreadBadgeVariant(unread: NotificationCenterItem[]): 'urgent' | 'collection' | 'default' {
  if (unread.some((i) => i.urgent)) return 'urgent';
  if (unread.some((i) => isCollectionCategory(i.category))) return 'collection';
  return 'default';
}
const getUnknownMessage = (v: unknown): string | undefined =>
  isRecord(v) && typeof v.message === 'string' ? v.message : undefined;
const getUnknownSuccess = (v: unknown): boolean | undefined =>
  isRecord(v) && typeof v.success === 'boolean' ? v.success : undefined;
const getUnknownPending = (v: unknown): boolean => (isRecord(v) ? Boolean(v.pending) : false);

// --- Optimized Clock Component ---
const LiveClock = memo(() => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = formatTimeHM(currentDate, { locale: 'en-US', hour12: true });

  return (
    <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-lg border border-slate-200/70 dark:border-slate-800 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 border-l border-slate-300/70 dark:border-slate-700 pl-3 ml-1">
        <Calendar size={14} className="text-indigo-500" />
        <span className="text-xs font-bold font-mono pt-0.5">{formattedDate}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <ClockIcon size={14} className="text-orange-500" />
        <span className="text-[10px] font-bold font-mono pt-0.5" dir="ltr">
          {formattedTime}
        </span>
      </div>
    </div>
  );
});

// --- Breadcrumbs Component ---
const Breadcrumbs = memo(({ pathname }: { pathname: string }) => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
      <a href="#/" className="hover:text-indigo-500 transition-colors">
        الرئيسية
      </a>
      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1;
        const label =
          ROUTE_TITLES[('/' + parts.slice(0, idx + 1).join('/')) as keyof typeof ROUTE_TITLES] ||
          part;
        return (
          <Fragment key={idx}>
            <ChevronRight size={10} className="text-slate-300 dark:text-slate-700" />
            <span className={isLast ? 'text-indigo-500/80 dark:text-indigo-400/80' : ''}>
              {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
});

// --- Sidebar Skeleton - Memoized to prevent re-renders on layout state changes ---
const Sidebar = memo(({ 
  isOpen, 
  isDesktop, 
  user, 
  appVersion, 
  expandedMenus, 
  onClose, 
  onToggleMenu, 
  onNavigate,
  onOpenAsPanel,
  onSetOpen
}: { 
  isOpen: boolean; 
  isDesktop: boolean; 
  user: المستخدمين_tbl | null; 
  appVersion: string;
  expandedMenus: string[];
  onClose: () => void;
  onToggleMenu: (label: string) => void;
  onNavigate: (path: string) => void;
  onOpenAsPanel: (path: string, title: string) => void;
  onSetOpen: (open: boolean) => void;
}) => {
  return (
    <aside
      className={`
        fixed lg:static inset-y-0 right-0 layer-app-sidebar
        w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
        text-slate-800 dark:text-slate-100 transition-all duration-500 ease-out
        flex flex-col shadow-2xl lg:shadow-none border-l border-white/20 dark:border-slate-800/50
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-24'}
      `}
    >
      {/* Modern Logo Header */}
      <div className="h-24 flex items-center justify-between px-6">
        {isOpen || !isDesktop ? (
          <div className="flex items-center gap-4 animate-fade-in">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-400 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 text-white font-black text-xl transform hover:rotate-6 transition-transform">
              A
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-gradient">AZRAR</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                v{appVersion || '—'} Real Estate
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">
              A
            </div>
          </div>
        )}

        {!isDesktop && (
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
            aria-label="إغلاق"
          >
            <X size={22} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const showFull = isOpen || !isDesktop;
          const hasChildren = !!(item.children && item.children.length > 0);
          const isExpanded = expandedMenus.includes(item.label);

          const activePath = window.location.hash.replace('#', '') || '/';

          const isSelfActive = activePath === item.path;
          const isChildActive = !!item.children?.some((c) => c.path === activePath);
          const isActive = isSelfActive || isChildActive;

          if (hasChildren) {
             const visibleChildren = (item.children ?? []).filter((child) => {
                if (child?.role && !isRole(user?.الدور, child.role)) return false;
                return true;
              });

            return (
              <div key={item.label} className="mb-2">
                <button
                  onClick={() => {
                    if (!showFull) onSetOpen(true);
                    onToggleMenu(item.label);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                    ${isActive ? 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'}
                    ${!showFull ? 'justify-center' : ''}
                  `}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                  />
                  {showFull && (
                    <>
                      <span className="text-sm font-bold flex-1 text-right">{item.label}</span>
                      <ChevronDown
                        size={18}
                        className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                  {isActive && !showFull && (
                    <div className="absolute left-0 w-1.5 h-8 bg-indigo-600 rounded-r-full shadow-lg shadow-indigo-600/50" />
                  )}
                </button>

                {showFull && isExpanded && (
                  <div className="mt-2 mr-6 border-r-2 border-indigo-100 dark:border-indigo-900/30 pr-4 space-y-1.5 animate-slide-up">
                    {visibleChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActiveInTabs = activePath === child.path;
                      return (
                        <button
                          key={child.path}
                          onClick={(e) => {
                            const ev = e as unknown as MouseEvent;
                            if (ev.ctrlKey || ev.metaKey) {
                              onOpenAsPanel(child.path, child.label);
                              return;
                            }
                            onNavigate(child.path);
                            if (!isDesktop) onClose();
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all
                            ${isChildActiveInTabs
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/40'}
                          `}
                        >
                          <ChildIcon size={16} />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.path}
              onClick={(e) => {
                const ev = e as unknown as MouseEvent;
                if (ev.ctrlKey || ev.metaKey) {
                  onOpenAsPanel(item.path, item.label);
                  return;
                }
                onNavigate(item.path);
                if (!isDesktop) onClose();
              }}
              className={`
                w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                ${isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-600/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'}
                ${!showFull ? 'justify-center' : ''}
              `}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform group-hover:scale-110"
              />
              {showFull && <span className="text-sm font-bold">{item.label}</span>}
              {isActive && !showFull && (
                <div className="absolute left-0 w-1.5 h-8 bg-white rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Block */}
      {(isOpen || !isDesktop) && (
        <div className="mx-4 mb-6 p-4 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40 border border-white/20 dark:border-slate-800/50 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-white dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-white dark:border-slate-800 shadow-inner">
                <UserCircle size={32} className="text-slate-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-slate-900 rounded-full shadow-lg"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                {user?.اسم_للعرض || user?.اسم_المستخدم || 'مستخدم'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {user?.الدور || '—'}
              </p>
            </div>
          </div>
          <a
            href="#/logout"
            className="mt-4 w-full inline-flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-red-100 dark:hover:border-red-900/30 hover:shadow-lg text-xs font-black"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </a>
        </div>
      )}
    </aside>
  );
});

const Header = memo(({
  pathname,
  title,
  subtitle,
  onOpenSidebar,
  isDark,
  toggleTheme,
  unreadCount,
  hasUnreadUrgent,
  headerBadgeVariant,
  sqlStatus,
  hasDesktopBridge,
  onOpenPanel,
  onNotificationsClick,
}: {
  pathname: string;
  title: string;
  subtitle: string;
  onOpenSidebar: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  unreadCount: number;
  hasUnreadUrgent: boolean;
  headerBadgeVariant: 'urgent' | 'collection' | 'default';
  sqlStatus: {
    configured: boolean;
    enabled: boolean;
    connected: boolean;
    lastError?: string;
    lastSyncAt?: string;
  } | null;
  hasDesktopBridge: boolean;
  onOpenPanel: (type: string, id?: string, options?: Record<string, unknown>) => void;
  onNotificationsClick: () => void;
}) => {
  return (
    <header className="mx-4 lg:mx-8 mt-4 mb-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 flex items-center justify-between px-6 py-4 rounded-3xl shadow-soft layer-app-header transition-all">
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:scale-105 active:scale-95 transition-all"
        >
          <Menu size={24} />
        </button>

        <div className="flex flex-col">
          <Breadcrumbs pathname={pathname} />
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="w-2 h-8 bg-indigo-500 rounded-full" />
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[11px] lg:text-xs font-bold text-slate-400 dark:text-slate-500 leading-snug mt-1 max-w-[48rem]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

        <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden xl:block">
          <LiveClock />
        </div>

        <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <GlobalSearch />
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          {hasDesktopBridge && sqlStatus && (
            <button
              onClick={() =>
                onOpenPanel('SERVER_DRAWER', undefined, {
                  title: 'إعدادات المخدم',
                  initialSection: 'server',
                })
              }
              className={`relative p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 transition-all hover:scale-105 active:scale-95 ${
                sqlStatus?.enabled
                  ? sqlStatus?.connected
                    ? 'text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10'
                    : 'text-red-600 dark:text-red-400 shadow-red-500/10'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Server size={20} />
              {sqlStatus?.enabled && (
                <span
                  className={`absolute top-2 right-2 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse ${
                    sqlStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:rotate-12"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            type="button"
            onClick={onNotificationsClick}
            className={`relative p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm ${
              unreadCount === 0
                ? 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
                : headerBadgeVariant === 'urgent'
                  ? 'text-red-600 dark:text-red-400 hover:text-red-700'
                  : headerBadgeVariant === 'collection'
                    ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
            }`}
          >
            <Bell size={20} />
            <span className="pointer-events-none absolute -top-1 -right-1 flex h-[26px] min-w-[26px] items-center justify-center">
              {hasUnreadUrgent && unreadCount > 0 && (
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"
                />
              )}
              <span
                className={`relative flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[10px] font-black text-white shadow-lg ring-4 ring-white transition-all duration-300 ease-out dark:ring-slate-900 ${
                  headerBadgeVariant === 'urgent'
                    ? 'bg-red-600 shadow-red-500/35'
                    : headerBadgeVariant === 'collection'
                      ? 'bg-blue-600 shadow-blue-500/30'
                      : 'bg-slate-500 shadow-slate-500/25 dark:bg-slate-600'
                } ${unreadCount > 0 ? 'scale-100 opacity-100' : 'pointer-events-none scale-0 opacity-0'}`}
              >
                {unreadCount > 99 ? '99+' : unreadCount > 0 ? unreadCount : ''}
              </span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
});

export const Layout = () => {
  type SqlStatus = {
    configured: boolean;
    enabled: boolean;
    connected: boolean;
    lastError?: string;
    lastSyncAt?: string;
  };
  type DesktopOkMessage = { ok?: boolean; message?: string };
  const _DesktopOkMessage_type_check: DesktopOkMessage = {}; // Mark as used conceptually

  type SqlSyncEvent = {
    id: string;
    ts: string;
    direction: 'push' | 'pull' | 'system';
    action: string;
    key?: string;
    status: 'ok' | 'error';
    message?: string;
  };

  const { openPanel, activePanels, closePanel, closeAll } = useSmartModal();
  const { user, isAuthenticated, sessionLocked, lockSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 1. Global Search (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('azrar:global-search:open'));
      }

      // 2. New Item / Quick Add (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openPanel('QUICK_ADD');
      }

      // 3. Help & Escape
      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        openPanel('SHORTCUTS_HELP');
      }
      if (e.key === 'Escape') {
        // If there are active modals/drawers, close the top-most one
        if (activePanels.length > 0) {
          const topPanel = activePanels[activePanels.length - 1];
          // We let ConfirmModal handle its own ESC logic if possible, 
          // but for general panels we close them here.
          if (topPanel.type !== 'CONFIRM_MODAL') {
            closePanel(topPanel.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activePanels, closePanel, openPanel]);

  const [autoLockMinutes, setAutoLockMinutes] = useState(() => getSettings().autoLockMinutes ?? 30);
  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const d = (e as CustomEvent<{ key?: string }>).detail;
      if (d?.key === KEYS.SETTINGS) setAutoLockMinutes(getSettings().autoLockMinutes ?? 30);
    };
    window.addEventListener('azrar:db-changed', onSettingsChanged as EventListener);
    return () => window.removeEventListener('azrar:db-changed', onSettingsChanged as EventListener);
  }, []);
  useAutoLock(isAuthenticated && !sessionLocked, autoLockMinutes, lockSession);

  // In-app reminder sound/toast notifier (today reminders)
  useInAppReminderNotifier();

  const [appVersion, setAppVersion] = useState<string>('');
  const postUpdateRestorePromptGuard = useRef(false);
  const _serverOnboardingGuard = useRef(false);


  const hasDesktopBridge = !!window.desktopDb;
  const [sqlStatus, setSqlStatus] = useState<{
    configured: boolean;
    enabled: boolean;
    connected: boolean;
    lastError?: string;
    lastSyncAt?: string;
  } | null>(null);
  const rrLocation = useLocation();
  const pathname = rrLocation.pathname || '/';

  // Global: toast notification when sync applies changes (throttled)
  const syncToastAggRef = useRef<{
    upserts: number;
    deletes: number;
    errors: number;
    timer: ReturnType<typeof setTimeout> | null;
    lastToastAt: number;
  }>({ upserts: 0, deletes: 0, errors: 0, timer: null, lastToastAt: 0 });

  useEffect(() => {
    if (!hasDesktopBridge || !window.desktopDb?.onSqlSyncEvent) return;

    const agg = syncToastAggRef.current;

    const flush = () => {
      if (agg.timer) {
        clearTimeout(agg.timer);
        agg.timer = null;
      }
      if (agg.upserts === 0 && agg.deletes === 0 && agg.errors === 0) return;

      const now = Date.now();
      const minIntervalMs = 1800;
      const wait = agg.lastToastAt ? Math.max(0, minIntervalMs - (now - agg.lastToastAt)) : 0;
      if (wait > 0) {
        agg.timer = setTimeout(flush, wait);
        return;
      }

      if (agg.errors > 0) {
        toast.showToast(`فشل مزامنة ${agg.errors} عملية`, 'error', 'المزامنة', { sound: false });
      } else if (agg.deletes > 0 && agg.upserts === 0) {
        toast.showToast(`تمت مزامنة ${agg.deletes} حذف`, 'delete', 'المزامنة', { sound: false });
      } else {
        const parts: string[] = [];
        if (agg.upserts > 0) parts.push(`${agg.upserts} تحديث`);
        if (agg.deletes > 0) parts.push(`${agg.deletes} حذف`);
        toast.showToast(`تمت المزامنة: ${parts.join(' / ')}`, 'success', 'المزامنة', {
          sound: false,
        });
      }

      agg.lastToastAt = Date.now();
      agg.upserts = 0;
      agg.deletes = 0;
      agg.errors = 0;
    };

    const onEvent = (evt: SqlSyncEvent) => {
      // Only toast for applied changes (push/pull), ignore system events.
      if (!evt || evt.direction === 'system') return;

      if (evt.status === 'error') agg.errors += 1;
      else if (typeof evt.action === 'string' && evt.action.toLowerCase().includes('delete'))
        agg.deletes += 1;
      else if (typeof evt.action === 'string' && evt.action.toLowerCase().includes('upsert'))
        agg.upserts += 1;
      else {
        // Fallback: treat unknown successful change as an upsert
        agg.upserts += 1;
      }

      if (agg.timer) clearTimeout(agg.timer);
      agg.timer = setTimeout(flush, 600);
    };

    const off = window.desktopDb.onSqlSyncEvent(onEvent);
    return () => {
      try {
        off?.();
      } catch {
        // ignore
      }
      if (agg.timer) {
        clearTimeout(agg.timer);
        agg.timer = null;
      }
    };
  }, [hasDesktopBridge, toast]);

  // Poll SQL sync status (Desktop only)
  useEffect(() => {
    if (!hasDesktopBridge || !window.desktopDb?.sqlStatus) return;
    let cancelled = false;

    const sqlStatusFn = window.desktopDb.sqlStatus;
    if (!sqlStatusFn) return;

    const tick = async () => {
      try {
        const st = (await sqlStatusFn()) as unknown as SqlStatus | null;
        if (!cancelled) setSqlStatus(st || null);
      } catch {
        if (!cancelled)
          setSqlStatus((prev) =>
            prev
              ? { ...prev, connected: false }
              : { configured: false, enabled: false, connected: false }
          );
      }
    };

    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [hasDesktopBridge]);

  // First-run: if local DB empty, show server drawer and attempt auto-restore if configured
  // DISABLED: Removed automatic onset of server drawer per user request to cancel auto-setup.
  /*
  useEffect(() => {
    if (!hasDesktopBridge) return;
    if (serverOnboardingGuard.current) return;
    serverOnboardingGuard.current = true;

    let cancelled = false;
    const run = async () => {
      try {
        const stats = await getDatabaseStats();
        if (cancelled) return;
        const total = Object.values(stats || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
        const isEmpty = total === 0;
        if (!isEmpty) return;

        const autoRestoreAttemptKey = 'azrar_auto_restore_attempted_v1';
        const alreadyAttempted = localStorage.getItem(autoRestoreAttemptKey) === '1';

        // Always show server connection screen first in a new system
        openPanel('SERVER_DRAWER', undefined, {
          title: 'إعدادات المخدم',
          initialSection: 'server',
        });

        // If already configured+enabled, attempt to connect and pull immediately (once)
        if (!alreadyAttempted) {
          localStorage.setItem(autoRestoreAttemptKey, '1');
          const st = (await window.desktopDb?.sqlStatus?.()) as unknown as SqlStatus | null;
          if (cancelled) return;
          if (st?.configured && st?.enabled) {
            await window.desktopDb?.sqlConnect?.();
            const syncRes =
              (await window.desktopDb?.sqlSyncNow?.()) as unknown as DesktopOkMessage | null;
            if (cancelled) return;
            if (syncRes?.ok) {
              // Reload to rebuild in-memory indexes/caches and ensure relationships are consistent
              window.location.reload();
            }
          }
        }
      } catch {
        // ignore
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hasDesktopBridge, openPanel]);
  */

  useEffect(() => {
    let cancelled = false;
    const bridge = window.desktopUpdater;
    if (!bridge?.getVersion) return;

    Promise.resolve(bridge.getVersion())
      .then((v) => {
        if (!cancelled) setAppVersion(String(v || ''));
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Post-update mandatory restore prompt (Desktop only)
  useEffect(() => {
    if (postUpdateRestorePromptGuard.current) return;
    postUpdateRestorePromptGuard.current = true;

    // Prevent rapid re-opening during the same renderer session (e.g., if providers remount)
    try {
      const alreadyShown = sessionStorage.getItem('post_update_restore_prompt_shown') === '1';
      if (alreadyShown) return;
      sessionStorage.setItem('post_update_restore_prompt_shown', '1');
    } catch {
      // ignore
    }

    let cancelled = false;
    const bridge = window.desktopUpdater;
    if (!bridge?.getPendingRestore || !bridge?.restorePending || !bridge?.clearPendingRestore)
      return;

    Promise.resolve(bridge.getPendingRestore())
      .then((info: unknown) => {
        if (cancelled) return;
        if (!getUnknownPending(info)) return;

        openPanel('CONFIRM_MODAL', 'post_update_restore', {
          title: 'تم تحديث النظام',
          variant: 'danger',
          confirmText: 'استرجاع النسخة الاحتياطية',
          cancelText: 'تجاهل',
          message: `تم أخذ نسخة احتياطية إجبارية قبل التحديث.

هل تريد استرجاع البيانات الآن؟

ملاحظة: سيؤدي الاسترجاع إلى استبدال البيانات الحالية.`,
          onConfirm: async () => {
            try {
              const res = await bridge.restorePending();
              if (getUnknownSuccess(res) === false) {
                openPanel('CONFIRM_MODAL', 'restore_failed', {
                  title: 'فشل الاسترجاع',
                  confirmText: 'حسناً',
                  message: getUnknownMessage(res) || 'تعذر استرجاع النسخة الاحتياطية.',
                });
                return;
              }
              // Refresh the app after restore
              setTimeout(() => window.location.reload(), 700);
            } catch (e: unknown) {
              openPanel('CONFIRM_MODAL', 'restore_failed_exception', {
                title: 'فشل الاسترجاع',
                confirmText: 'حسناً',
                message:
                  (e instanceof Error ? e.message : undefined) || 'تعذر استرجاع النسخة الاحتياطية.',
              });
            }
          },
          onCancel: async () => {
            try {
              await bridge.clearPendingRestore();
            } catch {
              // ignore
            }
          },
        });
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [openPanel]);

  const handleNotificationsClick = useCallback(() => {
    closeAll();
    navigate(ROUTE_PATHS.ALERTS);
  }, [closeAll, navigate]);


  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isDark, setIsDark] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['المشرفين']); // Default expand admins

  const { items: notificationItems, unreadCount, hasUnreadUrgent } = useNotificationCenter();
  const unreadItems = notificationItems.filter((i) => !i.read);
  const headerBadgeVariant = headerUnreadBadgeVariant(unreadItems);

  // ================================
  //  Responsiveness & Theme
  // ================================
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init

    // Theme init (supports Desktop storage bridge)
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      void (async () => {
        const savedTheme = await storage.getItem('theme');
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        setIsDark(shouldUseDark);
        document.documentElement.classList.toggle('dark', shouldUseDark);
        // Helps native form controls match theme
        document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      })();
    } catch {
      // ignore
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on mobile route change
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [location.pathname, isDesktop]);

  // Mobile sidebar parity: ESC closes + lock body scroll
  useEffect(() => {
    if (isDesktop) return;
    if (!sidebarOpen) return;

    lockBodyScroll();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSidebarOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [isDesktop, sidebarOpen]);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    try {
      void storage.setItem('theme', newMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', newMode);
    document.documentElement.style.colorScheme = newMode ? 'dark' : 'light';
  };

  const getPageTitle = () => {
    const byRoute = ROUTE_TITLES[location.pathname];
    if (byRoute) return byRoute;

    // Search in top level
    const current = NAV_ITEMS.find((n) => n.path === location.pathname);
    if (current) return current.label;

    // Search in children
    for (const item of NAV_ITEMS) {
      const child = item.children?.find((c) => c.path === location.pathname);
      if (child) return child.label;
    }
    return 'نظام AZRAR';
  };

  const getPageSubtitle = () => {
    const byRoute = ROUTE_SUBTITLES[location.pathname];
    return byRoute ? String(byRoute) : '';
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300 font-sans">
      {/* ================================ */}
      {/* Mobile Overlay */}
      {/* ================================ */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md layer-app-drawer-backdrop animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================================ */}
      {/* Sidebar - Memoized */}
      {/* ================================ */}
      <Sidebar 
          isOpen={sidebarOpen}
          isDesktop={isDesktop}
          user={user}
          appVersion={appVersion}
          expandedMenus={expandedMenus}
          onClose={() => setSidebarOpen(false)}
          onToggleMenu={toggleMenu}
          onNavigate={(path) => navigate(path)}
          onOpenAsPanel={(path, title) =>
            openPanel('SECTION_VIEW', path, { title, __stack: true, __centerModal: true, __minimizable: true })
          }
          onSetOpen={setSidebarOpen}
      />

      {/* ================================ */}
      {/* Main Content Area */}
      {/* ================================ */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative w-full layer-page-main transition-all">
        {/* Floating Modern Header - Memoized */}
        <Header 
            pathname={pathname}
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            isDark={isDark}
            toggleTheme={toggleTheme}
            unreadCount={unreadCount}
            hasUnreadUrgent={hasUnreadUrgent}
            headerBadgeVariant={headerBadgeVariant}
            sqlStatus={sqlStatus}
            hasDesktopBridge={hasDesktopBridge}
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenPanel={openPanel}
            onNotificationsClick={handleNotificationsClick}
        />

        {/* Content Container - Modern Layout */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative w-full bg-transparent pt-4" ref={(el) => { if (el) window.__mainScrollEl = el; }}>
            <div className="w-full page-transition pb-20 lg:pb-10 flex flex-col px-4 lg:px-8 min-h-full">
              <Outlet />

            {/* Elegant Footer */}
            <footer className="mt-auto py-10 text-center shrink-0">
              <div className="inline-flex flex-col items-center gap-2 px-6 py-3 rounded-2xl bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm border border-white/10 dark:border-slate-800/30">
                <p dir="ltr" className="text-[10px] font-bold text-slate-400 dark:text-slate-600">
                  &copy; 2025 — PRO EDITION — DEVELOPED BY{' '}
                  <span className="text-indigo-500/80 dark:text-indigo-400/80">MAHMOUD QATTOUSH</span>
                </p>
                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                <p
                  dir="ltr"
                  className="text-[9px] text-slate-300 dark:text-slate-700 tracking-[0.2em] uppercase"
                >
                  AZRAR Real Estate Management
                </p>
              </div>
            </footer>
          </div>
        </main>

        {/* Scroll To Top */}
        <div className="fixed bottom-6 start-6 layer-app-fab">
          <ScrollToTopButton scrollContainer={typeof window !== 'undefined' ? window.__mainScrollEl ?? null : null} />
        </div>

        {/* Engine Layers */}
        <SmartModalEngine />
        <OnboardingGuide />
        <SessionLockOverlay />
      </div>
    </div>
  );
};

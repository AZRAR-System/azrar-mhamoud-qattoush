import React, { useEffect, useState, memo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants';
import { Bell, Menu, UserCircle, Moon, Sun, LogOut, Calendar, Clock as ClockIcon, X, ChevronRight, ChevronDown, Server } from 'lucide-react';
import { SmartModalEngine } from '@/components/shared/SmartModalEngine';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { OnboardingGuide } from '@/components/shared/OnboardingGuide';
import { useSmartModal } from '@/context/ModalContext';
import { DbService } from '@/services/mockDb';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_SUBTITLES, ROUTE_TITLES, type NavItem } from '@/routes/registry';
import { storage } from '@/services/storage';
import { isRole } from '@/utils/roles';
import { formatTimeHM } from '@/utils/format';
import { useInAppReminderNotifier } from '@/hooks/useInAppReminderNotifier';
import { getDatabaseStats } from '@/services/resetDatabase';
import { useToast } from '@/context/ToastContext';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getUnknownMessage = (v: unknown): string | undefined => (isRecord(v) && typeof v.message === 'string' ? v.message : undefined);
const getUnknownSuccess = (v: unknown): boolean | undefined => (isRecord(v) && typeof v.success === 'boolean' ? v.success : undefined);
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
    year: 'numeric'
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
          <span className="text-[10px] font-bold font-mono pt-0.5" dir="ltr">{formattedTime}</span>
       </div>
    </div>
  );
});

export const Layout = ({ children }: { children: React.ReactNode }) => {
  type SqlStatus = { configured: boolean; enabled: boolean; connected: boolean; lastError?: string; lastSyncAt?: string };
  type DesktopOkMessage = { ok?: boolean; message?: string };
  type SqlSyncEvent = { id: string; ts: string; direction: 'push' | 'pull' | 'system'; action: string; key?: string; status: 'ok' | 'error'; message?: string };

  const { openPanel } = useSmartModal();
  const { user } = useAuth();
  const toast = useToast();

  // In-app reminder sound/toast notifier (today reminders)
  useInAppReminderNotifier();

  const [appVersion, setAppVersion] = useState<string>('');
  const postUpdateRestorePromptGuard = useRef(false);
  const serverOnboardingGuard = useRef(false);

  const hasDesktopBridge = !!window.desktopDb;
  const [sqlStatus, setSqlStatus] = useState<{ configured: boolean; enabled: boolean; connected: boolean; lastError?: string; lastSyncAt?: string } | null>(null);
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
        toast.showToast(`تمت المزامنة: ${parts.join(' / ')}`, 'success', 'المزامنة', { sound: false });
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
      else if (typeof evt.action === 'string' && evt.action.toLowerCase().includes('delete')) agg.deletes += 1;
      else if (typeof evt.action === 'string' && evt.action.toLowerCase().includes('upsert')) agg.upserts += 1;
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
        if (!cancelled) setSqlStatus(prev => prev ? { ...prev, connected: false } : { configured: false, enabled: false, connected: false });
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
        openPanel('SERVER_DRAWER', undefined, { title: 'إعدادات المخدم', initialSection: 'server' });

        // If already configured+enabled, attempt to connect and pull immediately (once)
        if (!alreadyAttempted) {
          localStorage.setItem(autoRestoreAttemptKey, '1');
          const st = (await window.desktopDb?.sqlStatus?.()) as unknown as SqlStatus | null;
          if (cancelled) return;
          if (st?.configured && st?.enabled) {
            await window.desktopDb?.sqlConnect?.();
            const syncRes = (await window.desktopDb?.sqlSyncNow?.()) as unknown as DesktopOkMessage | null;
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
    if (!bridge?.getPendingRestore || !bridge?.restorePending || !bridge?.clearPendingRestore) return;

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
                message: (e instanceof Error ? e.message : undefined) || 'تعذر استرجاع النسخة الاحتياطية.',
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

  const location = { pathname }; // Compatibility shim

  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isDark, setIsDark] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['المشرفين']); // Default expand admins
  const [paymentNotifCount, setPaymentNotifCount] = useState<number>(0);

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

  // Header notification badge (real data)
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      try {
        const targets = DbService.getPaymentNotificationTargets(7);
        const count = targets.reduce((sum, t) => sum + (t.items?.length || 0), 0);
        if (!cancelled) setPaymentNotifCount(count);
      } catch {
        if (!cancelled) setPaymentNotifCount(0);
      }
    };

    refresh();
    const interval = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

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
    const current = NAV_ITEMS.find(n => n.path === location.pathname);
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
      setExpandedMenus(prev => 
        prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
      );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">

      {/* ================================ */}
      {/* Mobile Overlay */}
      {/* ================================ */}
      {!isDesktop && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm layer-sidebar animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
      )}

      {/* ================================ */}
      {/* Sidebar */}
      {/* ================================ */}
      <aside
        className={`
          fixed lg:static inset-y-0 right-0 layer-sidebar
          w-72 bg-white dark:bg-slate-900 
          text-slate-800 dark:text-slate-100 transition-transform duration-300 ease-out
          flex flex-col shadow-2xl lg:shadow-none border-l border-gray-100 dark:border-slate-800
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-20'}
        `}
      >
        {/* Logo / Toggle */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-gray-100 dark:border-slate-800">
          {(sidebarOpen || !isDesktop) ? (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-indigo-500/20 shadow-lg text-white font-bold text-lg">
                A
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold leading-tight">AZRAR</span>
                <span className="text-[10px] text-slate-400">الإصدار {appVersion || '—'}</span>
              </div>
            </div>
          ) : (
             <div className="w-full flex justify-center">
               <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">A</div>
             </div>
          )}

          {!isDesktop && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-red-500"
                aria-label="إغلاق الشريط الجانبي"
                title="إغلاق الشريط الجانبي"
              >
                  <X size={20} />
              </button>
          )}
          
          {isDesktop && sidebarOpen && (
             <button
               type="button"
               onClick={() => setSidebarOpen(false)}
               className="p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-slate-400 hover:text-indigo-500"
               aria-label="طي الشريط الجانبي"
               title="طي الشريط الجانبي"
             >
                 <ChevronRight size={16} />
             </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {NAV_ITEMS.map((item: NavItem) => {
            const Icon = item.icon;
            const isOpenState = (sidebarOpen || !isDesktop);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus.includes(item.label);
            
            // Active State Logic
            const isSelfActive = location.pathname === item.path;
            const isChildActive = !!item.children?.some((c) => c.path === location.pathname);
            const isActive = isSelfActive || isChildActive;

            if (hasChildren) {
                const visibleChildren = (item.children ?? []).filter((child) => {
                  if (child?.role && !isRole(user?.الدور, child.role)) return false;
                  return true;
                });

                return (
                    <div key={item.label} className="mb-1">
                        <button
                            onClick={() => {
                                if (!isOpenState) setSidebarOpen(true);
                                toggleMenu(item.label);
                            }}
                            title={!isOpenState ? item.label : ''}
                            className={`
                                w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative select-none
                              ${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-slate-800/60 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'}
                                ${!isOpenState ? 'justify-center' : ''}
                            `}
                        >
                            <Icon size={20} strokeWidth={2} className={`relative z-10 ${isActive ? 'text-indigo-600 dark:text-indigo-300' : ''}`} />
                            {isOpenState && (
                                <>
                                    <span className="text-sm font-bold relative z-10 flex-1 text-right">{item.label}</span>
                                    <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </>
                            )}
                            
                            {/* Dot indicator for collapsed view if child active */}
                            {!isOpenState && isChildActive && (
                              <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full"></div>
                            )}
                        </button>

                        {/* Submenu */}
                        {isOpenState && isExpanded && (
                            <div className="mt-1 mr-4 border-r-2 border-slate-100 dark:border-slate-700/50 pr-2 space-y-1 animate-slide-up">
                                {visibleChildren.map((child) => {
                                    const ChildIcon = child.icon;
                                    const isChildActive = location.pathname === child.path;
                                    return (
                                        <a
                                            key={child.path}
                                            href={`#${child.path}`}
                                            className={`
                                              flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all
                                                ${isChildActive
                                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                                                }
                                            `}
                                        >
                                            <ChildIcon size={16} />
                                            <span>{child.label}</span>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }
            
            // Standard Item
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                title={!isOpenState ? item.label : ''}
                className={
                  `
                  flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative select-none
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }
                  ${!isOpenState ? 'justify-center' : ''}
                `
                }
              >
                <Icon size={20} strokeWidth={2} className={`relative z-10 transition-transform group-hover:scale-110`} />
                {isOpenState && <span className="text-sm font-bold relative z-10">{item.label}</span>}
                
                {/* Active Indicator for Collapsed Mode */}
                {!isOpenState && isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-l-full bg-indigo-600 opacity-100 transition-opacity"></div>
                )}
              </a>
            );
          })}
        </nav>

        {/* Desktop Toggle (When collapsed) */}
        {isDesktop && !sidebarOpen && (
            <div className="p-3 border-t border-gray-100 dark:border-slate-800 flex justify-center">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
            aria-label="فتح الشريط الجانبي"
            title="فتح الشريط الجانبي"
          >
                    <Menu size={20} />
                </button>
            </div>
        )}

        {/* User Block */}
        {(sidebarOpen || !isDesktop) && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
              <div className="flex items-start gap-3">
                  <div className="relative mt-0.5">
                      <UserCircle size={36} className="text-slate-400" />
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-normal break-words leading-snug">
                          {user?.اسم_للعرض || user?.اسم_المستخدم || 'مستخدم'}
                      </p>
                      <p className="text-[10px] text-slate-400 whitespace-normal break-words">
                        متصل{user?.الدور ? ` • ${user.الدور}` : ''}
                      </p>
                  </div>
              </div>

              <a
                href="#/logout"
                className="mt-3 w-full inline-flex items-center justify-center gap-2 text-slate-600 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 transition px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/10 text-xs font-bold"
                title="تسجيل الخروج"
              >
                <LogOut size={16} />
                <span>تسجيل الخروج</span>
              </a>
            </div>
        )}
      </aside>

      {/* ================================ */}
      {/* Main Content */}
      {/* ================================ */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full layer-content">

        {/* Header */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shadow-sm layer-header transition-colors py-3">
          
          <div className="flex items-center gap-4">
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                aria-label="فتح الشريط الجانبي"
                title="فتح الشريط الجانبي"
              >
                    <Menu size={24} />
                </button>
            )}
            
            <div className="flex flex-col">
              <h1 className="text-lg lg:text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                {getPageTitle()}
              </h1>
              {getPageSubtitle() ? (
                <p className="text-[11px] lg:text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5 max-w-[48rem]">
                  {getPageSubtitle()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
            
            <div className="hidden md:block">
                <LiveClock />
            </div>

            {/* Mobile Search Trigger */}
            <div className="md:hidden">
                 <GlobalSearch /> 
            </div>
            
            {/* Desktop Search */}
            <div className="hidden md:block">
                 <GlobalSearch />
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            {hasDesktopBridge && window.desktopDb?.sqlStatus && (
              <button
                onClick={() => openPanel('SERVER_DRAWER', undefined, { title: 'إعدادات المخدم', initialSection: 'server' })}
                className={`relative p-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/60 transition-colors ${
                  sqlStatus?.enabled
                    ? (sqlStatus?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title={
                  sqlStatus?.enabled
                    ? (sqlStatus?.connected ? 'متصل بالمخدم' : 'غير متصل بالمخدم')
                    : 'المزامنة غير مفعلة'
                }
              >
                <Server size={18} />
                {sqlStatus?.enabled && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                      sqlStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-yellow-300 transition-colors"
              aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
              title={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => openPanel('PAYMENT_NOTIFICATIONS', undefined, { daysAhead: 7 })}
              className="relative p-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
              title={paymentNotifCount > 0 ? `تنبيهات الدفعات (${paymentNotifCount})` : 'تنبيهات الدفعات'}
            >
              <Bell size={18} />
              {paymentNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                  {paymentNotifCount > 99 ? '99+' : paymentNotifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/60 dark:bg-slate-950 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full animate-fade-in-up pb-20 lg:pb-0 min-h-[calc(100vh-8rem)]">
              {children}
          </div>
          
          {/* Global Footer */}
          <footer className="py-6 text-center text-[10px] text-slate-400 dark:text-slate-600">
            <p dir="ltr">&copy; 2025 — Developed by <span className="font-bold text-slate-500 dark:text-slate-500">Mahmoud Qattoush</span></p>
            <p dir="ltr">AZRAR Real Estate Management System — All Rights Reserved</p>
          </footer>
        </main>

        {/* Global Modal Layer */}
        <SmartModalEngine />
        
        {/* Onboarding Layer (Will only show if needed) */}
        <OnboardingGuide />
      </div>
    </div>
  );
};

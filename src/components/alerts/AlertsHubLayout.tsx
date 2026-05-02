import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, FileEdit, MessageCircle } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

function tabKey(userId: string) {
  return `azrar_alerts_hub_tab_${userId}`;
}

export function AlertsHubLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const userId = String(user?.id ?? 'anon');

  useEffect(() => {
    const p = location.pathname;
    if (p === ROUTE_PATHS.ALERTS) sessionStorage.setItem(tabKey(userId), 'notifications');
    else if (p === ROUTE_PATHS.ALERTS_BULK) sessionStorage.setItem(tabKey(userId), 'bulk');
    else if (p === ROUTE_PATHS.ALERTS_TEMPLATES) sessionStorage.setItem(tabKey(userId), 'templates');
  }, [location.pathname, userId]);

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition-colors min-w-0 sm:flex-none sm:px-5',
      isActive
        ? 'bg-indigo-600 text-white shadow-md'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <nav
          className="mx-auto flex max-w-6xl flex-wrap gap-2"
          aria-label="أقسام مركز التنبيهات والرسائل"
        >
          <NavLink to={ROUTE_PATHS.ALERTS} end className={tabClass}>
            <Bell size={16} className="shrink-0 opacity-90" />
            <span className="truncate">مركز الإشعارات</span>
          </NavLink>
          <NavLink to={ROUTE_PATHS.ALERTS_BULK} className={tabClass}>
            <MessageCircle size={16} className="shrink-0 opacity-90" />
            <span className="truncate">واتساب جماعي</span>
          </NavLink>
          <NavLink to={ROUTE_PATHS.ALERTS_TEMPLATES} className={tabClass}>
            <FileEdit size={16} className="shrink-0 opacity-90" />
            <span className="truncate">نماذج الرسائل</span>
          </NavLink>
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

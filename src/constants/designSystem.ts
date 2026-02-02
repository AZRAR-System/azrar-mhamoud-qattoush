
export const DS = {
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
  },
  radius: {
    sm: 'rounded-md', 
    md: 'rounded-xl', 
    lg: 'rounded-2xl', 
    full: 'rounded-full'
  },
  colors: {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60',
    outline: 'bg-transparent border border-indigo-600/40 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10',
  },
  shadow: {
    soft: 'shadow-sm',
    medium: 'shadow-md',
    strong: 'shadow-lg',
  },
  components: {
    card: 'app-card transition-colors',
    table: {
      wrapper: 'app-table-wrapper relative',
      header: 'bg-slate-50/80 dark:bg-slate-950/40 backdrop-blur-sm text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider border-b border-slate-200/70 dark:border-slate-800 sticky top-0 z-10',
      row: 'border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors last:border-0 group',
      cell: 'p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-normal break-words align-middle',
    },
    pageHeader:
      'bg-white/90 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative p-4 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6',
    pageTitle: 'text-xl lg:text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight',
    pageSubtitle: 'text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug',
  },
  durations: {
    fast: '150ms',
    normal: '300ms',
  }
};

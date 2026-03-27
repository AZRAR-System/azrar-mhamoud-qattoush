
export const DS = {
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
  },
  radius: {
    sm: 'rounded-xl', 
    md: 'rounded-2xl', 
    lg: 'rounded-3xl', 
    full: 'rounded-full'
  },
  colors: {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all duration-300',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 active:scale-95 transition-all duration-300',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/40 active:scale-95 transition-all duration-300',
    outline: 'bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-600 hover:text-indigo-600 active:scale-95 transition-all duration-300',
  },
  shadow: {
    soft: 'shadow-soft',
    medium: 'shadow-md',
    strong: 'shadow-lg',
  },
  components: {
    card: 'app-card transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5',
    table: {
      wrapper: 'app-table-wrapper relative',
      header: 'app-table-thead sticky top-0 z-10 backdrop-blur-xl',
      row: 'app-table-row group',
      cell: 'app-table-td',
    },
    pageHeader:
      'glass p-6 lg:p-8 rounded-[2.5rem] flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 shadow-soft',
    pageTitle: 'text-2xl lg:text-3xl font-black text-slate-800 dark:text-white tracking-tighter leading-tight',
    pageSubtitle: 'text-xs lg:text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-2xl',
  },
  durations: {
    fast: '150ms',
    normal: '300ms',
  }
};

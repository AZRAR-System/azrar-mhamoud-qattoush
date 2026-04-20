export const DS = {
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '2.5rem', // 40px
  },
  radius: {
    lg: 'rounded-[2.5rem]', // Main large cards/headers
    md: 'rounded-3xl',        // Action cards
    sm: 'rounded-2xl',        // Item cards
    xs: 'rounded-xl',        // Buttons/Inputs
    full: 'rounded-full',
  },
  colors: {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300',
    // نمط الأزرار المعتمد في الهيدر
    heroPrimary:
      'bg-white text-indigo-700 hover:bg-indigo-50 font-black shadow-xl shadow-indigo-900/20 active:scale-95 transition-all duration-300',
    heroGlass:
      'bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 active:scale-95 transition-all duration-300',
    secondary:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all duration-300',
    danger:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 active:scale-95 transition-all duration-300',
    ghost:
      'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/40 active:scale-95 transition-all duration-300',
    outline:
      'bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-600 hover:text-indigo-600 active:scale-95 transition-all duration-300',
  },
  shadow: {
    soft: 'shadow-soft',
    medium: 'shadow-md',
    strong: 'shadow-lg',
    premium: 'shadow-2xl shadow-indigo-500/10 dark:shadow-black/40',
  },
  components: {
    card: 'app-card transition-all duration-500 hover:shadow-indigo-500/10',
    table: {
      wrapper: 'app-table-wrapper relative overflow-hidden shadow-premium',
      header: 'app-table-thead sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800',
      row: 'app-table-row group',
      cell: 'app-table-td font-bold',
      th: 'app-table-th text-slate-400 dark:text-slate-500',
    },
    pageHeader:
      'bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white p-8 lg:p-12 rounded-b-none mb-0',
    pageHeaderLayout:
      'glass p-6 lg:p-8 rounded-[2.5rem] flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 shadow-premium',
    filterBar:
      'glass p-4 rounded-[2rem] border-slate-200/60 dark:border-slate-800/50 flex flex-col lg:flex-row items-center gap-4 shadow-lg',
    pageTitle:
      'text-2xl lg:text-3xl font-black text-slate-800 dark:text-white tracking-tighter leading-tight',
    pageTitleWhite:
      'text-2xl lg:text-3xl font-black text-white tracking-tighter leading-tight',
    pageSubtitle:
      'text-xs lg:text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-2xl',
    pageSubtitleWhite:
      'text-xs lg:text-sm font-bold text-white/70 mt-2 leading-relaxed max-w-2xl',
    pageSubtitleUppercase:
      'text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-wider',
  },
  layout: {
    pageWrap: 'space-y-8 page-transition',
    sectionGap: 'space-y-6',
  },
  durations: {
    fast: '150ms',
    normal: '300ms',
  },
};

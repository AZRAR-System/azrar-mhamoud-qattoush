import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global Error Caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = ROUTE_PATHS.DASHBOARD;
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">عذراً، حدث خطأ غير متوقع</h1>

            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              واجه النظام مشكلة أثناء معالجة طلبك. تم تسجيل الخطأ وسنقوم بمراجعته.
            </p>

            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-left dir-ltr mb-6 overflow-auto max-h-32 border border-gray-200 dark:border-slate-700">
              <code className="text-xs text-red-500 font-mono">{this.state.error?.message || 'Unknown Error'}</code>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
              >
                <RefreshCcw size={18} /> تحديث الصفحة
              </button>
              <button
                onClick={() => {
                  window.location.hash = ROUTE_PATHS.DASHBOARD;
                  window.location.reload();
                }}
                className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition"
              >
                <Home size={18} /> الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
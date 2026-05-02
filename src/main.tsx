/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/tajawal/300.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './styles/tailwind.css';
import './styles/animations.css';
import './styles/mobile-improvements.css';
import './i18n';
import { storage } from '@/services/storage';
import { isAppActivated } from '@/services/activation';
import { installEnglishNumeralsPolyfill } from '@/utils/englishNumerals';

installEnglishNumeralsPolyfill();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

async function bootstrap() {
  try {
    const isDesktopRuntime = typeof window !== 'undefined' && !!window.desktopDb;
    const activated = await isAppActivated();
    // Desktop: always mirror SQLite KV into renderer localStorage so DbService + memory fallbacks
    // stay consistent with main-process data (including before activation).
    if (activated || isDesktopRuntime) {
      await storage.hydrateDbKeysToLocalStorage('db_');
    }

    if (activated) {
      // Keep some non-db_ app/admin keys in sync across desktop devices.
      // (They are managed in Database Manager / admin flows and should reflect remote updates.)
      const extraSyncKeys = [
        'theme',
        'app_update_feed_url',
        'audioConfig',
        'notification_templates',
        'notificationLogs',
        'dashboard_tasks',
        'daily_scheduler_last_run',
      ];
      await storage.hydrateKeysToLocalStorage(extraSyncKeys);
      if (isDesktopRuntime) {
        storage.subscribeDesktopRemoteUpdates?.({ prefix: 'db_', includeKeys: extraSyncKeys });
      }
    } else {
      // Minimal hydration so UI theme can still load before activation.
      await storage.hydrateKeysToLocalStorage(['theme']);
    }
  } finally {
    const root = ReactDOM.createRoot(rootElement);
    const appNode = <App />;
    const isDesktopRuntime = typeof window !== 'undefined' && !!window.desktopDb;
    root.render(
      isDesktopRuntime ? appNode : <React.StrictMode>{appNode}</React.StrictMode>
    );
  }
}

void bootstrap();

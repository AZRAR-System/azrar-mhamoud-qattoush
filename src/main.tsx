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
import { storage } from '@/services/storage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

async function bootstrap() {
  try {
    await storage.hydrateDbKeysToLocalStorage('db_');

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
    storage.subscribeDesktopRemoteUpdates?.({ prefix: 'db_', includeKeys: extraSyncKeys });
  } finally {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

void bootstrap();

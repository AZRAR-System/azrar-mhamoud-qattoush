import type { IpcDeps } from './deps.js';
import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { getOrCreateDeviceId } from '../sqlSync';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { toErrorMessage } from '../utils/errors';

export function registerApp(deps: IpcDeps): void {
  void deps;
  // =====================
  // App helpers (Desktop)
  // =====================
  
  ipcMain.handle('app:getDeviceId', async () => {
    return await getOrCreateDeviceId();
  });
  
  ipcMain.handle('app:quit', async () => {
    try {
      // Allow renderer to request a clean shutdown (used by desktop autorun tests).
      // Defer quit so the IPC response can be sent before the app terminates.
      setTimeout(() => {
        try {
          app.quit();
        } catch {
          // ignore
        }
      }, 0);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'تعذر إغلاق التطبيق') };
    }
  });
  
  ipcMain.handle('app:pickLicenseFile', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'اختر ملف التفعيل',
      properties: ['openFile'],
      filters: [
        { name: 'Activation / License', extensions: ['json', 'lic', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
  
    const result = (win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)) as unknown as Electron.OpenDialogReturnValue;
  
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
  
    const filePath = result.filePaths[0];
    try {
      const st = await fsp.stat(filePath);
      // License files should be tiny; guard against accidental huge files.
      if (st.size > 2 * 1024 * 1024) {
        return { ok: false, canceled: false, error: 'ملف التفعيل كبير جداً.' };
      }
      const content = await fsp.readFile(filePath, 'utf8');
      return { ok: true, canceled: false, fileName: path.basename(filePath), content };
    } catch (e: unknown) {
      return { ok: false, canceled: false, error: toErrorMessage(e, 'تعذر قراءة ملف التفعيل') };
    }
  });
  
  ipcMain.handle('app:getLicensePublicKey', async () => {
    try {
      const envKey = String(
        process.env.AZRAR_LICENSE_PUBLIC_KEY_B64 || process.env.VITE_AZRAR_LICENSE_PUBLIC_KEY || ''
      ).trim();
      if (envKey) return { ok: true, publicKeyB64: envKey, source: 'env' };
  
      // Packaged fallback: ship a PUBLIC key file inside the app.
      const rel = path.join('electron', 'assets', 'azrar-license-public.key.json');
      const candidates = [
        path.join(app.getAppPath(), rel),
        path.join(process.resourcesPath, 'app.asar', rel),
        path.join(process.resourcesPath, rel),
      ];
  
      for (const p of candidates) {
        try {
          const raw = await fsp.readFile(p, 'utf8');
          const parsed = JSON.parse(String(raw || '').trim());
          const b64 =
            typeof parsed?.publicKeyB64 === 'string' ? String(parsed.publicKeyB64).trim() : '';
          if (b64) return { ok: true, publicKeyB64: b64, source: p };
        } catch {
          // try next
        }
      }
  
      return { ok: false, error: 'Missing license public key.' };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'Failed to load license public key') };
    }
  });
  
}

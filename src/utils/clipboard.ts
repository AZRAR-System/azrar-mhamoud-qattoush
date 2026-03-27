type ClipboardWriteResult = { ok: boolean; error?: string };

const toMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const safeCopyToClipboard = async (text: string): Promise<ClipboardWriteResult> => {
  const payload = String(text ?? '');
  if (!payload) return { ok: false, error: 'empty' };

  try {
    const bridge = (
      window as unknown as { desktopDb?: { writeClipboardText?: (t: string) => Promise<unknown> } }
    ).desktopDb;

    if (bridge?.writeClipboardText) {
      const res = await bridge.writeClipboardText(payload);
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok === true) return { ok: true };
      const err = typeof rec.error === 'string' ? rec.error : '';
      return { ok: false, error: err || 'clipboard_write_failed' };
    }
  } catch (e: unknown) {
    return { ok: false, error: toMsg(e) || 'clipboard_write_failed' };
  }

  try {
    // Web clipboard may be blocked by Permissions-Policy in Electron.
    await navigator.clipboard.writeText(payload);
    return { ok: true };
  } catch (e: unknown) {
    // Fall through to execCommand fallback.
    const webErr = toMsg(e) || 'clipboard_write_failed';

    try {
      const el = document.createElement('textarea');
      el.value = payload;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '-1000px';
      el.style.left = '-1000px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok ? { ok: true } : { ok: false, error: webErr };
    } catch (e2: unknown) {
      return { ok: false, error: webErr || toMsg(e2) || 'clipboard_write_failed' };
    }
  }
};

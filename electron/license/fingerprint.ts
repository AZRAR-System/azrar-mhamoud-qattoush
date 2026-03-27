import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export type DeviceFingerprintResult = {
  ok: boolean;
  fingerprint?: string;
  sources?: Record<string, string>;
  warning?: string;
  error?: string;
};

const sha256Hex = (text: string): string =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const safeTrim = (v: unknown): string => String(v ?? '').trim();

const readTextFileFirstLine = (p: string): string => {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return safeTrim(String(raw).split(/\r?\n/)[0] ?? '');
  } catch {
    return '';
  }
};

const runPwshJson = (command: string): Record<string, unknown> | null => {
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 }
    );
    const s = safeTrim(out);
    if (!s) return null;
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getWindowsSources = (): Record<string, string> => {
  // Prefer CIM (newer) and emit JSON for robust parsing.
  const cmd = [
    '$csp = Get-CimInstance -ClassName Win32_ComputerSystemProduct | Select-Object -First 1;',
    '$bb = Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -First 1;',
    '$bios = Get-CimInstance -ClassName Win32_BIOS | Select-Object -First 1;',
    // Disk serial via PhysicalMedia can be empty on some systems.
    '$pm = Get-CimInstance -ClassName Win32_PhysicalMedia | Select-Object -First 1;',
    '$o = [ordered]@{};',
    '$o.Hostname = $env:COMPUTERNAME;',
    '$o.CspUuid = $csp.UUID;',
    '$o.CspIdent = $csp.IdentifyingNumber;',
    '$o.BaseboardSerial = $bb.SerialNumber;',
    '$o.BiosSerial = $bios.SerialNumber;',
    '$o.DiskSerial = $pm.SerialNumber;',
    '$o | ConvertTo-Json -Compress',
  ].join(' ');

  const obj = runPwshJson(cmd);
  const res: Record<string, string> = {};
  if (obj) {
    for (const k of Object.keys(obj)) {
      const v = safeTrim(obj[k]);
      if (v) res[k] = v;
    }
  }
  return res;
};

const getMacSources = (): Record<string, string> => {
  const res: Record<string, string> = {};
  try {
    // IOPlatformUUID is usually stable.
    const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
      encoding: 'utf8',
      timeout: 8000,
    });
    const m = String(out).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    if (m?.[1]) res.IOPlatformUUID = safeTrim(m[1]);
  } catch {
    // ignore
  }

  const hostname = safeTrim(os.hostname());
  if (hostname) res.Hostname = hostname;

  return res;
};

const getLinuxSources = (): Record<string, string> => {
  const res: Record<string, string> = {};

  const hostname = safeTrim(os.hostname());
  if (hostname) res.Hostname = hostname;

  const machineId =
    readTextFileFirstLine('/etc/machine-id') || readTextFileFirstLine('/var/lib/dbus/machine-id');
  if (machineId) res.MachineId = machineId;

  const productUuid = readTextFileFirstLine('/sys/class/dmi/id/product_uuid');
  if (productUuid) res.ProductUuid = productUuid;

  return res;
};

export const getDeviceFingerprintV2 = (): DeviceFingerprintResult => {
  try {
    const platform = process.platform;

    let sources: Record<string, string> = {};
    if (platform === 'win32') sources = getWindowsSources();
    else if (platform === 'darwin') sources = getMacSources();
    else sources = getLinuxSources();

    // Always include an app-scoped salt to avoid cross-app correlation.
    // This does not prevent bypass by advanced attackers, but avoids exposing raw identifiers.
    const salt = 'AZRAR:device-fingerprint:v2';

    const stableKeys = Object.keys(sources)
      .sort()
      .map((k) => `${k}=${sources[k]}`)
      .join('\n');

    const material = `${salt}\n${stableKeys}`;
    const fp = sha256Hex(material);

    if (!stableKeys) {
      return {
        ok: true,
        fingerprint: `fp2:${fp}`,
        sources: {},
        warning: 'No hardware sources available; using empty fingerprint base.',
      };
    }

    return { ok: true, fingerprint: `fp2:${fp}`, sources };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'Failed to compute device fingerprint' };
  }
};

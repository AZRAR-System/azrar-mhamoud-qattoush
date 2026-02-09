/**
 * Electron bundle obfuscation hook.
 *
 * This repo's build pipeline expects this script to exist and exit successfully.
 * In development and CI verification we keep this as a safe no-op unless a
 * future hardening phase introduces a concrete obfuscation implementation.
 */

const enabledRaw = String(process.env.AZRAR_OBFUSCATE_ELECTRON || '').trim().toLowerCase();
const enabled = enabledRaw === '1' || enabledRaw === 'true';

// Back-compat override.
const disabledRaw = String(process.env.AZRAR_DISABLE_OBFUSCATION || '').trim().toLowerCase();
const disabled = disabledRaw === '1' || disabledRaw === 'true';

if (!enabled) {
  console.warn('[electron:obfuscate] disabled (AZRAR_OBFUSCATE_ELECTRON not set)');
  process.exit(0);
}

if (disabled) {
  console.warn('[electron:obfuscate] disabled by AZRAR_DISABLE_OBFUSCATION');
  process.exit(0);
}

console.warn('[electron:obfuscate] enabled, but no-op (implementation pending)');

/**
 * Electron Builder config for AZRAR License Admin (GUI)
 * - Dedicated Setup installer
 * - Starts in license-admin mode (via app name inference in electron/main.ts)
 */

const base = require('./electron-builder.config.cjs');

module.exports = {
  ...base,
  appId: 'com.azrar.licenseadmin',
  productName: 'AZRAR-LicenseAdmin',
  executableName: 'AZRAR-LicenseAdmin',

  artifactName: '${productName}-Setup-${version}.${ext}',

  directories: {
    ...(base.directories || {}),
    output: 'release_licenseadmin_build',
  },

  // Admin tool should not register protocols or update channels.
  publish: [],
  protocols: [],

  // Ensure a unique app name so electron/main.ts can infer admin mode.
  extraMetadata: {
    ...(base.extraMetadata || {}),
    name: 'azrar-license-admin',
    main: 'electron/main.js',
  },

  nsis: {
    ...(base.nsis || {}),
    shortcutName: 'AZRAR-LicenseAdmin',
  },
};
/**
 * Electron Builder config for AZRAR License Generator
 */

const base = require('./electron-builder.config.cjs');

module.exports = {
  ...base,
  appId: 'com.azrar.licensegen',
  productName: 'AZRAR-LicenseGen',

  // Ensure the generated executable name can't clash with the main desktop app.
  executableName: 'AZRAR-LicenseGen',

  artifactName: '${productName}-Setup-${version}.${ext}',

  directories: {
    ...(base.directories || {}),
    output: 'release_licensegen_build',
  },

  // License generator is a standalone utility; it should not register update
  // channels or custom URL protocols used by the main system.
  publish: [],
  protocols: [],

  // Override the entry point to the generator main process.
  extraMetadata: {
    ...(base.extraMetadata || {}),
    name: 'azrar-licensegen',
    main: 'electron/licensegen-main.js',
  },

  // Generator does not need the Vite dist output.
  files: [
    'electron/**',
    'node_modules/**',
    'package.json',
    '!electron/main.js',
    '!electron/ipc.js',
    '!electron/db.js',
    '!electron/preload.cjs',
    '!electron/**/*.map',
    '!**/*.md',
    '!**/LICENSE',
  ],

  // Keep asar for compactness.
  asar: true,
  asarUnpack: ['**/*.node'],

  // Override inherited installer shortcuts to avoid conflicting Start Menu/Desktop entries.
  nsis: {
    ...(base.nsis || {}),
    shortcutName: 'AZRAR-LicenseGen',
  },
};

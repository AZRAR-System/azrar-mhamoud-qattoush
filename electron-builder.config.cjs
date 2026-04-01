/**
 * Electron Builder Configuration
 * تكوين متقدم لبناء تطبيق AZRAR
 */

const fs = require('fs');
const path = require('path');

const signingProfileRaw = String(process.env.AZRAR_SIGNING_PROFILE || '').trim().toLowerCase();
const isProdSigning =
  signingProfileRaw === 'prod' ||
  signingProfileRaw === 'production' ||
  signingProfileRaw === 'trusted' ||
  signingProfileRaw === 'ca' ||
  signingProfileRaw === 'ov' ||
  signingProfileRaw === 'ev';

module.exports = {
  appId: 'com.azrar.desktop',
  productName: 'AZRAR',
  copyright: 'Copyright © 2026 AZRAR',

  // Use URL-safe artifact names (no spaces) so generic updates work reliably.
  artifactName: '${productName}-Setup-${version}.${ext}',

  directories: {
    output: 'release2_build',
    // App icons, NSIS license, installer.nsh — see build/README.md
    buildResources: 'build'
  },

  extraFiles: [
    {
      from: 'build/sql-express-install.ps1',
      to: 'sql-express-install.ps1',
    },
  ],

  files: [
    'dist/**',
    'electron/**',
    'server/license-server.mjs',
    'server/marquee-server.js',
    'print/**',
    'node_modules/**',
    'package.json',
    '!**/*.map',
    '!**/*.md',
    '!**/LICENSE',
    '!**/.DS_Store'
  ],

  asar: true,
  // Native Node addons (.node) must be unpacked to load at runtime.
  asarUnpack: ['**/*.node'],
  compression: 'maximum',

  // Native deps (e.g. better-sqlite3) must be rebuilt against the Electron headers,
  // otherwise the installed app can crash with NODE_MODULE_VERSION mismatches.
  // NOTE: Disabled because Node.js v24 can break @electron/rebuild at build time.
  // The dist script already validates better-sqlite3 loads in the Electron runtime.
  npmRebuild: false,

  // إعدادات التحديثات التلقائية
  publish: (() => {
    const url = process.env.AZRAR_UPDATE_URL || process.env.AZRAR_UPDATES_URL || process.env.AZRAR_UPDATE_PUBLISH_URL;
    if (!url) return [];
    const normalized = String(url).trim().endsWith('/') ? String(url).trim() : `${String(url).trim()}/`;
    return [
      {
        provider: 'generic',
        url: normalized
      }
    ];
  })(),

  // إعدادات Windows
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      }
    ],
    // Primary app icon (exe + shortcuts). Same file as Electron BrowserWindow in main.ts (build/icon.png).
    icon: 'build/icon.png',

    // إعدادات التوقيع الرقمي (فعّلها فقط عند توفر الشهادة/صلاحيات symlink)
    signAndEditExecutable: false,
    signtoolOptions: {
      signingHashAlgorithms: ['sha256'],
      timeStampServer: 'http://timestamp.digicert.com',
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
    },

    // استخدم هذه الإعدادات عندما تكون لديك شهادة
    // certificateFile: process.env.CSC_LINK,
    // certificatePassword: process.env.CSC_KEY_PASSWORD,

    // In production releases (OV/EV CA), enable update signature verification.
    // For internal/dev self-signed builds this stays false to avoid verification issues on non-trusted machines.
    verifyUpdateCodeSignature: isProdSigning
  },

  // إعدادات NSIS Installer
  nsis: {
    // Installer legal screen (NSIS will require explicit acceptance).
    // Keep the file in build resources so it is always present during packaging.
    license: 'build/TERMS_AND_PRIVACY.txt',
    oneClick: false,
    // Install per-machine into a protected system path (e.g. Program Files).
    perMachine: true,
    allowElevation: true,
    // Prevent installing to arbitrary (unprotected) locations.
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'AZRAR',
    include: 'build/installer.nsh',

    // إعدادات متقدمة
    ...(fs.existsSync(path.join(__dirname, 'build', 'icon.ico'))
      ? {
          installerIcon: 'build/icon.ico',
          uninstallerIcon: 'build/icon.ico',
          installerHeaderIcon: 'build/icon.ico',
        }
      : {}),
    deleteAppDataOnUninstall: false,

    // لغة المثبت
    language: '0x0401', // Arabic
    multiLanguageInstaller: true
  },

  // إعدادات الأمان
  protocols: [
    {
      name: 'AZRAR Protocol',
      schemes: ['azrar']
    }
  ],

  // Electron إعدادات
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/'
  }
};

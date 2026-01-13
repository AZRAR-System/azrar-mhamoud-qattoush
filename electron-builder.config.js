/**
 * Electron Builder Configuration
 * تكوين متقدم لبناء تطبيق AZRAR
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  appId: 'com.azrar.desktop',
  productName: 'AZRAR',
  copyright: 'Copyright © 2026 AZRAR',

  // Use URL-safe artifact names (no spaces) so generic updates work reliably.
  artifactName: '${productName}-Setup-${version}.${ext}',
  
  directories: {
    output: 'release2_build',
    buildResources: 'build'
  },

  files: [
    'dist/**',
    'electron/**',
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

  // Native deps (e.g. better-sqlite3) must be rebuilt against the Electron headers.
  npmRebuild: true,

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
    icon: 'build/icon.png',
    
    // إعدادات التوقيع الرقمي (مفعّلة عند توفر الشهادة)
    signAndEditExecutable: true,
    signingHashAlgorithms: ['sha256'],
    rfc3161TimeStampServer: 'http://timestamp.digicert.com',
    
    // استخدم هذه الإعدادات عندما تكون لديك شهادة
    // certificateFile: process.env.CSC_LINK,
    // certificatePassword: process.env.CSC_KEY_PASSWORD,
    
    publisherName: 'AZRAR',
    verifyUpdateCodeSignature: false // غيره إلى true عند استخدام شهادة موقعة
  },

  // إعدادات NSIS Installer
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
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

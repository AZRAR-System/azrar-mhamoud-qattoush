/*
  Verifies better-sqlite3 native addon loads in Electron.
  This must succeed for packaged apps, otherwise you'll see:
  "compiled against a different Node.js version ... NODE_MODULE_VERSION ..."
*/

try {
  require('better-sqlite3');
  // eslint-disable-next-line no-console
  console.log(
    `better-sqlite3 OK (electron=${process.versions.electron}, modules=${process.versions.modules}, arch=${process.arch})`
  );

  require('better-sqlite3-multiple-ciphers');
  // eslint-disable-next-line no-console
  console.log(
    `better-sqlite3-multiple-ciphers OK (electron=${process.versions.electron}, modules=${process.versions.modules}, arch=${process.arch})`
  );

  process.exit(0);
} catch (e) {
  console.error('better-sqlite3 FAILED in Electron runtime');
  console.error(e && e.message ? e.message : e);
  process.exit(1);
}

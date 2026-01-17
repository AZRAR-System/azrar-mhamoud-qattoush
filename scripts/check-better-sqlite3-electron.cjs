/*
  Verifies better-sqlite3 native addon loads in Electron.
  This must succeed for packaged apps, otherwise you'll see:
  "compiled against a different Node.js version ... NODE_MODULE_VERSION ..."
*/

try {
   
  require('better-sqlite3');
  // If we got here, the addon loads and ABI matches Electron.
  // Print ABI for debugging.
  // eslint-disable-next-line no-console
  console.log(`better-sqlite3 OK (electron=${process.versions.electron}, modules=${process.versions.modules})`);
  process.exit(0);
} catch (e) {
   
  console.error('better-sqlite3 FAILED in Electron runtime');
   
  console.error(e && e.message ? e.message : e);
  process.exit(1);
}

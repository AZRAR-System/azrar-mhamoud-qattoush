const crypto = require('node:crypto');

function generate() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  
  const payload = {
    v: 1,
    product: 'AZRAR',
    deviceId: 'DEV-123',
    issuedAt: '2025-01-01',
    expiresAt: '2026-01-01'
  };
  
  const msg = JSON.stringify(payload);
  const sig = crypto.sign(null, Buffer.from(msg), privateKey);
  
  console.log('Public Key (B64):', publicKey.export({ type: 'spki', format: 'der' }).slice(12).toString('base64')); // Extract raw key from SPKI
  console.log('Signature (B64):', sig.toString('base64'));
  console.log('Payload:', msg);
}

generate();

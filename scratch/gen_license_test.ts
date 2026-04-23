import * as ed from '@noble/ed25519';

async function generate() {
  const priv = new Uint8Array(32); priv[31] = 1; // simple seed
  const pub = await ed.getPublicKey(priv);
  
  const payload = JSON.stringify({
    v: 1,
    product: 'AZRAR',
    deviceId: 'DEV-123',
    issuedAt: '2025-01-01',
    expiresAt: '2026-01-01'
  });
  
  const sig = await ed.sign(new TextEncoder().encode(payload), priv);
  
  console.log('Public Key (B64):', btoa(String.fromCharCode(...pub)));
  console.log('Signature (B64):', btoa(String.fromCharCode(...sig)));
  console.log('Payload:', payload);
}

generate();

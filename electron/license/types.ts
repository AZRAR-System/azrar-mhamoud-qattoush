export type LicensePayloadV1 = {
  v: 1;
  deviceId: string;
  issuedAt: string;
  expiresAt?: string;
  features?: Record<string, boolean>;
};

export type SignedLicenseFileV1 = {
  payload: LicensePayloadV1;
  sig: string; // base64 signature
};

export type LicenseStatus = {
  activated: boolean;
  deviceFingerprint?: string;
  activatedAt?: string;
  lastCheckAt?: string;
  reason?: string;
  review?: {
    serverUrl?: string;
    remoteStatus?: 'active' | 'suspended' | 'revoked' | 'expired' | 'mismatch' | 'invalid_license' | 'unknown';
    remoteCheckedAt?: string;
    remoteLastAttemptAt?: string;
    remoteLastError?: string;
    remoteStatusUpdatedAt?: string;
    remoteStatusNote?: string;
  };
  license?: {
    expiresAt?: string;
    features?: Record<string, boolean>;
    deviceId?: string;
  };
};

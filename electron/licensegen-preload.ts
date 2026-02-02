import { contextBridge, ipcRenderer } from 'electron';

type PickKeyResult =
  | { ok: true; publicKeyB64: string; fileName?: string }
  | { ok: false; canceled?: boolean; error?: string };

type GenerateKeypairResult =
  | { ok: true; publicKeyB64: string; privatePath: string; publicPath: string }
  | { ok: false; canceled?: boolean; error?: string };

type GeneratePayload = {
  deviceId: string;
  customer?: string;
  expiresAt?: string;
  features?: string[];
};

type CustomerProfilePayload = {
  name: string;
  seatCount?: number;
  defaultDurationDays?: number;
  defaultDurationMonths?: number;
  notes?: string;
};

type GetStateResult =
  | {
      ok: true;
      state: {
        version: 1;
        lastPrivateKeyPath?: string;
        lastPrivateKeyFileName?: string;
        lastCustomer?: string;
        lastSeatCount?: number;
        lastDurationDays?: number;
        lastDurationMonths?: number;
        customers: Array<{
          name: string;
          seatCount?: number;
          defaultDurationDays?: number;
          defaultDurationMonths?: number;
          notes?: string;
          createdAt: string;
          updatedAt: string;
        }>;
        issuedLicenses: Array<{
          deviceId: string;
          customer?: string;
          issuedAt: string;
          expiresAt?: string;
          filePath?: string;
        }>;
      };
      runtime: { hasKey: boolean; publicKeyB64: string; expectedPublicKeyConfigured: boolean };
      computed: { issuedCountByCustomer: Record<string, number> };
    }
  | { ok: false; error?: string };

type SimpleOkResult = | { ok: true } | { ok: false; error?: string };

type GenerateResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled?: boolean; error?: string };

contextBridge.exposeInMainWorld('licenseGen', {
  pickPrivateKey: (): Promise<PickKeyResult> => ipcRenderer.invoke('licensegen:pickPrivateKey'),
  generateKeypairAndSave: (): Promise<GenerateKeypairResult> => ipcRenderer.invoke('licensegen:generateKeypairAndSave'),
  generateAndSave: (payload: GeneratePayload): Promise<GenerateResult> => ipcRenderer.invoke('licensegen:generateAndSave', payload),
  getState: (): Promise<GetStateResult> => ipcRenderer.invoke('licensegen:getState'),
  saveCustomer: (payload: CustomerProfilePayload): Promise<SimpleOkResult> => ipcRenderer.invoke('licensegen:saveCustomer', payload),
  setLastOptions: (payload: { lastCustomer?: string; lastSeatCount?: number; lastDurationDays?: number; lastDurationMonths?: number }): Promise<SimpleOkResult> =>
    ipcRenderer.invoke('licensegen:setLastOptions', payload),
  forgetPrivateKey: (): Promise<SimpleOkResult> => ipcRenderer.invoke('licensegen:forgetPrivateKey'),
});

declare global {
  interface Window {
    licenseGen?: {
      pickPrivateKey: () => Promise<PickKeyResult>;
      generateKeypairAndSave: () => Promise<GenerateKeypairResult>;
      generateAndSave: (payload: GeneratePayload) => Promise<GenerateResult>;
      getState: () => Promise<GetStateResult>;
      saveCustomer: (payload: CustomerProfilePayload) => Promise<SimpleOkResult>;
      setLastOptions: (payload: { lastCustomer?: string; lastSeatCount?: number; lastDurationDays?: number; lastDurationMonths?: number }) => Promise<SimpleOkResult>;
      forgetPrivateKey: () => Promise<SimpleOkResult>;
    };
  }
}

export {}; // module

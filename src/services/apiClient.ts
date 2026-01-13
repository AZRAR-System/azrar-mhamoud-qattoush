
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * Production Grade API Client
 */

import { SERVER_CONFIG } from '../config';
import { DbResult } from '../types';

type ActivityListener = (isSyncing: boolean) => void;

class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private listeners: ActivityListener[] = [];

  constructor() {
    this.baseUrl = SERVER_CONFIG.API_BASE_URL;
    this.headers = SERVER_CONFIG.HEADERS;
  }

  // Allow UI components to listen for network activity (Sync Status)
  public subscribeToActivity(listener: ActivityListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyActivity(isSyncing: boolean) {
    this.listeners.forEach(l => l(isSyncing));
  }

  // Simple Health Check
  public async checkConnection(): Promise<boolean> {
    if (!SERVER_CONFIG.USE_REAL_SERVER) return true; // Always "connected" in local mode
    try {
      // Short timeout for health check
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, { 
        method: 'GET',
        headers: this.headers,
        signal: controller.signal
      });
      clearTimeout(id);
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<DbResult<T>> {
    if (!SERVER_CONFIG.USE_REAL_SERVER) {
      console.warn(`API Call to ${endpoint} blocked: Mock Mode Active`);
      return { success: false, message: 'Server connection disabled' };
    }

    this.notifyActivity(true); // Start Sync Visual

    const url = `${this.baseUrl}${endpoint}`;

    const etagKey = `server_etag:${endpoint}`;
    const existingEtag = (() => {
      try {
        return localStorage.getItem(etagKey);
      } catch {
        return null;
      }
    })();

    const config = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    // For write operations, send If-Match to prevent overwriting another device.
    const method = String(config.method || 'GET').toUpperCase();
    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && existingEtag) {
      (config.headers as any)['If-Match'] = existingEtag;
    }

    try {
      const response = await fetch(url, config);

      const responseEtag = response.headers.get('ETag');
      if (responseEtag) {
        try {
          localStorage.setItem(etagKey, responseEtag);
        } catch {
          // ignore
        }
      }
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));

        // Special-case optimistic concurrency conflicts.
        if (response.status === 409) {
          return {
            success: false,
            message: errorBody.message || 'Conflict: data changed on server',
            data: errorBody as any,
          };
        }

        throw new Error(errorBody.message || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      return { success: true, message: 'Success', data };
    } catch (error: any) {
      console.error(`API Request Failed: ${endpoint}`, error);
      return { 
        success: false, 
        message: error.message || 'Network Error' 
      };
    } finally {
      this.notifyActivity(false); // End Sync Visual
    }
  }

  public async get<T>(endpoint: string): Promise<DbResult<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body: any): Promise<DbResult<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public async put<T>(endpoint: string, body: any): Promise<DbResult<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  public async delete<T>(endpoint: string): Promise<DbResult<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

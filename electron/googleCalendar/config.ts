/**
 * Google Calendar integration — OAuth (Desktop) + Calendar API v3.
 * Register the redirect URI in Google Cloud Console (OAuth client type: Desktop).
 */

/** Fixed loopback port — add `http://127.0.0.1:8742/callback` as authorized redirect URI. */
export const GOOGLE_OAUTH_REDIRECT_PORT = 8742;
export const GOOGLE_OAUTH_REDIRECT_PATH = '/callback';
export const GOOGLE_OAUTH_REDIRECT_URI = `http://127.0.0.1:${GOOGLE_OAUTH_REDIRECT_PORT}${GOOGLE_OAUTH_REDIRECT_PATH}`;

export const GOOGLE_CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'] as const;

export const GOOGLE_OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Set `AZRAR_GOOGLE_CALENDAR_CLIENT_ID` in the environment or replace the placeholder
 * after creating an OAuth 2.0 Client ID (Desktop) in Google Cloud Console.
 */
export function getGoogleOAuthClientId(): string {
  const env = String(process.env.AZRAR_GOOGLE_CALENDAR_CLIENT_ID || '').trim();
  if (env) return env;
  return 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';
}

/** KV: integration toggle (default off). Not used for secrets. */
export const KV_GOOGLE_CALENDAR_ENABLED = 'db_google_calendar_enabled';

/** KV: JSON map taskId → Google event id (not tokens). */
export const KV_GOOGLE_CALENDAR_EVENT_MAP = 'db_google_calendar_event_map';

/** safeStorage payload key (encrypted blob). */
export const SAFE_STORAGE_GOOGLE_KEY = 'azrar.google.calendar.oauth';

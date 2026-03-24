/**
 * Google Calendar Protocol — OAuth 2.0 flow and Calendar API integration.
 *
 * Credentials are stored via credentialStore. OAuth Client ID/Secret
 * are loaded from environment variables:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */
import { upsertCredential, getCredential } from './credentialStore.js';
import { Logger } from '../utils/logger.js';
import type { CalendarEventPayload } from '@lifeos/shared';

const logger = new Logger('calendarProtocol');

const PROVIDER = 'google_calendar';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

function getOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google/callback',
  };
}

/**
 * Generate the Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthUrl(): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens and store them.
 */
export async function handleGoogleOAuthCallback(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  const expiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  upsertCredential(PROVIDER, data.access_token, data.refresh_token || null, expiry, SCOPES);
  logger.info('Google Calendar OAuth tokens stored successfully.');
}

/**
 * Refresh the access token if expired.
 */
async function ensureFreshToken(): Promise<string> {
  const cred = getCredential(PROVIDER);
  if (!cred || !cred.accessToken) {
    throw new Error('Google Calendar not connected. Please authorize first.');
  }

  if (cred.tokenExpiry && new Date(cred.tokenExpiry) < new Date()) {
    if (!cred.refreshToken) {
      throw new Error('Google Calendar token expired and no refresh token available.');
    }
    const { clientId, clientSecret } = getOAuthConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: cred.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new Error(`Failed to refresh Google token: ${response.status}`);
    const data = await response.json();
    const expiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;
    upsertCredential(PROVIDER, data.access_token, cred.refreshToken, expiry, SCOPES);
    return data.access_token;
  }
  return cred.accessToken;
}

/**
 * Execute a calendar event creation (used by Execution Engine).
 * Backwards-compatible with A-Group's interface.
 */
export async function executeCalendarEvent(payload: CalendarEventPayload): Promise<boolean> {
  try {
    const eventId = await createCalendarEvent({
      summary: payload.title,
      description: payload.description,
      start: payload.startTime,
      end: payload.endTime,
      location: payload.location,
    });
    logger.info(`Calendar event created: ${eventId}`);
    return true;
  } catch (err) {
    logger.error('Failed to create calendar event:', err);
    return false;
  }
}

/**
 * List calendar events within a time range.
 */
export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
  calendarId = 'primary',
): Promise<any[]> {
  const token = await ensureFreshToken();
  const params = new URLSearchParams({
    timeMin, timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(`Google Calendar API error: ${response.status}`);
  const data = await response.json();
  return data.items || [];
}

/**
 * Create a calendar event. Returns the created event's ID.
 */
export async function createCalendarEvent(
  event: { summary: string; description?: string; start: string; end: string; location?: string },
  calendarId = 'primary',
): Promise<string> {
  const token = await ensureFreshToken();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar event: ${response.status} ${error}`);
  }
  const data = await response.json();
  logger.info(`Created Google Calendar event: ${data.id}`);
  return data.id;
}

/**
 * Check if Google Calendar is connected.
 */
export function isGoogleCalendarConnected(): boolean {
  const cred = getCredential(PROVIDER);
  return !!(cred && cred.accessToken);
}

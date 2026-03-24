/**
 * Integration API Handlers — OAuth flows and integration status.
 */
import type { Request, Response } from 'express';
import { getGoogleAuthUrl, handleGoogleOAuthCallback, isGoogleCalendarConnected, listCalendarEvents } from '../../integrations/calendarProtocol.js';
import { listCredentialProviders } from '../../integrations/credentialStore.js';

export function googleAuthHandler(_req: Request, res: Response) {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

export async function googleCallbackHandler(req: Request, res: Response) {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  try {
    await handleGoogleOAuthCallback(code);
    res.json({ success: true, message: 'Google Calendar connected successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'OAuth callback failed' });
  }
}

export async function googleCalendarEventsHandler(req: Request, res: Response) {
  const timeMin = req.query.timeMin as string || new Date().toISOString();
  const timeMax = req.query.timeMax as string || new Date(Date.now() + 7 * 86400000).toISOString();

  try {
    const events = await listCalendarEvents(timeMin, timeMax);
    res.json({ events, total: events.length });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch calendar events' });
  }
}

export function integrationStatusHandler(_req: Request, res: Response) {
  const providers = listCredentialProviders();
  const integrations = [
    {
      provider: 'google_calendar',
      connected: isGoogleCalendarConnected(),
      lastSyncAt: null,
    },
  ];
  res.json({ integrations });
}

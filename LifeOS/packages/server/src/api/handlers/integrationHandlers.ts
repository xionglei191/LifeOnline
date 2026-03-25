/**
 * Integration API Handlers — OAuth flows and integration status.
 */
import type { Request, Response } from 'express';
import { getGoogleAuthUrl, handleGoogleOAuthCallback, isGoogleCalendarConnected, listCalendarEvents } from '../../integrations/calendarProtocol.js';
import { listCredentialProviders } from '../../integrations/credentialStore.js';
import { getExecutionInsights } from '../../integrations/insightEngine.js';
import { sendSuccess, sendError } from '../responseHelper.js';

export function googleAuthHandler(_req: Request, res: Response) {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

export async function googleCallbackHandler(req: Request, res: Response) {
  const code = req.query.code as string;
  if (!code) return sendError(res, 'Missing authorization code', 400);

  try {
    await handleGoogleOAuthCallback(code);
    sendSuccess(res, { success: true, message: 'Google Calendar connected successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    sendError(res, message);
  }
}

export async function googleCalendarEventsHandler(req: Request, res: Response) {
  const timeMin = req.query.timeMin as string || new Date().toISOString();
  const timeMax = req.query.timeMax as string || new Date(Date.now() + 7 * 86400000).toISOString();

  try {
    const events = await listCalendarEvents(timeMin, timeMax);
    sendSuccess(res, { events, total: events.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calendar events';
    sendError(res, message);
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
  sendSuccess(res, { integrations });
}

export function integrationInsightsHandler(_req: Request, res: Response) {
  try {
    const insights = getExecutionInsights(7);
    sendSuccess(res, insights);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch execution insights';
    sendError(res, message);
  }
}

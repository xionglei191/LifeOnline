/**
 * Calendar Conflict Handler — queries existing events for conflict detection.
 *
 * Uses Google Calendar freebusy API when credentials are available.
 * Falls back to an empty conflicts list when no calendar is linked.
 */
import type { Request, Response } from 'express';
import { getPhysicalAction } from '../../integrations/executionEngine.js';
import { getCredential } from '../../integrations/credentialStore.js';
import type { CalendarEventPayload } from '@lifeos/shared';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('calendarConflictHandler');

interface ConflictEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
}

export async function getConflictsForActionHandler(req: Request, res: Response) {
  const actionId = req.params.id;
  const action = getPhysicalAction(actionId);

  if (!action) {
    return res.status(404).json({ error: 'PhysicalAction not found' });
  }

  if (action.type !== 'calendar_event') {
    return res.json({ conflicts: [] });
  }

  const payload = action.payload as CalendarEventPayload;
  if (!payload.startTime || !payload.endTime) {
    return res.json({ conflicts: [] });
  }

  try {
    const conflicts = await fetchCalendarConflicts(payload.startTime, payload.endTime);
    res.json({ conflicts });
  } catch (err: unknown) {
    logger.error('Failed to fetch calendar conflicts:', err);
    // Graceful degradation — return empty on failure
    res.json({ conflicts: [], error: 'Calendar query failed' });
  }
}

async function fetchCalendarConflicts(startTime: string, endTime: string): Promise<ConflictEvent[]> {
  const credential = getCredential('google_calendar');
  if (!credential?.accessToken) {
    logger.warn('No Google Calendar credentials found, skipping conflict check');
    return [];
  }

  // Expand the query window to the full day of the target event
  const targetDate = new Date(startTime);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Use Google Calendar Events list API to get events for the day
  const calendarId = 'primary';
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', dayStart.toISOString());
  url.searchParams.set('timeMax', dayEnd.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '20');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${credential.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleCalendarListResponse;
  const events: ConflictEvent[] = (data.items || [])
    .filter((item: GoogleCalendarEvent) => item.start?.dateTime && item.end?.dateTime)
    .map((item: GoogleCalendarEvent) => ({
      id: item.id,
      title: item.summary || '(无标题)',
      startTime: item.start!.dateTime!,
      endTime: item.end!.dateTime!,
    }));

  // Filter to only overlapping events
  const reqStart = new Date(startTime).getTime();
  const reqEnd = new Date(endTime).getTime();

  return events.filter(e => {
    const eStart = new Date(e.startTime).getTime();
    const eEnd = new Date(e.endTime).getTime();
    return reqStart < eEnd && reqEnd > eStart;
  });
}

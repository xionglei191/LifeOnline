import { Router } from 'express';
import {
  // Dashboard & Notes
  getDashboard, getNotes, getNoteById, getPersonaSnapshotHandler, getCognitiveHealthHandler,
  searchNotes, createNote, updateNote, appendNote, deleteNote,
  getTimeline, getCalendar,
  // Index & Config
  triggerIndex, getIndexStatus, getIndexErrors,
  getConfig, updateConfig,
  // AI Tracking
  getAiUsageHandler,
  // AI
  listAiPrompts, updateAiPrompt, resetAiPrompt,
  getAiProviderHandler, updateAiProviderHandler, testAiProviderHandler,
  listAiSuggestionsHandler,
  // Worker Tasks
  createWorkerTaskHandler, listWorkerTasksHandler, getWorkerTaskHandler,
  retryWorkerTaskHandler, cancelWorkerTaskHandler, clearFinishedWorkerTasksHandler,
  // Soul Actions
  listSoulActionsHandler, getSoulActionHandler,
  approveSoulActionHandler, deferSoulActionHandler, discardSoulActionHandler, dispatchSoulActionHandler, answerFollowupHandler,
  // Reintegration & Promotion
  listReintegrationRecordsHandler,
  acceptReintegrationRecordHandler, rejectReintegrationRecordHandler,
  planPromotionsHandler,
  listEventNodesHandler, listContinuityRecordsHandler,
  // Brainstorm Sessions
  listBrainstormSessionsHandler, getBrainstormSessionHandler, getBrainstormSessionRelatedHandler,
  // Schedules
  createScheduleHandler, listSchedulesHandler, getScheduleHandler,
  updateScheduleHandler, deleteScheduleHandler, runScheduleNowHandler,
  scheduleHealthHandler,
  // Stats
  getStatsTrend, getStatsRadar, getStatsMonthly, getStatsTags,
  // Health
  healthHandler,
  // Vector Search (canonical + backwards-compat alias)
  semanticSearchHandler,
  vectorSearchHandler,
} from './handlers.js';

export const router = Router();

router.get('/health', healthHandler);
router.get('/semantic-search', semanticSearchHandler);
router.get('/vector-search', vectorSearchHandler); // backwards-compat alias
router.get('/ai-usage', getAiUsageHandler);
router.get('/dashboard', getDashboard);
router.get('/cognitive-health', getCognitiveHealthHandler);
router.get('/notes', getNotes);
router.get('/notes/:id', getNoteById);
router.get('/persona-snapshots/:sourceNoteId', getPersonaSnapshotHandler);
router.get('/timeline', getTimeline);
router.get('/calendar', getCalendar);
router.get('/search', searchNotes);
router.get('/config', getConfig);
router.post('/config', updateConfig);
router.post('/index', triggerIndex);
router.get('/index/status', getIndexStatus);
router.get('/index/errors', getIndexErrors);
router.get('/ai/prompts', listAiPrompts);
router.patch('/ai/prompts/:key', updateAiPrompt);
router.delete('/ai/prompts/:key', resetAiPrompt);
router.get('/ai/provider', getAiProviderHandler);
router.patch('/ai/provider', updateAiProviderHandler);
router.post('/ai/provider/test', testAiProviderHandler);
router.get('/ai/suggestions', listAiSuggestionsHandler);
router.post('/worker-tasks', createWorkerTaskHandler);
router.delete('/worker-tasks/finished', clearFinishedWorkerTasksHandler);
router.get('/worker-tasks', listWorkerTasksHandler);
router.get('/worker-tasks/:id', getWorkerTaskHandler);
router.post('/worker-tasks/:id/retry', retryWorkerTaskHandler);
router.post('/worker-tasks/:id/cancel', cancelWorkerTaskHandler);
router.get('/soul-actions', listSoulActionsHandler);
router.get('/soul-actions/:id', getSoulActionHandler);
router.post('/soul-actions/:id/approve', approveSoulActionHandler);
router.post('/soul-actions/:id/dispatch', dispatchSoulActionHandler);
router.post('/soul-actions/:id/defer', deferSoulActionHandler);
router.post('/soul-actions/:id/discard', discardSoulActionHandler);
router.post('/soul-actions/:id/answer', answerFollowupHandler);
router.get('/reintegration-records', listReintegrationRecordsHandler);
router.post('/reintegration-records/:id/accept', acceptReintegrationRecordHandler);
router.post('/reintegration-records/:id/reject', rejectReintegrationRecordHandler);
router.post('/reintegration-records/:id/plan-promotions', planPromotionsHandler);
router.get('/event-nodes', listEventNodesHandler);
router.get('/continuity-records', listContinuityRecordsHandler);
router.get('/brainstorm-sessions', listBrainstormSessionsHandler);
router.get('/brainstorm-sessions/:id', getBrainstormSessionHandler);
router.get('/brainstorm-sessions/:id/related', getBrainstormSessionRelatedHandler);
router.post('/schedules', createScheduleHandler);
router.get('/schedules/health', scheduleHealthHandler);
router.get('/schedules', listSchedulesHandler);
router.get('/schedules/:id', getScheduleHandler);
router.patch('/schedules/:id', updateScheduleHandler);
router.delete('/schedules/:id', deleteScheduleHandler);
router.post('/schedules/:id/run', runScheduleNowHandler);
router.post('/notes', createNote);
router.patch('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);
router.post('/notes/:id/append', appendNote);
router.get('/stats/trend', getStatsTrend);
router.get('/stats/radar', getStatsRadar);
router.get('/stats/monthly', getStatsMonthly);
router.get('/stats/tags', getStatsTags);

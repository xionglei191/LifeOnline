/**
 * Barrel re-export — all handlers split into domain modules.
 *
 * routes.ts imports everything from this file.
 * The actual implementations live in handlers/ subdirectory:
 *   - noteHandlers.ts    — note CRUD + search
 *   - viewHandlers.ts    — dashboard, timeline, calendar, persona snapshot
 *   - configHandlers.ts  — config, index
 *   - aiHandlers.ts      — AI prompts, provider, suggestions
 *   - governanceHandlers.ts — soul actions, reintegration, projections
 *   - workerHandlers.ts  — worker tasks, schedules, stats
 */

// Notes
export { getNotes, getNoteById, searchNotes, createNote, updateNote, appendNote, deleteNote } from './handlers/noteHandlers.js';

// Views
export { getDashboard, getTimeline, getCalendar, getPersonaSnapshotHandler, getCognitiveHealthHandler } from './handlers/viewHandlers.js';

// Config & Index
export { getConfig, updateConfig, triggerIndex, getIndexStatus, getIndexErrors } from './handlers/configHandlers.js';

// AI
export { listAiPrompts, updateAiPrompt, resetAiPrompt, getAiProviderHandler, updateAiProviderHandler, testAiProviderHandler, listAiSuggestionsHandler } from './handlers/aiHandlers.js';

// Governance (soul actions + reintegration + projections)
export { listSoulActionsHandler, getSoulActionHandler, approveSoulActionHandler, deferSoulActionHandler, discardSoulActionHandler, dispatchSoulActionHandler, answerFollowupHandler, listReintegrationRecordsHandler, acceptReintegrationRecordHandler, rejectReintegrationRecordHandler, planPromotionsHandler, listEventNodesHandler, listContinuityRecordsHandler, listBrainstormSessionsHandler, getBrainstormSessionHandler, getBrainstormSessionRelatedHandler } from './handlers/governanceHandlers.js';

// Worker tasks + Schedules + Stats
export { createWorkerTaskHandler, listWorkerTasksHandler, getWorkerTaskHandler, retryWorkerTaskHandler, cancelWorkerTaskHandler, clearFinishedWorkerTasksHandler, createScheduleHandler, listSchedulesHandler, getScheduleHandler, updateScheduleHandler, deleteScheduleHandler, runScheduleNowHandler, scheduleHealthHandler, getStatsTrend, getStatsRadar, getStatsMonthly, getStatsTags } from './handlers/workerHandlers.js';

// Health
export { healthHandler } from './handlers/healthHandlers.js';

// Vector Search
export { semanticSearchHandler, vectorSearchHandler } from './handlers/vectorSearchHandlers.js';

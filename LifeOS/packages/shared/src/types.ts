/**
 * @lifeos/shared — barrel re-export
 *
 * All types are organized into domain-specific files:
 *   core.ts           — primitive enums and type aliases
 *   noteTypes.ts      — note, dashboard, view, stats interfaces
 *   aiTypes.ts        — AI provider, prompt, suggestion types
 *   workerTypes.ts    — worker task, schedule, persona snapshot
 *   soulActionTypes.ts— soul action types and governance helpers
 *   projectionTypes.ts— event nodes, continuity records, projection logic
 *   reintegrationTypes.ts — reintegration records, outcome display, review messages
 *   eventTypes.ts     — WebSocket event types
 */

export * from './core.js';
export * from './noteTypes.js';
export * from './aiTypes.js';
export * from './workerTypes.js';
export * from './soulActionTypes.js';
export * from './projectionTypes.js';
export * from './reintegrationTypes.js';
export * from './eventTypes.js';
export * from './brainstormTypes.js';

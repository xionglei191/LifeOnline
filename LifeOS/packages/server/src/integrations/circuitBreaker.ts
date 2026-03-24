/**
 * Circuit Breaker — automatic safety degradation for PhysicalAction execution.
 *
 * When N consecutive failures of the same action type occur within a sliding
 * time window, the breaker "opens" and forces that type to require manual
 * approval (always_ask), regardless of the configured approval policy.
 *
 * States:
 *   CLOSED  — Normal operation. Failures are counted.
 *   OPEN    — Breaker tripped. All auto-approve is disabled for this type.
 *   HALF_OPEN — Cooldown expired. Next execution is a probe:
 *              success → CLOSED, failure → OPEN again.
 */
import { Logger } from '../utils/logger.js';

const logger = new Logger('circuitBreaker');

// ── Configuration ──────────────────────────────────────

const FAILURE_THRESHOLD = 3;          // consecutive failures to trip
const SLIDING_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const COOLDOWN_MS = 30 * 60 * 1000;        // 30 min auto-recovery

// ── State ──────────────────────────────────────────────

type BreakerState = 'closed' | 'open' | 'half_open';

interface BreakerEntry {
  state: BreakerState;
  failureTimestamps: number[];
  openedAt: number | null;
}

const breakers = new Map<string, BreakerEntry>();

function getOrCreate(actionType: string): BreakerEntry {
  if (!breakers.has(actionType)) {
    breakers.set(actionType, {
      state: 'closed',
      failureTimestamps: [],
      openedAt: null,
    });
  }
  return breakers.get(actionType)!;
}

// ── Public API ─────────────────────────────────────────

/**
 * Check if the breaker is open (tripped) for a given action type.
 * Also handles automatic half_open transition after cooldown.
 */
export function isBreakerOpen(actionType: string): boolean {
  const entry = getOrCreate(actionType);

  if (entry.state === 'closed') return false;

  if (entry.state === 'open' && entry.openedAt) {
    const elapsed = Date.now() - entry.openedAt;
    if (elapsed >= COOLDOWN_MS) {
      entry.state = 'half_open';
      logger.info(`Circuit breaker for "${actionType}" → HALF_OPEN (cooldown expired)`);
      return false; // Allow one probe execution
    }
  }

  if (entry.state === 'half_open') return false; // Allow probe

  return true; // OPEN
}

/**
 * Get the current breaker state for an action type.
 */
export function getBreakerState(actionType: string): BreakerState {
  const entry = getOrCreate(actionType);
  // Check for auto-transition
  if (entry.state === 'open' && entry.openedAt) {
    if (Date.now() - entry.openedAt >= COOLDOWN_MS) {
      entry.state = 'half_open';
    }
  }
  return entry.state;
}

/**
 * Record a failure. If threshold is reached, trip the breaker.
 */
export function recordFailure(actionType: string): void {
  const entry = getOrCreate(actionType);
  const now = Date.now();

  // Prune old timestamps outside the sliding window
  entry.failureTimestamps = entry.failureTimestamps.filter(
    ts => now - ts < SLIDING_WINDOW_MS
  );
  entry.failureTimestamps.push(now);

  if (entry.state === 'half_open') {
    // Probe failed → reopen
    entry.state = 'open';
    entry.openedAt = now;
    logger.warn(`Circuit breaker for "${actionType}" → OPEN (half-open probe failed)`);
    return;
  }

  if (entry.failureTimestamps.length >= FAILURE_THRESHOLD) {
    entry.state = 'open';
    entry.openedAt = now;
    logger.warn(`Circuit breaker for "${actionType}" → OPEN (${FAILURE_THRESHOLD} consecutive failures in ${SLIDING_WINDOW_MS / 60000}min window)`);
  }
}

/**
 * Record a success. Resets the breaker to closed.
 */
export function recordSuccess(actionType: string): void {
  const entry = getOrCreate(actionType);

  if (entry.state === 'half_open') {
    logger.info(`Circuit breaker for "${actionType}" → CLOSED (half-open probe succeeded)`);
  }

  entry.state = 'closed';
  entry.failureTimestamps = [];
  entry.openedAt = null;
}

/**
 * Manually reset a breaker (e.g., from admin UI or emergency stop).
 */
export function resetBreaker(actionType: string): void {
  breakers.delete(actionType);
  logger.info(`Circuit breaker for "${actionType}" manually reset`);
}

/**
 * Get a summary of all breaker states for monitoring.
 */
export function getAllBreakerStates(): Array<{
  actionType: string;
  state: BreakerState;
  recentFailures: number;
  openedAt: string | null;
}> {
  const result: Array<{
    actionType: string;
    state: BreakerState;
    recentFailures: number;
    openedAt: string | null;
  }> = [];

  for (const [actionType, entry] of breakers) {
    // Auto-transition check
    if (entry.state === 'open' && entry.openedAt && Date.now() - entry.openedAt >= COOLDOWN_MS) {
      entry.state = 'half_open';
    }
    result.push({
      actionType,
      state: entry.state,
      recentFailures: entry.failureTimestamps.length,
      openedAt: entry.openedAt ? new Date(entry.openedAt).toISOString() : null,
    });
  }

  return result;
}

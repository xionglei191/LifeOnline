import { getDb } from '../db/client.js';
import { generateSoulActionCandidates, type SoulActionCandidate } from './soulActionGenerator.js';
import { evaluateInterventionGate, type GateDecisionType } from './interventionGate.js';
import { createOrReuseSoulAction } from './soulActions.js';
import { createOrUpdateBrainstormSession, getRecentThemeFrequency, shouldDistill, distillBrainstormSession } from './brainstormSessions.js';
import { buildPersonaContextForNote } from './personaContext.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('postIndexPersonaTrigger');

interface IndexedNoteSnapshot {
  id: string;
  type: string;
  dimension: string;
  content: string;
}

export interface PostIndexTriggerResult {
  triggered: boolean;
  reason: string;
  soulActionIds: string[];
  candidateCount: number;
}

interface IndexedNoteRow {
  id: string;
  file_path: string;
  type: string;
  dimension: string;
  content: string | null;
}

function readIndexedNoteByFilePath(filePath: string): IndexedNoteSnapshot | null {
  const row = getDb()
    .prepare('SELECT id, file_path, type, dimension, content FROM notes WHERE file_path = ?')
    .get(filePath) as IndexedNoteRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    dimension: row.dimension,
    content: row.content ?? '',
  };
}

export function getIndexedNoteTriggerSnapshot(filePath: string): IndexedNoteSnapshot | null {
  return readIndexedNoteByFilePath(filePath);
}

/**
 * Determine if this note should be analyzed at all.
 * 
 * Previously: hardcoded to only growth-dimension notes.
 * Now: any note with changed content goes through cognitive analysis,
 * which decides what actions to suggest.
 */
function shouldAnalyze(
  previousNote: IndexedNoteSnapshot | null,
  currentNote: IndexedNoteSnapshot | null,
  filePath: string,
): currentNote is IndexedNoteSnapshot {
  if (!currentNote) return false;

  // 1. Path-based Immunity Gate: Ignore files in machine-dominated or asset directories
  const normalizedPath = filePath.replace(/\\/g, '/');
  const ignorePatterns = ['/assets/', '/soul/continuity/', '/system/', '/Automated/'];
  if (ignorePatterns.some(pattern => normalizedPath.includes(pattern))) {
    return false;
  }

  // 1.5 Inbox Bypass: Files entering the inbox (e.g. from the mobile app) should always be analyzed
  const isInbox = currentNote.dimension === '_inbox' || normalizedPath.includes('/inbox/');

  // 2. Type-based Immunity Gate: Only analyze explicit human knowledge types (unless it's an inbox drop)
  const allowedCognitiveTypes = ['note', 'record', 'review', 'milestone', 'article'];
  if (!isInbox && !allowedCognitiveTypes.includes(currentNote.type)) {
    return false;
  }
  
  if (!currentNote.content.trim()) return false;
  // Only analyze if content actually changed
  if (previousNote && previousNote.content === currentNote.content) return false;
  return true;
}

/**
 * After a note is indexed, run it through the cognitive pipeline:
 * 1. Cognitive analysis (AI or rules) extracts structured signals
 * 2. Smart generator produces ranked action candidates
 * 3. Intervention gate decides each candidate's fate
 * 4. Qualifying candidates become soul actions
 */
export async function triggerCognitiveAnalysisAfterIndex(params: {
  filePath: string;
  previousNote: IndexedNoteSnapshot | null;
}): Promise<PostIndexTriggerResult> {
  const currentNote = readIndexedNoteByFilePath(params.filePath);

  if (!shouldAnalyze(params.previousNote, currentNote, params.filePath)) {
    return {
      triggered: false,
      reason: 'note does not qualify for cognitive analysis',
      soulActionIds: [],
      candidateCount: 0,
    };
  }

  // Build persona + reintegration history context for richer analysis
  let personaCtx = { personaSummary: null as string | null, recentReintegrationSummaries: [] as string[] };
  try {
    personaCtx = buildPersonaContextForNote(currentNote.id);
  } catch (e) {
    logger.warn('Failed to build persona context:', e);
  }

  // Run through the cognitive pipeline
  const { candidates, analysis, skippedReason } = await generateSoulActionCandidates({
    sourceNoteId: currentNote.id,
    noteId: currentNote.id,
    noteContent: currentNote.content,
    noteDimension: currentNote.dimension,
    noteType: currentNote.type,
    personaContext: personaCtx,
  });

  if (candidates.length === 0) {
    // Still save brainstorm session even with no candidates (the analysis itself is valuable)
    if (analysis) {
      try {
        const session = createOrUpdateBrainstormSession({
          sourceNoteId: currentNote.id,
          rawContent: currentNote.content,
          analysis,
        });
        if (shouldDistill(session)) {
          // Fire and forget
          distillBrainstormSession(session.id).catch(e => {
            logger.warn('async distill failed:', e);
          });
        }
      } catch (e) {
        logger.warn('Failed to save brainstorm session:', e);
      }
    }
    return {
      triggered: false,
      reason: skippedReason ?? '认知分析未产生候选动作',
      soulActionIds: [],
      candidateCount: 0,
    };
  }

  // Save brainstorm session with full analysis
  if (analysis) {
    try {
      const session = createOrUpdateBrainstormSession({
        sourceNoteId: currentNote.id,
        rawContent: currentNote.content,
        analysis,
      });
      if (shouldDistill(session)) {
        // Fire and forget
        distillBrainstormSession(session.id).catch(e => {
          logger.warn('async distill failed:', e);
        });
      }
    } catch (e) {
      logger.warn('Failed to save brainstorm session:', e);
    }
  }

  // ── Cross-session continuity pattern detection ────────
  // If any theme from the current note appeared ≥3 times in the past 7 days,
  // inject a persist_continuity_markdown candidate.
  if (analysis) {
    try {
      const themeFreq = getRecentThemeFrequency(7);
      const currentThemes = analysis.themes.filter(t => t !== 'general');
      const recurringThemes = currentThemes.filter(t => (themeFreq.get(t) ?? 0) >= 3);

      if (recurringThemes.length > 0 && !candidates.some(c => c.actionKind === 'persist_continuity_markdown')) {
        const themeList = recurringThemes.map(t => `${t}(${themeFreq.get(t)}次)`).join('、');
        candidates.push({
          sourceNoteId: currentNote.id,
          actionKind: 'persist_continuity_markdown',
          noteId: currentNote.id,
          trigger: 'cognitive_analysis',
          confidence: Math.min(0.5 + recurringThemes.length * 0.1, 0.85),
          analysisReason: `跨会话连续性检测：主题 ${themeList} 在近7天内反复出现，建议生成持久化连续性认知记录`,
        });
      }
    } catch (e) {
      logger.warn('theme frequency check failed:', e);
    }
  }

  // Evaluate each candidate through the gate
  const soulActionIds: string[] = [];

  for (const candidate of candidates) {
    const gateDecision = evaluateInterventionGate(candidate);

    if (gateDecision.decision === 'discard' || gateDecision.decision === 'observe_only') {
      continue;
    }

    // dispatch_now or queue_for_review → create soul action
    const soulAction = createOrReuseSoulAction({
      sourceNoteId: candidate.sourceNoteId,
      actionKind: candidate.actionKind,
      governanceReason: `${gateDecision.reason} [置信度: ${(candidate.confidence * 100).toFixed(0)}%]`,
    });

    soulActionIds.push(soulAction.id);
  }

  return {
    triggered: soulActionIds.length > 0,
    reason: soulActionIds.length > 0
      ? `认知分析产生 ${candidates.length} 个候选，${soulActionIds.length} 个通过门控`
      : `认知分析产生 ${candidates.length} 个候选，但均未通过门控`,
    soulActionIds,
    candidateCount: candidates.length,
  };
}


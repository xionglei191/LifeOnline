import type { SoulActionKind } from './types.js';
import { analyzeNoteContent, type NoteAnalysis, type SuggestedAction } from './cognitiveAnalyzer.js';
import { adjustConfidenceByHistory } from './gateLearning.js';

// ── Types ──────────────────────────────────────────────

export interface SoulActionCandidate {
  sourceNoteId: string;
  actionKind: SoulActionKind;
  noteId: string;
  trigger: 'cognitive_analysis' | 'manual_extract_tasks_request';
  confidence: number;  // 0-1, how confident the system is about this candidate
  analysisReason: string;  // why this candidate was generated
}

export interface GeneratorResult {
  candidates: SoulActionCandidate[];
  analysis: NoteAnalysis | null;
  skippedReason: string | null;
}

// ── Smart Generator (AI-backed) ────────────────────────

/**
 * Analyze note content with AI and generate multiple ranked candidates.
 * Falls back to rule-based analysis if AI is unavailable.
 * 
 * This is the NEW entry point for the cognitive core.
 */
export async function generateSoulActionCandidates(input: {
  sourceNoteId: string;
  noteId: string;
  noteContent: string;
  noteDimension?: string;
  noteType?: string;
}): Promise<GeneratorResult> {
  const content = input.noteContent.trim();

  if (!content) {
    return {
      candidates: [],
      analysis: null,
      skippedReason: 'empty note content',
    };
  }

  // Run cognitive analysis (AI with rule fallback)
  const analysis = await analyzeNoteContent(input.noteId, content, { dimension: input.noteDimension });

  if (analysis.suggestedActions.length === 0) {
    return {
      candidates: [],
      analysis,
      skippedReason: `分析完成但无建议动作 (actionability=${analysis.actionability.toFixed(2)})`,
    };
  }

  // Convert AI suggestions to candidates with history-adjusted confidence
  const candidates = analysis.suggestedActions
    .map(suggestion => buildCandidate(input, suggestion))
    .filter((c): c is SoulActionCandidate => c !== null)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    candidates,
    analysis,
    skippedReason: null,
  };
}

// ── Internal ───────────────────────────────────────────

function buildCandidate(
  input: { sourceNoteId: string; noteId: string },
  suggestion: SuggestedAction,
): SoulActionCandidate | null {
  // Apply historical confidence adjustment
  const { adjustedConfidence, reason: adjustReason } = adjustConfidenceByHistory(
    suggestion.kind,
    suggestion.confidence,
  );

  // Drop candidates below minimum threshold after adjustment
  if (adjustedConfidence < 0.25) {
    return null;
  }

  return {
    sourceNoteId: input.sourceNoteId,
    actionKind: suggestion.kind,
    noteId: input.noteId,
    trigger: 'cognitive_analysis',
    confidence: adjustedConfidence,
    analysisReason: `${suggestion.reason} (${adjustReason})`,
  };
}

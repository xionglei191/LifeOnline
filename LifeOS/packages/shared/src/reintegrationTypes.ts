// ── Reintegration Types ────────────────────────────────

import type { ContinuityTarget, ContinuityStrength, SoulActionKind, ReintegrationReviewStatus, ReintegrationSignalKind } from './core.js';
import type { WorkerTaskType, TerminalWorkerTaskStatus } from './workerTypes.js';

export interface ExtractTaskReintegrationEvidenceItem {
  title: string;
  dimension: string;
  priority: string;
  due?: string | null;
  filePath: string;
  outputNoteId: string | null;
}

export interface ReintegrationEvidenceSummary {
  taskId: string;
  taskType: WorkerTaskType;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  sourceReintegrationId: string | null;
  resultSummary: string | null;
  error: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
  nextActionCandidate: ExtractTaskReintegrationEvidenceItem | null;
  personaSnapshotId: string | null;
  personaSnapshotSummary: string | null;
  personaContentPreview: string | null;
}

export interface ReintegrationRecordEvidence extends ReintegrationEvidenceSummary, Record<string, unknown> {}

export interface ReintegrationRecordInput {
  workerTaskId: string;
  sourceNoteId: string | null;
  soulActionId: string | null;
  taskType: WorkerTaskType;
  terminalStatus: TerminalWorkerTaskStatus;
  signalKind: ReintegrationSignalKind;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface ReintegrationNextActionSummary {
  createdCount: number | null;
  candidateTitle: string | null;
  candidatePriority: string | null;
  candidateDue: string | null;
  candidateOutputNoteId: string | null;
}

export type ReintegrationNoPlanReason =
  | 'no_suggested_actions'
  | 'next_action_evidence_only'
  | 'no_outcome_signal';

export interface ReintegrationOutcomeDisplaySummary {
  plannedActionCount: number;
  nextActionCreatedCount: number | null;
  nextActionText: string | null;
  hasNextActionEvidence: boolean;
  noPlanReason: ReintegrationNoPlanReason | null;
}

export interface ReintegrationRecord extends ReintegrationRecordInput {
  id: string;
  reviewStatus: ReintegrationReviewStatus;
  reviewReason: string | null;
  nextActionSummary?: ReintegrationNextActionSummary | null;
  displaySummary?: ReintegrationOutcomeDisplaySummary | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface ReintegrationOutcomeSummary {
  signalKind: ReintegrationSignalKind;
  target: ContinuityTarget;
  strength: ContinuityStrength;
  suggestedActionKinds: SoulActionKind[];
}

export interface ReintegrationSummaryContext extends ReintegrationOutcomeSummary {
  summary: string;
}

export interface ActionOutcomePacket {
  taskId: string;
  taskType: WorkerTaskType;
  status: TerminalWorkerTaskStatus;
  resultSummary: string | null;
  error: string | null;
  sourceNoteId: string | null;
  sourceSoulActionId: string | null;
  sourceReintegrationId: string | null;
  outputNotePaths: string[];
  extractTaskCreated: number | null;
  extractTaskItems: ExtractTaskReintegrationEvidenceItem[];
}

export interface ReintegrationOutcomeStripRow {
  label: string;
  value: string | number;
}

export interface ReintegrationOutcomeDetailRow {
  label: string;
  value: string | number;
}

export type ReintegrationReviewOperation = 'accept' | 'reject' | 'plan';

// ── Reintegration Functions ────────────────────────────

export function formatReintegrationSignalKindLabel(record: Pick<ReintegrationRecord, 'signalKind'>): string {
  return record.signalKind === 'summary_reintegration'
    ? '摘要回流'
    : record.signalKind === 'classification_reintegration'
      ? '分类回流'
      : record.signalKind === 'task_extraction_reintegration'
        ? '任务提取回流'
        : record.signalKind === 'persona_snapshot_reintegration'
          ? '人格快照回流'
          : record.signalKind === 'daily_report_reintegration'
            ? '日报回流'
            : record.signalKind === 'weekly_report_reintegration'
              ? '周报回流'
              : 'OpenClaw 回流';
}

export function formatReintegrationTargetLabel(record: Pick<ReintegrationRecord, 'target'>): string {
  return record.target === 'source_note'
    ? '源笔记'
    : record.target === 'derived_outputs'
      ? '派生产物'
      : '任务记录';
}

export function formatReintegrationStrengthLabel(record: Pick<ReintegrationRecord, 'strength'>): string {
  return record.strength === 'medium' ? '中' : '低';
}

export function getSuggestedSoulActionKindsForReintegrationSignal(
  signalKind: ReintegrationSignalKind,
): SoulActionKind[] {
  return signalKind === 'task_extraction_reintegration'
    ? ['create_event_node']
    : signalKind === 'persona_snapshot_reintegration'
      || signalKind === 'daily_report_reintegration'
      || signalKind === 'weekly_report_reintegration'
      ? ['promote_event_node', 'promote_continuity_record']
      : [];
}

export function getReintegrationOutcomeSummary(
  record: Pick<ReintegrationRecord, 'signalKind' | 'target' | 'strength'>,
): ReintegrationOutcomeSummary {
  return {
    signalKind: record.signalKind,
    target: record.target,
    strength: record.strength,
    suggestedActionKinds: getSuggestedSoulActionKindsForReintegrationSignal(record.signalKind),
  };
}

export function normalizeReintegrationNextActionCandidate(candidate: unknown): ExtractTaskReintegrationEvidenceItem | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const normalized = candidate as Record<string, unknown>;
  if (typeof normalized.title !== 'string') {
    return null;
  }

  return {
    title: normalized.title,
    dimension: typeof normalized.dimension === 'string' ? normalized.dimension : '',
    priority: typeof normalized.priority === 'string' ? normalized.priority : '',
    due: typeof normalized.due === 'string' ? normalized.due : null,
    filePath: typeof normalized.filePath === 'string' ? normalized.filePath : '',
    outputNoteId: typeof normalized.outputNoteId === 'string' ? normalized.outputNoteId : null,
  };
}

export function pickReintegrationNextActionCandidate(
  candidates: ReadonlyArray<ExtractTaskReintegrationEvidenceItem | null | undefined>,
): ExtractTaskReintegrationEvidenceItem | null {
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;

  const items = candidates.filter((item): item is ExtractTaskReintegrationEvidenceItem => !!item);
  if (!items.length) return null;

  return [...items].sort((left, right) => {
    const pCmp = (priorityRank[left.priority as keyof typeof priorityRank] ?? 99) - (priorityRank[right.priority as keyof typeof priorityRank] ?? 99);
    if (pCmp !== 0) return pCmp;
    const dCmp = (left.due ?? '9999-12-31').localeCompare(right.due ?? '9999-12-31');
    if (dCmp !== 0) return dCmp;
    return left.filePath.localeCompare(right.filePath);
  })[0] ?? null;
}

export function getReintegrationNextActionCandidate(record: Pick<ReintegrationRecord, 'evidence'>): ExtractTaskReintegrationEvidenceItem | null {
  const evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence as Record<string, unknown> : null;
  return normalizeReintegrationNextActionCandidate(evidence?.nextActionCandidate);
}

export function getReintegrationExtractTaskItems(record: Pick<ReintegrationRecord, 'evidence'>): ExtractTaskReintegrationEvidenceItem[] {
  const evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence as Record<string, unknown> : null;
  const items = evidence?.extractTaskItems;
  return Array.isArray(items)
    ? items.filter((item): item is ExtractTaskReintegrationEvidenceItem => !!item && typeof item === 'object' && typeof (item as { filePath?: unknown }).filePath === 'string')
    : [];
}

export function getReintegrationExtractTaskCount(record: Pick<ReintegrationRecord, 'evidence'>): number | null {
  const evidence = record.evidence && typeof record.evidence === 'object' ? record.evidence as Record<string, unknown> : null;
  const count = evidence?.extractTaskCreated;
  return typeof count === 'number' ? count : null;
}

export function getReintegrationNextActionSummary(record: Pick<ReintegrationRecord, 'evidence'>): ReintegrationNextActionSummary | null {
  const createdCount = getReintegrationExtractTaskCount(record);
  const candidate = getReintegrationNextActionCandidate(record);
  if (createdCount === null && !candidate) return null;
  return {
    createdCount,
    candidateTitle: candidate?.title ?? null,
    candidatePriority: candidate?.priority ?? null,
    candidateDue: candidate?.due ?? null,
    candidateOutputNoteId: candidate?.outputNoteId ?? null,
  };
}

export function formatReintegrationOutcomeNextActionText(summary: ReintegrationNextActionSummary | null | undefined): string | null {
  if (!summary?.candidateTitle) return null;
  const suffix = [summary.candidatePriority, summary.candidateDue ? `due ${summary.candidateDue}` : null].filter(Boolean).join(' · ');
  return suffix ? `${summary.candidateTitle}（${suffix}）` : summary.candidateTitle;
}

export function getReintegrationOutcomeDisplaySummary(
  result: { soulActions: { id: string }[]; nextActionSummary?: ReintegrationNextActionSummary | null },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): ReintegrationOutcomeDisplaySummary {
  const plannedActionCount = result.soulActions.length;
  const nextActionSummary = result.nextActionSummary ?? (fallbackRecord ? getReintegrationNextActionSummary(fallbackRecord) : null);
  const nextActionText = formatReintegrationOutcomeNextActionText(nextActionSummary);
  const hasNextActionEvidence = Boolean(nextActionSummary?.createdCount || nextActionText);
  const suggestedActionKinds = fallbackRecord ? getSuggestedSoulActionKindsForReintegrationSignal(fallbackRecord.signalKind) : [];

  return {
    plannedActionCount,
    nextActionCreatedCount: nextActionSummary?.createdCount ?? null,
    nextActionText,
    hasNextActionEvidence,
    noPlanReason: plannedActionCount > 0 ? null
      : hasNextActionEvidence ? 'next_action_evidence_only'
      : suggestedActionKinds.length > 0 ? 'no_outcome_signal'
      : 'no_suggested_actions',
  };
}

export function formatReintegrationNoPlanReason(reason: ReintegrationNoPlanReason | null): string | null {
  return reason === 'next_action_evidence_only' ? '已有 next-action evidence，但尚未形成可规划动作'
    : reason === 'no_outcome_signal' ? '当前没有足够 outcome signal 进入可规划状态'
    : reason === 'no_suggested_actions' ? '该类回流当前不生成后续治理动作'
    : null;
}

export function getReintegrationOutcomeNoPlanReason(display: ReintegrationOutcomeDisplaySummary | null | undefined): string | null {
  if (!display || display.plannedActionCount > 0) return null;
  return formatReintegrationNoPlanReason(display.noPlanReason);
}

export function getReintegrationOutcomeStripRows(display: ReintegrationOutcomeDisplaySummary | null | undefined): ReintegrationOutcomeStripRow[] {
  if (!display) return [];
  const rows: ReintegrationOutcomeStripRow[] = [];
  if (display.nextActionCreatedCount !== null) rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
  if (display.nextActionText) rows.push({ label: '下一步候选', value: display.nextActionText });
  return rows;
}

export function getReintegrationOutcomeDetailRows(display: ReintegrationOutcomeDisplaySummary | null | undefined): ReintegrationOutcomeDetailRow[] {
  if (!display) return [];
  const rows: ReintegrationOutcomeDetailRow[] = [{ label: '已规划候选动作', value: display.plannedActionCount }];
  if (display.nextActionCreatedCount !== null) rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
  if (display.nextActionText) rows.push({ label: '下一步候选', value: display.nextActionText });
  const noPlanReasonText = getReintegrationOutcomeNoPlanReason(display);
  if (noPlanReasonText) rows.push({ label: '未进入规划原因', value: noPlanReasonText });
  return rows;
}

export function getAcceptReintegrationMessageFromDisplaySummary(display: ReintegrationOutcomeDisplaySummary): string {
  if (display.plannedActionCount) return `已接受并自动规划 ${display.plannedActionCount} 条候选动作`;
  const reasonText = formatReintegrationNoPlanReason(display.noPlanReason);
  if (display.hasNextActionEvidence) {
    return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}${display.nextActionText ? ` · 已记录 next-action evidence：${display.nextActionText}` : ' · 已记录 next-action evidence'}`;
  }
  return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}`;
}

export function getAcceptReintegrationMessage(
  result: { soulActions: { id: string }[]; nextActionSummary?: ReintegrationNextActionSummary | null },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): string {
  return getAcceptReintegrationMessageFromDisplaySummary(getReintegrationOutcomeDisplaySummary(result, fallbackRecord));
}

export function getRejectReintegrationMessage(): string {
  return '已拒绝该回流记录';
}

export function getPlanReintegrationMessageFromDisplaySummary(display: ReintegrationOutcomeDisplaySummary): string {
  if (display.plannedActionCount > 0) {
    return display.nextActionText
      ? `已规划 ${display.plannedActionCount} 条候选动作 · 下一步候选：${display.nextActionText}`
      : `已规划 ${display.plannedActionCount} 条候选动作`;
  }
  const reasonText = formatReintegrationNoPlanReason(display.noPlanReason);
  if (display.hasNextActionEvidence) {
    return `${reasonText ?? '当前没有可规划的候选动作'}${display.nextActionText ? ` · 已记录 next-action evidence：${display.nextActionText}` : ' · 已记录 next-action evidence'}`;
  }
  return reasonText ?? '当前没有可规划的候选动作';
}

export function getPlanReintegrationMessage(
  result: { soulActions: { id: string }[]; nextActionSummary?: ReintegrationNextActionSummary | null },
  fallbackRecord?: Pick<ReintegrationRecord, 'evidence' | 'signalKind'> | null,
): string {
  return getPlanReintegrationMessageFromDisplaySummary(getReintegrationOutcomeDisplaySummary(result, fallbackRecord));
}

export function getReintegrationReviewMessage(
  operation: ReintegrationReviewOperation,
  display?: ReintegrationOutcomeDisplaySummary | null,
): string {
  if (operation === 'reject') return '已拒绝该回流记录';
  if (!display) return operation === 'accept' ? '已接受该回流记录' : '当前没有可规划的候选动作';
  return operation === 'accept'
    ? getAcceptReintegrationMessageFromDisplaySummary(display)
    : getPlanReintegrationMessageFromDisplaySummary(display);
}

// ── API Responses ──────────────────────────────────────

export interface ListReintegrationRecordsResponse {
  reintegrationRecords: ReintegrationRecord[];
  filters: {
    reviewStatus?: ReintegrationRecord['reviewStatus'];
    sourceNoteId?: string;
  };
}

export interface ReintegrationReviewRequest {
  reason?: string | null;
}

export interface AcceptReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
  soulActions: { id: string; actionKind: SoulActionKind }[];
  nextActionSummary: ReintegrationNextActionSummary | null;
  displaySummary: ReintegrationOutcomeDisplaySummary;
}

export interface RejectReintegrationRecordResponse {
  reintegrationRecord: ReintegrationRecord;
}

export interface PlanReintegrationPromotionsResponse {
  reintegrationRecord: ReintegrationRecord;
  soulActions: { id: string; actionKind: SoulActionKind }[];
  nextActionSummary: ReintegrationNextActionSummary | null;
  displaySummary: ReintegrationOutcomeDisplaySummary;
}

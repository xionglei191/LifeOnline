import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';

export type SoulActionGroupQuickFilter = 'all' | 'pending_only' | 'dispatch_ready_only';

export interface SoulActionGroup {
  sourceNoteId: string;
  actions: SoulAction[];
  reintegrationRecord: ReintegrationRecord | null;
  pendingCount: number;
  dispatchReadyCount: number;
}

export function getSoulActionGroupQuickFilterLabel(filter: SoulActionGroupQuickFilter): string {
  switch (filter) {
    case 'pending_only':
      return '仅待治理分组';
    case 'dispatch_ready_only':
      return '仅可派发分组';
    default:
      return '全部分组';
  }
}

export function getSoulActionGroupCount(soulActions: SoulAction[]): number {
  return new Set(soulActions.map((action) => action.sourceNoteId)).size;
}

export function buildSoulActionGroups(
  soulActions: SoulAction[],
  reintegrationRecords: ReintegrationRecord[],
  quickFilter: SoulActionGroupQuickFilter,
): SoulActionGroup[] {
  const grouped = new Map<string, { sourceNoteId: string; actions: SoulAction[]; reintegrationRecord: ReintegrationRecord | null }>();

  for (const action of soulActions) {
    const key = action.sourceNoteId;
    const existing = grouped.get(key);
    if (existing) {
      existing.actions.push(action);
      continue;
    }
    grouped.set(key, {
      sourceNoteId: key,
      actions: [action],
      reintegrationRecord: reintegrationRecords.find((record) => record.id === key) || null,
    });
  }

  const groups = Array.from(grouped.values()).map((group) => ({
    ...group,
    pendingCount: group.actions.filter((action) => action.governanceStatus === 'pending_review').length,
    dispatchReadyCount: group.actions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched').length,
  }));

  const filteredGroups = quickFilter === 'pending_only'
    ? groups.filter((group) => group.pendingCount > 0)
    : quickFilter === 'dispatch_ready_only'
      ? groups.filter((group) => group.dispatchReadyCount === group.actions.length && group.dispatchReadyCount > 0)
      : groups;

  return filteredGroups.sort((left, right) => {
    const leftTime = left.reintegrationRecord?.createdAt || left.actions[0]?.createdAt || '';
    const rightTime = right.reintegrationRecord?.createdAt || right.actions[0]?.createdAt || '';
    return rightTime.localeCompare(leftTime);
  });
}

export function getSoulActionGroupQuickFilterStats(
  soulActions: SoulAction[],
  reintegrationRecords: ReintegrationRecord[],
  quickFilter: SoulActionGroupQuickFilter,
): string {
  return `${buildSoulActionGroups(soulActions, reintegrationRecords, quickFilter).length} / ${getSoulActionGroupCount(soulActions)} 分组命中`;
}

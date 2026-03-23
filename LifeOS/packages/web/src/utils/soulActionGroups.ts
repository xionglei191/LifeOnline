import type { ReintegrationRecord, SoulAction } from '@lifeos/shared';

export type SoulActionGroupQuickFilter = 'all' | 'pending_only' | 'dispatch_ready_only';

export interface SoulActionGroup {
  groupKey: string;
  actions: SoulAction[];
  reintegrationRecord: ReintegrationRecord | null;
  pendingCount: number;
  dispatchReadyCount: number;
  recentActivityAt: string;
  recentActivityKind: 'reintegration' | 'action';
  recentActivityLabel: string;
}

function getSoulActionGroupKey(action: SoulAction): string {
  return action.sourceReintegrationId || action.sourceNoteId;
}

function getSoulActionLatestActivity(action: SoulAction): { at: string; label: string } {
  if (action.finishedAt) return { at: action.finishedAt, label: '最近完成' };
  if (action.startedAt) return { at: action.startedAt, label: '最近开始执行' };
  if (action.discardedAt) return { at: action.discardedAt, label: '最近丢弃' };
  if (action.deferredAt) return { at: action.deferredAt, label: '最近延后' };
  if (action.approvedAt) return { at: action.approvedAt, label: '最近批准' };
  if (action.updatedAt && action.updatedAt !== action.createdAt) return { at: action.updatedAt, label: '最近更新' };
  return { at: action.createdAt, label: '最近创建' };
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
  return new Set(soulActions.map((action) => getSoulActionGroupKey(action))).size;
}

export function buildSoulActionGroups(
  soulActions: SoulAction[],
  reintegrationRecords: ReintegrationRecord[],
  quickFilter: SoulActionGroupQuickFilter,
): SoulActionGroup[] {
  const grouped = new Map<string, { groupKey: string; actions: SoulAction[]; reintegrationRecord: ReintegrationRecord | null }>();

  for (const action of soulActions) {
    const key = getSoulActionGroupKey(action);
    const existing = grouped.get(key);
    if (existing) {
      existing.actions.push(action);
      continue;
    }
    grouped.set(key, {
      groupKey: key,
      actions: [action],
      reintegrationRecord: reintegrationRecords.find((record) => record.id === key) || null,
    });
  }

  const groups = Array.from(grouped.values()).map((group) => {
    const latestActionActivity = group.actions
      .map((action) => ({ action, activity: getSoulActionLatestActivity(action) }))
      .sort((left, right) => right.activity.at.localeCompare(left.activity.at))[0];
    const recentReintegrationAt = group.reintegrationRecord?.updatedAt || group.reintegrationRecord?.createdAt || '';
    const recentActionAt = latestActionActivity?.activity.at || '';
    const recentActivityUsesReintegration = recentReintegrationAt.localeCompare(recentActionAt) >= 0;

    return {
      ...group,
      pendingCount: group.actions.filter((action) => action.governanceStatus === 'pending_review').length,
      dispatchReadyCount: group.actions.filter((action) => action.governanceStatus === 'approved' && action.executionStatus === 'not_dispatched').length,
      recentActivityAt: recentActivityUsesReintegration ? recentReintegrationAt : recentActionAt,
      recentActivityKind: recentActivityUsesReintegration ? 'reintegration' : 'action',
      recentActivityLabel: recentActivityUsesReintegration
        ? '最近变更'
        : latestActionActivity?.activity.label === '最近创建'
          ? '最近动作'
          : latestActionActivity?.activity.label,
    };
  });

  const filteredGroups = quickFilter === 'pending_only'
    ? groups.filter((group) => group.pendingCount > 0)
    : quickFilter === 'dispatch_ready_only'
      ? groups.filter((group) => group.dispatchReadyCount === group.actions.length && group.dispatchReadyCount > 0)
      : groups;

  return filteredGroups.sort((left, right) => {
    const activityCompare = right.recentActivityAt.localeCompare(left.recentActivityAt);
    if (activityCompare !== 0) {
      return activityCompare;
    }

    const rightFallback = right.reintegrationRecord?.createdAt || right.actions[0]?.createdAt || '';
    const leftFallback = left.reintegrationRecord?.createdAt || left.actions[0]?.createdAt || '';
    const fallbackCompare = rightFallback.localeCompare(leftFallback);
    if (fallbackCompare !== 0) {
      return fallbackCompare;
    }

    return right.groupKey.localeCompare(left.groupKey);
  });
}

export function getSoulActionGroupQuickFilterStats(
  soulActions: SoulAction[],
  reintegrationRecords: ReintegrationRecord[],
  quickFilter: SoulActionGroupQuickFilter,
): string {
  return `${buildSoulActionGroups(soulActions, reintegrationRecords, quickFilter).length} / ${getSoulActionGroupCount(soulActions)} 分组命中`;
}

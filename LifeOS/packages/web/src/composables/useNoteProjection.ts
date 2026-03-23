/**
 * Composable: promotion projection state & logic for a note.
 * Extracted from NoteDetail.vue to isolate the complex projection data flow.
 */
import { ref, computed, type Ref } from 'vue';
import { formatSoulActionKindLabel, formatSoulActionOutcomeSummary, formatSoulActionSourceLabel } from '@lifeos/shared';
import type { EventNode, ContinuityRecord, SoulAction } from '@lifeos/shared';
import { fetchReintegrationRecords, fetchEventNodeProjectionList, fetchContinuityProjectionList, fetchSoulActions } from '../api/client';

export function useNoteProjection(currentNoteId: Ref<string | null>) {
  const eventNodes = ref<EventNode[]>([]);
  const continuityRecords = ref<ContinuityRecord[]>([]);
  const projectionSourceRecords = ref<Array<{ id: string; sourceNoteId: string | null; reviewStatus: string }>>([]);
  const noteSoulActions = ref<SoulAction[]>([]);
  const projectionLoading = ref(false);
  const projectionMessage = ref('');
  const projectionMessageType = ref<'success' | 'error'>('success');

  const noteProjectionSourceReintegrationIds = computed(() => {
    if (!currentNoteId.value) return [];
    const sourceNoteId = currentNoteId.value;
    const acceptedIds = projectionSourceRecords.value
      .filter((record) => record.sourceNoteId === sourceNoteId && record.reviewStatus === 'accepted')
      .map((record) => record.id);
    const actionIds = noteSoulActions.value
      .map((action) => action.sourceReintegrationId)
      .filter((value): value is string => Boolean(value));
    const eventNodeIds = eventNodes.value.map((eventNode) => eventNode.sourceReintegrationId);
    const continuityIds = continuityRecords.value.map((continuity) => continuity.sourceReintegrationId);
    return [...new Set([...acceptedIds, ...actionIds, ...eventNodeIds, ...continuityIds])];
  });

  const noteEventNodes = computed(() => {
    if (!currentNoteId.value) return [];
    const sourceIds = new Set(noteProjectionSourceReintegrationIds.value);
    return eventNodes.value.filter((eventNode) => (
      eventNode.sourceNoteId === currentNoteId.value
      || sourceIds.has(eventNode.sourceReintegrationId)
    ));
  });

  const noteContinuityRecords = computed(() => {
    if (!currentNoteId.value) return [];
    const sourceIds = new Set(noteProjectionSourceReintegrationIds.value);
    return continuityRecords.value.filter((continuity) => (
      continuity.sourceNoteId === currentNoteId.value
      || sourceIds.has(continuity.sourceReintegrationId)
    ));
  });

  const relevantNoteSoulActions = computed(() => {
    if (!currentNoteId.value) return [];
    const sourceIds = new Set(noteProjectionSourceReintegrationIds.value);
    return noteSoulActions.value.filter((action) => {
      const matchesCurrentNote = action.sourceNoteId === currentNoteId.value;
      const matchesProjectionSource = action.sourceReintegrationId != null && sourceIds.has(action.sourceReintegrationId);
      return matchesCurrentNote || matchesProjectionSource;
    });
  });

  const notePendingSoulActions = computed(() =>
    relevantNoteSoulActions.value.filter((a) => a.governanceStatus === 'pending_review')
  );
  const noteApprovedSoulActions = computed(() =>
    relevantNoteSoulActions.value.filter((a) => a.governanceStatus === 'approved')
  );
  const noteDispatchedSoulActions = computed(() =>
    relevantNoteSoulActions.value.filter((a) => a.executionStatus === 'succeeded')
  );

  const hasPromotionProjectionSection = computed(() => {
    return projectionLoading.value
      || noteEventNodes.value.length > 0
      || noteContinuityRecords.value.length > 0
      || relevantNoteSoulActions.value.length > 0
      || noteProjectionSourceReintegrationIds.value.length > 0
      || Boolean(projectionMessage.value);
  });

  function formatProjectionTime(ts: string) {
    return new Date(ts).toLocaleString('zh-CN');
  }

  function promotionActionLabel(actionKind: SoulAction['actionKind']) {
    return formatSoulActionKindLabel(actionKind);
  }

  function soulActionStatusText(action: SoulAction) {
    if (action.executionStatus === 'succeeded') return '已执行';
    if (action.executionStatus === 'running') return '执行中';
    if (action.executionStatus === 'failed') return '执行失败';
    if (action.executionStatus === 'cancelled') return '已取消';
    if (action.governanceStatus === 'approved') return '待派发';
    if (action.governanceStatus === 'deferred') return '已延后';
    if (action.governanceStatus === 'discarded') return '已丢弃';
    return '待治理';
  }

  function doesProjectionArtifactAffectCurrentNote(sourceNoteId: string | null, sourceReintegrationId: string) {
    if (!currentNoteId.value) return false;
    if (sourceNoteId === currentNoteId.value) return true;
    const sourceIds = new Set(noteProjectionSourceReintegrationIds.value);
    return sourceIds.has(sourceReintegrationId);
  }

  function doesSoulActionAffectCurrentNote(action: SoulAction) {
    if (!currentNoteId.value) return false;
    if (action.sourceNoteId === currentNoteId.value) return true;
    const sourceIds = new Set(noteProjectionSourceReintegrationIds.value);
    if (action.sourceReintegrationId != null && sourceIds.has(action.sourceReintegrationId)) return true;
    return action.sourceNoteId?.startsWith('reint:')
      ? sourceIds.has(action.sourceNoteId.slice('reint:'.length))
      : false;
  }

  async function loadPromotionProjections(sourceNoteId: string, requestId?: number, activeRequestId?: number) {
    projectionLoading.value = true;
    projectionMessage.value = '';
    try {
      const [reintegrationRecords, soulActions] = await Promise.all([
        fetchReintegrationRecords({ sourceNoteId }),
        fetchSoulActions({ sourceNoteId }),
      ]);
      if (requestId != null && (requestId !== activeRequestId || currentNoteId.value !== sourceNoteId)) return;
      projectionSourceRecords.value = reintegrationRecords.filter((record) => record.sourceNoteId === sourceNoteId);
      const projectionSourceRecordIds = new Set(projectionSourceRecords.value.map((record) => record.id));
      noteSoulActions.value = soulActions.filter((action) => (
        action.sourceNoteId === sourceNoteId
        || (action.sourceReintegrationId != null && projectionSourceRecordIds.has(action.sourceReintegrationId))
      ));
      const sourceReintegrationIds = [...new Set(noteSoulActions.value
        .map((action) => action.sourceReintegrationId)
        .filter((value): value is string => Boolean(value)))];
      const scopedSourceIds = [...new Set([...projectionSourceRecords.value.map((record) => record.id), ...sourceReintegrationIds])];
      if (!scopedSourceIds.length) {
        eventNodes.value = [];
        continuityRecords.value = [];
        return;
      }

      const [eventNodeResult, continuityResult] = await Promise.allSettled([
        fetchEventNodeProjectionList(scopedSourceIds),
        fetchContinuityProjectionList(scopedSourceIds),
      ]);
      if (requestId != null && (requestId !== activeRequestId || currentNoteId.value !== sourceNoteId)) return;

      const projectionErrors: string[] = [];

      if (eventNodeResult.status === 'fulfilled') {
        const serverScopedIds = new Set(eventNodeResult.value.filters.sourceReintegrationIds);
        eventNodes.value = eventNodeResult.value.items.filter((eventNode) => (
          serverScopedIds.size === 0 || serverScopedIds.has(eventNode.sourceReintegrationId)
        ));
      } else {
        eventNodes.value = [];
        projectionErrors.push(eventNodeResult.reason?.message || '加载 event nodes 失败');
      }

      if (continuityResult.status === 'fulfilled') {
        const serverScopedIds = new Set(continuityResult.value.filters.sourceReintegrationIds);
        continuityRecords.value = continuityResult.value.items.filter((continuity) => (
          serverScopedIds.size === 0 || serverScopedIds.has(continuity.sourceReintegrationId)
        ));
      } else {
        continuityRecords.value = [];
        projectionErrors.push(continuityResult.reason?.message || '加载 continuity records 失败');
      }

      if (projectionErrors.length) {
        projectionMessage.value = projectionErrors.join('；');
        projectionMessageType.value = 'error';
      }
    } catch (e: any) {
      if (requestId != null && (requestId !== activeRequestId || currentNoteId.value !== sourceNoteId)) return;
      projectionSourceRecords.value = [];
      noteSoulActions.value = [];
      eventNodes.value = [];
      continuityRecords.value = [];
      projectionMessage.value = e.message || '加载 promotion projections 失败';
      projectionMessageType.value = 'error';
    } finally {
      if (requestId == null || (requestId === activeRequestId && currentNoteId.value === sourceNoteId)) {
        projectionLoading.value = false;
      }
    }
  }

  function resetProjectionState() {
    projectionSourceRecords.value = [];
    noteSoulActions.value = [];
    eventNodes.value = [];
    continuityRecords.value = [];
    projectionLoading.value = false;
    projectionMessage.value = '';
  }

  return {
    // State
    eventNodes,
    continuityRecords,
    projectionSourceRecords,
    noteSoulActions,
    projectionLoading,
    projectionMessage,
    projectionMessageType,
    // Computed
    noteProjectionSourceReintegrationIds,
    noteEventNodes,
    noteContinuityRecords,
    relevantNoteSoulActions,
    notePendingSoulActions,
    noteApprovedSoulActions,
    noteDispatchedSoulActions,
    hasPromotionProjectionSection,
    // Methods
    formatProjectionTime,
    promotionActionLabel,
    soulActionStatusText,
    doesProjectionArtifactAffectCurrentNote,
    doesSoulActionAffectCurrentNote,
    loadPromotionProjections,
    resetProjectionState,
    formatSoulActionOutcomeSummary,
    formatSoulActionSourceLabel,
  };
}

export const DIMENSION_LABELS = {
    health: '健康',
    career: '事业',
    finance: '财务',
    learning: '学习',
    relationship: '关系',
    life: '生活',
    hobby: '兴趣',
    growth: '成长',
};
export const SELECTABLE_DIMENSIONS = Object.keys(DIMENSION_LABELS);
export const DIMENSION_DIRECTORY_NAMES = DIMENSION_LABELS;
export const DIMENSION_KEY_BY_DIRECTORY = {
    ...Object.fromEntries(Object.entries(DIMENSION_DIRECTORY_NAMES).map(([key, value]) => [value, key])),
    _Inbox: '_inbox',
    _Daily: 'growth',
    _Weekly: 'growth',
};
export const SUPPORTED_WORKER_NAMES = ['openclaw', 'lifeos'];
export function isSupportedWorkerName(value) {
    return typeof value === 'string' && SUPPORTED_WORKER_NAMES.includes(value);
}
export const SUPPORTED_WORKER_TASK_TYPES = [
    'openclaw_task',
    'summarize_note',
    'classify_inbox',
    'extract_tasks',
    'update_persona_snapshot',
    'daily_report',
    'weekly_report',
];
export const SUPPORTED_SOUL_ACTION_KINDS = [
    'extract_tasks',
    'update_persona_snapshot',
    'create_event_node',
    'promote_event_node',
    'promote_continuity_record',
];
export const SUPPORTED_SOUL_ACTION_GOVERNANCE_STATUSES = ['pending_review', 'approved', 'deferred', 'discarded'];
export const SUPPORTED_SOUL_ACTION_EXECUTION_STATUSES = ['not_dispatched', 'pending', 'running', 'succeeded', 'failed', 'cancelled'];
export function normalizeSoulActionSourceFilters(filters, soulActions) {
    const matchesLegacyReintegrationIdentity = Boolean(filters.sourceNoteId?.startsWith('reint:')
        && !filters.sourceReintegrationId
        && soulActions.some((action) => action.sourceReintegrationId === filters.sourceNoteId));
    return {
        sourceNoteId: matchesLegacyReintegrationIdentity ? undefined : filters.sourceNoteId,
        sourceReintegrationId: filters.sourceReintegrationId
            ?? (matchesLegacyReintegrationIdentity ? filters.sourceNoteId : undefined),
    };
}
export function buildEventPromotionExplanation(record) {
    const nextActionCandidate = getReintegrationNextActionCandidate(record);
    return {
        whyHighThreshold: 'review-backed PR6 promotion',
        whyNow: nextActionCandidate?.title ?? record.summary,
        reviewBacked: true,
    };
}
export function buildContinuityPromotionExplanation(record) {
    return {
        whyNotOrdinaryArtifact: 'PR6 continuity promotion',
        whyReviewBacked: record.reviewReason ?? 'accepted reintegration record',
        reviewBacked: true,
    };
}
export function formatEventKindLabel(eventNode) {
    return eventNode.eventKind === 'persona_shift'
        ? '人格切换'
        : eventNode.eventKind === 'milestone_report'
            ? '里程碑'
            : '周回顾';
}
export function formatEventNodeThresholdLabel(eventNode) {
    return eventNode.threshold === 'high' ? '高阈值' : eventNode.threshold;
}
export function formatEventNodeStatusLabel(eventNode) {
    return eventNode.status === 'active' ? '生效中' : eventNode.status;
}
export function formatContinuityKindLabel(record) {
    return record.continuityKind === 'persona_direction'
        ? '人格走向'
        : record.continuityKind === 'daily_rhythm'
            ? '日节律'
            : '周主题';
}
export function formatReintegrationSignalKindLabel(record) {
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
export function formatContinuityTargetLabel(record) {
    return record.target === 'source_note'
        ? '源笔记'
        : record.target === 'derived_outputs'
            ? '派生产物'
            : '任务记录';
}
export function formatReintegrationTargetLabel(record) {
    return formatContinuityTargetLabel({ target: record.target });
}
export function formatContinuityStrengthLabel(record) {
    return record.strength === 'medium' ? '中' : '低';
}
export function formatReintegrationStrengthLabel(record) {
    return formatContinuityStrengthLabel({ strength: record.strength });
}
export function getProjectionExplanationSummary(projection) {
    const explanation = projection.explanation && typeof projection.explanation === 'object'
        ? projection.explanation
        : null;
    const derivedPrimaryReason = typeof explanation?.whyNow === 'string'
        ? explanation.whyNow
        : typeof explanation?.whyReviewBacked === 'string'
            ? explanation.whyReviewBacked
            : typeof explanation?.whyNotOrdinaryArtifact === 'string'
                ? explanation.whyNotOrdinaryArtifact
                : typeof explanation?.whyHighThreshold === 'string'
                    ? explanation.whyHighThreshold
                    : null;
    const derivedRationale = typeof explanation?.whyHighThreshold === 'string'
        ? explanation.whyHighThreshold
        : typeof explanation?.whyNotOrdinaryArtifact === 'string'
            ? explanation.whyNotOrdinaryArtifact
            : typeof explanation?.whyReviewBacked === 'string' && explanation.whyReviewBacked !== derivedPrimaryReason
                ? explanation.whyReviewBacked
                : null;
    const derivedReviewBacked = explanation?.reviewBacked === true;
    const summary = projection.explanationSummary;
    const primaryReason = summary?.primaryReason ?? derivedPrimaryReason;
    const rationale = summary?.rationale ?? derivedRationale;
    const reviewBacked = summary?.reviewBacked ?? derivedReviewBacked;
    if (!primaryReason && !rationale && !reviewBacked) {
        return null;
    }
    return {
        primaryReason,
        rationale,
        reviewBacked,
    };
}
export function buildProjectionExplanationSummary(projection) {
    return getProjectionExplanationSummary({
        explanation: projection.explanation,
        explanationSummary: null,
    });
}
export function getProjectionExplanationRows(projection) {
    const summary = getProjectionExplanationSummary(projection);
    const rows = [];
    if (summary?.primaryReason) {
        rows.push({ label: '主要原因', value: summary.primaryReason });
    }
    if (summary?.rationale) {
        rows.push({ label: '提升理由', value: summary.rationale });
    }
    if (summary?.reviewBacked) {
        rows.push({ label: '治理依据', value: 'review-backed' });
    }
    return rows;
}
function isProjectionExplanationSource(item) {
    return 'explanation' in item;
}
export function getPromotionExplanationRows(item) {
    if ('promotionSummary' in item) {
        const summary = item.promotionSummary;
        const rows = [];
        if (summary?.sourceSummary) {
            rows.push({ label: '来源摘要', value: summary.sourceSummary });
        }
        if (summary?.primaryReason) {
            rows.push({ label: '主要原因', value: summary.primaryReason });
        }
        if (summary?.rationale) {
            rows.push({ label: '提升理由', value: summary.rationale });
        }
        if (summary?.reviewBacked) {
            rows.push({ label: '治理依据', value: 'review-backed' });
        }
        if (!rows.length && item.governanceReason) {
            rows.push({ label: '治理理由', value: item.governanceReason });
        }
        return rows;
    }
    return isProjectionExplanationSource(item) ? getProjectionExplanationRows(item) : [];
}
export function formatProjectionExplanationSummary(projection) {
    const summary = getProjectionExplanationSummary(projection);
    if (!summary) {
        return null;
    }
    const segments = [summary.primaryReason, summary.rationale, summary.reviewBacked ? 'review-backed' : null].filter(Boolean);
    return segments.length ? segments.join(' · ') : null;
}
export function formatProjectionExplanationDetails(projection) {
    return getProjectionExplanationRows(projection).map((row) => `${row.label}：${row.value}`);
}
export function getProjectionContinuitySummary(record) {
    const continuity = record.continuity && typeof record.continuity === 'object'
        ? record.continuity
        : null;
    if (!continuity) {
        return null;
    }
    const anchor = typeof continuity.anchor === 'string' ? continuity.anchor : null;
    const scope = typeof continuity.scope === 'string' ? continuity.scope : null;
    if (!anchor && !scope) {
        return null;
    }
    return {
        anchor,
        scope,
    };
}
export function formatProjectionContinuitySummary(record) {
    const summary = getProjectionContinuitySummary(record);
    if (!summary) {
        return null;
    }
    const segments = [summary.anchor, summary.scope ? `scope ${summary.scope}` : null].filter(Boolean);
    return segments.length ? segments.join(' · ') : null;
}
export function formatProjectionContinuityDetails(record) {
    const continuity = record.continuity && typeof record.continuity === 'object'
        ? record.continuity
        : null;
    if (!continuity) {
        return [];
    }
    const detailEntries = [
        ['锚点', typeof continuity.anchor === 'string' ? continuity.anchor : null],
        ['范围', typeof continuity.scope === 'string' ? continuity.scope : null],
        ['主张', typeof continuity.claim === 'string' ? continuity.claim : null],
        ['趋势', typeof continuity.trend === 'string' ? continuity.trend : null],
    ];
    return detailEntries
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => `${label}：${value}`);
}
export function getPromotionSourceForReintegration(record) {
    return {
        sourceNoteId: record.sourceNoteId ?? record.id,
        sourceReintegrationId: record.id,
    };
}
export function getPromotionProjectionSourceForReintegration(record) {
    return {
        sourceNoteId: record.sourceNoteId,
        sourceReintegrationId: record.id,
    };
}
export function formatSoulActionPromotionSummary(action) {
    const summary = action.promotionSummary;
    if (!summary) {
        return null;
    }
    const segments = [
        summary.projectionKind === 'event'
            ? '投射 EventNode'
            : summary.projectionKind === 'continuity'
                ? '投射 ContinuityRecord'
                : null,
        summary.reviewBacked ? 'review-backed' : null,
        summary.sourceSummary,
        summary.primaryReason,
        summary.rationale,
    ].filter(Boolean);
    return segments.length ? segments.join(' · ') : null;
}
export function formatSoulActionSourceLabel(action) {
    if (action.sourceReintegrationId && action.sourceNoteId) {
        return `Reintegration ${action.sourceReintegrationId} (source note ${action.sourceNoteId})`;
    }
    if (action.sourceReintegrationId) {
        return `Reintegration ${action.sourceReintegrationId}`;
    }
    return `source note ${action.sourceNoteId}`;
}
export function formatSoulActionKindLabel(actionKind) {
    if (actionKind === 'ask_followup_question')
        return '提出追问';
    if (actionKind === 'extract_tasks')
        return '提取任务';
    if (actionKind === 'update_persona_snapshot')
        return '更新 Persona Snapshot';
    if (actionKind === 'create_event_node')
        return '创建 Event Node';
    if (actionKind === 'promote_event_node')
        return '提升 Event Node';
    if (actionKind === 'promote_continuity_record')
        return '提升 Continuity Record';
    return actionKind;
}
export function getSoulActionGovernanceMessage(action, operation) {
    const actionLabel = formatSoulActionKindLabel(action.actionKind);
    const operationLabel = operation === 'approved'
        ? '已批准'
        : operation === 'deferred'
            ? '已延后'
            : '已丢弃';
    return `${actionLabel} ${operationLabel}`;
}
export function getDispatchExecutionMessage(result) {
    const summary = result.executionSummary;
    if (!summary?.summary) {
        return result.reason;
    }
    const objectLabel = summary.objectType === 'event_node'
        ? 'Event Node'
        : summary.objectType === 'continuity_record'
            ? 'Continuity Record'
            : summary.objectType === 'worker_task'
                ? 'Worker Task'
                : null;
    const operationLabel = summary.operation === 'created'
        ? '已创建'
        : summary.operation === 'updated'
            ? '已更新'
            : summary.operation === 'enqueued'
                ? '已入队'
                : null;
    if (objectLabel && operationLabel && summary.objectId) {
        return `${operationLabel} ${objectLabel} · ${summary.summary} (${summary.objectId})`;
    }
    return summary.summary;
}
export function formatSoulActionOutcomeSummary(action) {
    if (action.error) {
        return `执行错误：${action.error}`;
    }
    if (action.executionSummary) {
        return getDispatchExecutionMessage({
            reason: action.resultSummary ?? action.executionSummary.summary ?? 'approved soul action dispatched through worker host',
            executionSummary: action.executionSummary,
        });
    }
    if (!action.resultSummary) {
        if (action.executionStatus === 'running') {
            return '执行中';
        }
        if (action.executionStatus === 'pending' && action.workerTaskId) {
            return `已入队 Worker Task · ${action.workerTaskId}`;
        }
        return null;
    }
    if (action.workerTaskId && action.executionStatus !== 'succeeded') {
        return `${action.resultSummary} · Worker Task ${action.workerTaskId}`;
    }
    return action.resultSummary;
}
export function getSoulActionPromotionSummary(action, record) {
    if (!action.sourceReintegrationId) {
        return null;
    }
    const projectionKind = action.actionKind === 'promote_continuity_record'
        ? 'continuity'
        : action.actionKind === 'promote_event_node' || action.actionKind === 'create_event_node'
            ? 'event'
            : null;
    if (!projectionKind) {
        return null;
    }
    const sourceSummary = record?.summary ?? null;
    const primaryReason = record?.reviewReason ?? action.governanceReason ?? null;
    const rationale = projectionKind === 'event'
        ? 'review-backed PR6 promotion'
        : projectionKind === 'continuity'
            ? 'PR6 continuity promotion'
            : null;
    return {
        sourceSummary,
        primaryReason,
        rationale,
        reviewBacked: true,
        projectionKind,
    };
}
export function getSuggestedSoulActionKindsForReintegrationSignal(signalKind) {
    return signalKind === 'task_extraction_reintegration'
        ? ['create_event_node']
        : signalKind === 'persona_snapshot_reintegration'
            || signalKind === 'daily_report_reintegration'
            || signalKind === 'weekly_report_reintegration'
            ? ['promote_event_node', 'promote_continuity_record']
            : [];
}
export function getReintegrationOutcomeSummary(record) {
    return {
        signalKind: record.signalKind,
        target: record.target,
        strength: record.strength,
        suggestedActionKinds: getSuggestedSoulActionKindsForReintegrationSignal(record.signalKind),
    };
}
export function getReintegrationOutcomeStripRows(display) {
    if (!display) {
        return [];
    }
    const rows = [];
    if (display.nextActionCreatedCount !== null) {
        rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
    }
    if (display.nextActionText) {
        rows.push({ label: '下一步候选', value: display.nextActionText });
    }
    return rows;
}
export function getReintegrationOutcomeNoPlanReason(display) {
    if (!display || display.plannedActionCount > 0) {
        return null;
    }
    return formatReintegrationNoPlanReason(display.noPlanReason);
}
export function getReintegrationOutcomeDetailRows(display) {
    if (!display) {
        return [];
    }
    const rows = [
        { label: '已规划候选动作', value: display.plannedActionCount },
    ];
    if (display.nextActionCreatedCount !== null) {
        rows.push({ label: '产出行动项', value: display.nextActionCreatedCount });
    }
    if (display.nextActionText) {
        rows.push({ label: '下一步候选', value: display.nextActionText });
    }
    const noPlanReasonText = getReintegrationOutcomeNoPlanReason(display);
    if (noPlanReasonText) {
        rows.push({ label: '未进入规划原因', value: noPlanReasonText });
    }
    return rows;
}
export function formatReintegrationOutcomeNextActionText(summary) {
    if (!summary?.candidateTitle) {
        return null;
    }
    const suffix = [summary.candidatePriority, summary.candidateDue ? `due ${summary.candidateDue}` : null]
        .filter(Boolean)
        .join(' · ');
    return suffix ? `${summary.candidateTitle}（${suffix}）` : summary.candidateTitle;
}
export function getReintegrationOutcomeDisplaySummary(result, fallbackRecord) {
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
        noPlanReason: plannedActionCount > 0
            ? null
            : hasNextActionEvidence
                ? 'next_action_evidence_only'
                : suggestedActionKinds.length > 0
                    ? 'no_outcome_signal'
                    : 'no_suggested_actions',
    };
}
export function formatReintegrationNoPlanReason(reason) {
    return reason === 'next_action_evidence_only'
        ? '已有 next-action evidence，但尚未形成可规划动作'
        : reason === 'no_outcome_signal'
            ? '当前没有足够 outcome signal 进入可规划状态'
            : reason === 'no_suggested_actions'
                ? '该类回流当前不生成后续治理动作'
                : null;
}
export function getReintegrationReviewMessage(operation, display) {
    if (operation === 'reject') {
        return '已拒绝该回流记录';
    }
    if (!display) {
        return operation === 'accept' ? '已接受该回流记录' : '当前没有可规划的候选动作';
    }
    return operation === 'accept'
        ? getAcceptReintegrationMessageFromDisplaySummary(display)
        : getPlanReintegrationMessageFromDisplaySummary(display);
}
export function getAcceptReintegrationMessageFromDisplaySummary(display) {
    if (display.plannedActionCount) {
        return `已接受并自动规划 ${display.plannedActionCount} 条候选动作`;
    }
    const reasonText = formatReintegrationNoPlanReason(display.noPlanReason);
    if (display.hasNextActionEvidence) {
        return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}${display.nextActionText ? ` · 已记录 next-action evidence：${display.nextActionText}` : ' · 已记录 next-action evidence'}`;
    }
    return `已接受，但${reasonText ?? '当前没有可规划的候选动作'}`;
}
export function getAcceptReintegrationMessage(result, fallbackRecord) {
    return getAcceptReintegrationMessageFromDisplaySummary(getReintegrationOutcomeDisplaySummary(result, fallbackRecord));
}
export function getRejectReintegrationMessage() {
    return '已拒绝该回流记录';
}
export function getPlanReintegrationMessageFromDisplaySummary(display) {
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
export function getPlanReintegrationMessage(result, fallbackRecord) {
    return getPlanReintegrationMessageFromDisplaySummary(getReintegrationOutcomeDisplaySummary(result, fallbackRecord));
}
export function getReintegrationExtractTaskCount(record) {
    const evidence = record.evidence && typeof record.evidence === 'object'
        ? record.evidence
        : null;
    const count = evidence?.extractTaskCreated;
    return typeof count === 'number' ? count : null;
}
export function normalizeReintegrationNextActionCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const normalized = candidate;
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
export function pickReintegrationNextActionCandidate(candidates) {
    const priorityRank = {
        high: 0,
        medium: 1,
        low: 2,
    };
    const items = candidates.filter((item) => !!item);
    if (!items.length) {
        return null;
    }
    return [...items].sort((left, right) => {
        const priorityCompare = (priorityRank[left.priority] ?? 99)
            - (priorityRank[right.priority] ?? 99);
        if (priorityCompare !== 0) {
            return priorityCompare;
        }
        const leftDue = left.due ?? '9999-12-31';
        const rightDue = right.due ?? '9999-12-31';
        const dueCompare = leftDue.localeCompare(rightDue);
        if (dueCompare !== 0) {
            return dueCompare;
        }
        return left.filePath.localeCompare(right.filePath);
    })[0] ?? null;
}
export function getReintegrationNextActionCandidate(record) {
    const evidence = record.evidence && typeof record.evidence === 'object'
        ? record.evidence
        : null;
    return normalizeReintegrationNextActionCandidate(evidence?.nextActionCandidate);
}
export function getReintegrationExtractTaskItems(record) {
    const evidence = record.evidence && typeof record.evidence === 'object'
        ? record.evidence
        : null;
    const items = evidence?.extractTaskItems;
    return Array.isArray(items)
        ? items.filter((item) => !!item && typeof item === 'object' && typeof item.filePath === 'string')
        : [];
}
export function getReintegrationNextActionSummary(record) {
    const createdCount = getReintegrationExtractTaskCount(record);
    const candidate = getReintegrationNextActionCandidate(record);
    if (createdCount === null && !candidate) {
        return null;
    }
    return {
        createdCount,
        candidateTitle: candidate?.title ?? null,
        candidatePriority: candidate?.priority ?? null,
        candidateDue: candidate?.due ?? null,
        candidateOutputNoteId: candidate?.outputNoteId ?? null,
    };
}

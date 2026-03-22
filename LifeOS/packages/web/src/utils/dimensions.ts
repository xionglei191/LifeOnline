import type { Dimension } from '@lifeos/shared';

const FALLBACK_DIMENSION_LABEL = 'Inbox';
const FALLBACK_DIMENSION_COLOR = 'var(--signal)';

export const DIMENSION_LABELS: Record<Exclude<Dimension, '_inbox'>, string> = {
  health: '健康',
  career: '事业',
  finance: '财务',
  learning: '学习',
  relationship: '关系',
  life: '生活',
  hobby: '兴趣',
  growth: '成长',
};

export const SELECTABLE_DIMENSIONS = Object.entries(DIMENSION_LABELS).map(([value, label]) => ({
  value: value as Exclude<Dimension, '_inbox'>,
  label,
}));

export const DIMENSION_COLORS: Record<Exclude<Dimension, '_inbox'>, string> = {
  health: 'var(--dim-health)',
  career: 'var(--dim-career)',
  finance: 'var(--dim-finance)',
  learning: 'var(--dim-learning)',
  relationship: 'var(--dim-relationship)',
  life: 'var(--dim-life)',
  hobby: 'var(--dim-hobby)',
  growth: 'var(--dim-growth)',
};

export function getDimensionLabel(dimension: Dimension) {
  return dimension === '_inbox' ? FALLBACK_DIMENSION_LABEL : DIMENSION_LABELS[dimension];
}

export function getDimensionColor(dimension: Dimension) {
  return dimension === '_inbox' ? FALLBACK_DIMENSION_COLOR : DIMENSION_COLORS[dimension];
}

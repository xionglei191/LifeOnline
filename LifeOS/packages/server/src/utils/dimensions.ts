export const DIMENSION_DIRECTORY_BY_KEY = {
  health: '健康',
  career: '事业',
  finance: '财务',
  learning: '学习',
  relationship: '关系',
  life: '生活',
  hobby: '兴趣',
  growth: '成长',
} as const;

export const DIMENSION_DISPLAY_LABEL_BY_KEY = {
  health: '健康',
  career: '事业',
  finance: '财务',
  learning: '学习',
  relationship: '关系',
  life: '生活',
  hobby: '兴趣',
  growth: '成长',
} as const;

export const REPORT_DIMENSION_KEYS = Object.keys(DIMENSION_DISPLAY_LABEL_BY_KEY) as Array<keyof typeof DIMENSION_DISPLAY_LABEL_BY_KEY>;

export const DIMENSION_KEY_BY_DIRECTORY = {
  健康: 'health',
  事业: 'career',
  财务: 'finance',
  学习: 'learning',
  关系: 'relationship',
  生活: 'life',
  兴趣: 'hobby',
  成长: 'growth',
  _Inbox: '_inbox',
  _Daily: 'growth',
  _Weekly: 'growth',
} as const;

export function getDimensionDirectoryName(dimension: string): string | undefined {
  return DIMENSION_DIRECTORY_BY_KEY[dimension as keyof typeof DIMENSION_DIRECTORY_BY_KEY];
}

export function getDimensionDisplayLabel(dimension: string): string | undefined {
  return DIMENSION_DISPLAY_LABEL_BY_KEY[dimension as keyof typeof DIMENSION_DISPLAY_LABEL_BY_KEY];
}

export function getDimensionKeyForDirectory(directoryName: string): string | undefined {
  return DIMENSION_KEY_BY_DIRECTORY[directoryName as keyof typeof DIMENSION_KEY_BY_DIRECTORY];
}

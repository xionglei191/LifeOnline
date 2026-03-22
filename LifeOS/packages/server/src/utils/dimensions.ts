import { DIMENSION_DIRECTORY_NAMES, DIMENSION_KEY_BY_DIRECTORY, DIMENSION_LABELS, SELECTABLE_DIMENSIONS } from '@lifeos/shared';

export const DIMENSION_DIRECTORY_BY_KEY = DIMENSION_DIRECTORY_NAMES;
export const DIMENSION_DISPLAY_LABEL_BY_KEY = DIMENSION_LABELS;
export const REPORT_DIMENSION_KEYS = SELECTABLE_DIMENSIONS;

export function getDimensionDirectoryName(dimension: string): string | undefined {
  return DIMENSION_DIRECTORY_BY_KEY[dimension as keyof typeof DIMENSION_DIRECTORY_BY_KEY];
}

export function getDimensionDisplayLabel(dimension: string): string | undefined {
  return DIMENSION_DISPLAY_LABEL_BY_KEY[dimension as keyof typeof DIMENSION_DISPLAY_LABEL_BY_KEY];
}

export function getDimensionKeyForDirectory(directoryName: string): string | undefined {
  return DIMENSION_KEY_BY_DIRECTORY[directoryName as keyof typeof DIMENSION_KEY_BY_DIRECTORY];
}

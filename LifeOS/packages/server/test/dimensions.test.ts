import test from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSION_DIRECTORY_NAMES, DIMENSION_LABELS, SELECTABLE_DIMENSIONS } from '@lifeos/shared';
import { getDimensionDirectoryName, getDimensionDisplayLabel, getDimensionKeyForDirectory, REPORT_DIMENSION_KEYS } from '../src/utils/dimensions.js';

test('shared and server dimension helpers stay aligned', () => {
  assert.deepEqual(REPORT_DIMENSION_KEYS, SELECTABLE_DIMENSIONS);
  assert.deepEqual(DIMENSION_DIRECTORY_NAMES, DIMENSION_LABELS);

  for (const dimension of SELECTABLE_DIMENSIONS) {
    assert.equal(getDimensionDirectoryName(dimension), DIMENSION_DIRECTORY_NAMES[dimension]);
    assert.equal(getDimensionDisplayLabel(dimension), DIMENSION_LABELS[dimension]);
  }

  assert.equal(getDimensionKeyForDirectory('健康'), 'health');
  assert.equal(getDimensionKeyForDirectory('_Inbox'), '_inbox');
  assert.equal(getDimensionKeyForDirectory('_Daily'), 'growth');
  assert.equal(getDimensionKeyForDirectory('_Weekly'), 'growth');
  assert.equal(getDimensionKeyForDirectory('成长'), 'growth');
});

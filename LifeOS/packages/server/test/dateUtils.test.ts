import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalDate, getMonthDateRange, getMonthDateStrings, getTodayDateString, getWeekEndDateString, getWeekStartDateString } from '../src/utils/date.js';

test('date helpers format local dates without UTC rollover', () => {
  const date = new Date(2026, 2, 22, 23, 45, 0);
  assert.equal(formatLocalDate(date), '2026-03-22');
  assert.equal(getTodayDateString(date), '2026-03-22');
});

test('date helpers use Monday as the week start boundary', () => {
  const sunday = new Date(2026, 2, 22, 12, 0, 0);
  const monday = new Date(2026, 2, 23, 12, 0, 0);

  assert.equal(getWeekStartDateString(sunday), '2026-03-16');
  assert.equal(getWeekEndDateString('2026-03-16'), '2026-03-22');
  assert.equal(getWeekStartDateString(monday), '2026-03-23');
});

test('date helpers build stable month ranges and day lists', () => {
  assert.deepEqual(getMonthDateRange(2026, 3), {
    start: '2026-03-01',
    end: '2026-03-31',
  });

  const marchDays = getMonthDateStrings(2026, 3);
  assert.equal(marchDays[0], '2026-03-01');
  assert.equal(marchDays[30], '2026-03-31');
  assert.equal(marchDays.length, 31);
});

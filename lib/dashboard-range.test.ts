import assert from 'node:assert/strict';
import test from 'node:test';

import { getDashboardDefaultDateRange, resolveDashboardDefaultRange } from './dashboard-range';

const NOW = new Date('2026-05-06T12:00:00Z');

test('resolveDashboardDefaultRange accepts supported values', () => {
  assert.equal(resolveDashboardDefaultRange('currentMonth'), 'currentMonth');
  assert.equal(resolveDashboardDefaultRange('last30Days'), 'last30Days');
  assert.equal(resolveDashboardDefaultRange('currentYear'), 'currentYear');
  assert.equal(resolveDashboardDefaultRange('allTime'), 'allTime');
});

test('resolveDashboardDefaultRange falls back to current month', () => {
  assert.equal(resolveDashboardDefaultRange('bad'), 'currentMonth');
  assert.equal(resolveDashboardDefaultRange(null), 'currentMonth');
});

test('getDashboardDefaultDateRange calculates presets', () => {
  assert.deepEqual(getDashboardDefaultDateRange('currentMonth', null, NOW), {
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });
  assert.deepEqual(getDashboardDefaultDateRange('currentYear', null, NOW), {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });
  assert.deepEqual(getDashboardDefaultDateRange('last30Days', { min: '2025-01-01', max: '2025-07-31' }, NOW), {
    startDate: '2025-07-02',
    endDate: '2025-07-31',
  });
  assert.deepEqual(getDashboardDefaultDateRange('allTime', { min: '2024-01-02', max: '2025-07-31' }, NOW), {
    startDate: '2024-01-02',
    endDate: '2025-07-31',
  });
});

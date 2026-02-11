import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatterns, findMatchingPattern, matchTransaction } from './engine';
import type { PatternItem } from '../types';
import type { TransactionRow } from '../../upload/types';

function tx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    bookingDate: '2026-02-01',
    amount: '-12.34',
    description: 'Coffee Shop Downtown',
    rawRow: {},
    ...overrides,
  };
}

test('matchTransaction prioritizes higher priority patterns', () => {
  const patterns: PatternItem[] = [
    { id: 'low', matchString: 'coffee', categoryId: 'cat-a', matchType: 'contains', priority: 10 },
    { id: 'high', matchString: 'coffee shop', categoryId: 'cat-b', matchType: 'contains', priority: 80 },
  ];

  const result = matchTransaction(tx(), patterns);
  assert.equal(result, 'cat-b');
});

test('findMatchingPattern supports regex matching', () => {
  const patterns: PatternItem[] = [
    { id: 'regex', matchString: '^coffee\\s+shop', categoryId: 'cat-coffee', matchType: 'regex', priority: 50 },
  ];

  const result = findMatchingPattern(tx(), patterns);
  assert.equal(result?.id, 'regex');
});

test('applyPatterns only fills missing categoryId values', () => {
  const patterns: PatternItem[] = [
    { id: 'contains', matchString: 'coffee', categoryId: 'cat-coffee', matchType: 'contains', priority: 50 },
  ];

  const rows: TransactionRow[] = [
    tx({ description: 'Coffee Beans Store' }),
    tx({ description: 'Coffee Beans Store', categoryId: 'already-set' }),
  ];

  const result = applyPatterns(rows, patterns);
  assert.equal(result[0].categoryId, 'cat-coffee');
  assert.equal(result[1].categoryId, 'already-set');
});


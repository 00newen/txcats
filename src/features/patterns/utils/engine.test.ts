import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatterns, findMatchingPattern, matchTransaction, matchesPattern } from './engine';
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
    { id: 'low', categoryId: 'cat-a', priority: 10, conditionMode: 'all', conditions: [{ type: 'text', field: 'description', operator: 'contains', value: 'coffee' }] },
    { id: 'high', categoryId: 'cat-b', priority: 80, conditionMode: 'all', conditions: [{ type: 'text', field: 'description', operator: 'contains', value: 'coffee shop' }] },
  ];

  const result = matchTransaction(tx(), patterns);
  assert.equal(result, 'cat-b');
});

test('findMatchingPattern supports regex matching', () => {
  const patterns: PatternItem[] = [
    { id: 'regex', categoryId: 'cat-coffee', priority: 50, conditionMode: 'all', conditions: [{ type: 'text', field: 'description', operator: 'regex', value: '^coffee\\s+shop' }] },
  ];

  const result = findMatchingPattern(tx(), patterns);
  assert.equal(result?.id, 'regex');
});

test('applyPatterns only fills missing categoryId values', () => {
  const patterns: PatternItem[] = [
    { id: 'contains', categoryId: 'cat-coffee', priority: 50, conditionMode: 'all', conditions: [{ type: 'text', field: 'description', operator: 'contains', value: 'coffee' }] },
  ];

  const rows: TransactionRow[] = [
    tx({ description: 'Coffee Beans Store' }),
    tx({ description: 'Coffee Beans Store', categoryId: 'already-set' }),
  ];

  const result = applyPatterns(rows, patterns);
  assert.equal(result[0].categoryId, 'cat-coffee');
  assert.equal(result[1].categoryId, 'already-set');
});

test('matchesPattern handles invalid regex safely', () => {
  const pattern: PatternItem = {
    id: 'regex',
    categoryId: 'cat-bad',
    priority: 50,
    conditionMode: 'all',
    conditions: [{ type: 'text', field: 'description', operator: 'regex', value: '[' }],
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(matchesPattern(tx(), pattern), false);
    assert.equal(matchTransaction(tx(), [pattern]), undefined);
  } finally {
    console.error = originalConsoleError;
  }
});

test('matchesPattern can target sender and recipient independently', () => {
  const salaryTx = tx({ description: '', merchantOrName: 'Transfer', sender: 'Acme Payroll BV', recipient: 'Main Checking' });
  const senderPattern: PatternItem = {
    id: 'sender',
    categoryId: 'salary',
    priority: 50,
    conditionMode: 'all',
    conditions: [{ type: 'text', field: 'sender', operator: 'contains', value: 'acme payroll' }],
  };
  const recipientPattern: PatternItem = {
    id: 'recipient',
    categoryId: 'inbound',
    priority: 40,
    conditionMode: 'all',
    conditions: [{ type: 'text', field: 'recipient', operator: 'exact', value: 'main checking' }],
  };

  assert.equal(matchesPattern(salaryTx, senderPattern), true);
  assert.equal(matchesPattern(salaryTx, recipientPattern), true);
  assert.equal(
    matchesPattern(salaryTx, {
      ...senderPattern,
      conditions: [{ type: 'text', field: 'description', operator: 'contains', value: 'acme payroll' }],
    }),
    false,
  );
});

test('matchesPattern supports migrated multi-condition patterns', () => {
  const salaryTx = tx({ description: '', merchantOrName: 'Transfer', sender: 'Acme Payroll BV', recipient: 'Main Checking' });
  const migratedPattern: PatternItem = {
    id: 'migrated',
    categoryId: 'salary',
    priority: 100,
    conditionMode: 'all',
    conditions: [
      { type: 'text', field: 'sender', operator: 'contains', value: 'acme payroll' },
      { type: 'text', field: 'recipient', operator: 'exact', value: 'Main Checking' },
    ],
  };

  assert.equal(matchesPattern(salaryTx, migratedPattern), true);
  assert.equal(matchesPattern(tx({ sender: 'Acme Payroll BV', recipient: 'Other Account' }), migratedPattern), false);
});

test('matchesPattern supports amount comparisons', () => {
  const amountTx = tx({ amount: '2750.00', description: 'Salary' });
  const lessThanPattern: PatternItem = {
    id: 'lt',
    categoryId: 'misc',
    priority: 10,
    conditionMode: 'all',
    conditions: [{ type: 'amount', field: 'amount', operator: 'lt', value: '3000' }],
  };
  const exactPattern: PatternItem = {
    id: 'eq',
    categoryId: 'salary',
    priority: 10,
    conditionMode: 'all',
    conditions: [{ type: 'amount', field: 'amount', operator: 'eq', value: '2750' }],
  };
  const betweenPattern: PatternItem = {
    id: 'between',
    categoryId: 'salary',
    priority: 10,
    conditionMode: 'all',
    conditions: [{ type: 'amount', field: 'amount', operator: 'between', value: '2500', secondaryValue: '3000' }],
  };

  assert.equal(matchesPattern(amountTx, lessThanPattern), true);
  assert.equal(matchesPattern(amountTx, exactPattern), true);
  assert.equal(matchesPattern(amountTx, betweenPattern), true);
  assert.equal(
    matchesPattern(amountTx, {
      ...betweenPattern,
      conditions: [{ type: 'amount', field: 'amount', operator: 'between', value: '3001', secondaryValue: '4000' }],
    }),
    false,
  );
});

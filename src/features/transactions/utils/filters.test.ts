import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTransactionQueryKey, filterTransactions, isDateOnly, normalizeCategoryFilter, normalizeDateRange } from './filters'
import type { TransactionRow } from '@/features/upload/types'

const rows: Array<TransactionRow & { id: string; uniqueId: string }> = [
  {
    id: 'a',
    uniqueId: 'a',
    bookingDate: '2026-02-01',
    amount: '-10.00',
    description: 'Coffee',
    rawRow: {},
  },
  {
    id: 'b',
    uniqueId: 'b',
    bookingDate: '2026-02-10',
    amount: '-25.00',
    description: 'Groceries',
    categoryId: 'food',
    rawRow: {},
  },
]

test('isDateOnly validates canonical date strings', () => {
  assert.equal(isDateOnly('2026-02-01'), true)
  assert.equal(isDateOnly('02/01/2026'), false)
})

test('normalizeDateRange swaps reversed bounds', () => {
  assert.deepEqual(normalizeDateRange('2026-02-10', '2026-02-01'), {
    startDate: '2026-02-01',
    endDate: '2026-02-10',
  })
})

test('normalizeCategoryFilter falls back to all', () => {
  assert.equal(normalizeCategoryFilter('   '), 'all')
  assert.equal(normalizeCategoryFilter(' food '), 'food')
})

test('filterTransactions preserves extended row shape', () => {
  const filtered = filterTransactions(rows, {
    categoryFilter: 'uncategorized',
    startDate: '2026-02-01',
    endDate: '2026-02-05',
  })

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, 'a')
  assert.equal(filtered[0].uniqueId, 'a')
})

test('buildTransactionQueryKey composes stable lookup keys', () => {
  assert.equal(
    buildTransactionQueryKey({
      txId: 'tx-1',
      txDate: '2026-02-01',
      txAmount: '-10.00',
      txDesc: 'Coffee',
    }),
    'tx-1|2026-02-01|-10.00|Coffee',
  )
})

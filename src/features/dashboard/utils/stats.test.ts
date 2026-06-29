import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChartData, buildExpensesByCategory, calculateTransactionStats } from './stats'
import type { CategoryItem } from '@/features/categories/types'
import type { TransactionRow } from '@/features/upload/types'

const categories: CategoryItem[] = [
  { id: 'food', name: 'Food', color: '#000', icon: 'utensils' },
  { id: 'salary', name: 'Salary', color: '#111', icon: 'wallet' },
]

const transactions: TransactionRow[] = [
  { bookingDate: '2026-02-01', amount: '-10.00', description: 'Coffee', categoryId: 'food', rawRow: {} },
  { bookingDate: '2026-02-01', amount: '1000.00', description: 'Payroll', categoryId: 'salary', rawRow: {} },
  { bookingDate: '2026-02-02', amount: '-15.50', description: 'Lunch', categoryId: 'food', rawRow: {} },
]

test('calculateTransactionStats aggregates filtered and total values', () => {
  const stats = calculateTransactionStats(transactions, categories, '2026-02-01', '2026-02-01')

  assert.equal(stats.totalTransactions, 3)
  assert.equal(stats.totalCategories, 2)
  assert.equal(stats.totalIncome, 1000)
  assert.equal(stats.totalExpenses, 25.5)
  assert.equal(stats.filteredCount, 2)
  assert.equal(stats.income, 1000)
  assert.equal(stats.expenses, 10)
  assert.equal(stats.net, 990)
})

test('buildChartData fills missing days in the selected range', () => {
  const chart = buildChartData(transactions, '2026-02-01', '2026-02-03')

  assert.equal(chart.length, 3)
  assert.deepEqual(chart[1], { date: 'Feb 02', income: 0, expenses: 15.5 })
  assert.deepEqual(chart[2], { date: 'Feb 03', income: 0, expenses: 0 })
})

test('buildExpensesByCategory groups uncategorized and category totals', () => {
  const slices = buildExpensesByCategory(
    [...transactions, { bookingDate: '2026-02-02', amount: '-5.00', description: 'Cash', rawRow: {} }],
    categories,
    '2026-02-01',
    '2026-02-03',
  )

  assert.equal(slices[0].key, 'food')
  assert.equal(slices[0].value, 25.5)
  assert.equal(slices[1].key, '__uncategorized__')
  assert.equal(slices[1].name, 'Uncategorized')
})

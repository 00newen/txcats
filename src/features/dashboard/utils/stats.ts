import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { parseAmount } from '@/lib/amount'
import type { CategoryItem } from '@/features/categories/types'
import type { TransactionRow } from '@/features/upload/types'

export type ExpenseCategorySlice = { key: string; name: string; value: number }

export function filterTransactionsByDateRange<T extends TransactionRow>(
  transactions: T[],
  startDate: string,
  endDate: string,
): T[] {
  return transactions.filter((transaction) => transaction.bookingDate >= startDate && transaction.bookingDate <= endDate)
}

export function calculateTransactionStats(
  transactions: TransactionRow[],
  categories: CategoryItem[],
  startDate: string,
  endDate: string,
) {
  const filtered = filterTransactionsByDateRange(transactions, startDate, endDate)

  const totalIncome = transactions.reduce((sum, transaction) => {
    const amount = parseAmount(transaction.amount)
    return Number.isNaN(amount) || amount <= 0 ? sum : sum + amount
  }, 0)

  const totalExpenses = transactions.reduce((sum, transaction) => {
    const amount = parseAmount(transaction.amount)
    return Number.isNaN(amount) || amount >= 0 ? sum : sum + Math.abs(amount)
  }, 0)

  const income = filtered.reduce((sum, transaction) => {
    const amount = parseAmount(transaction.amount)
    return Number.isNaN(amount) || amount <= 0 ? sum : sum + amount
  }, 0)

  const expenses = filtered.reduce((sum, transaction) => {
    const amount = parseAmount(transaction.amount)
    return Number.isNaN(amount) || amount >= 0 ? sum : sum + Math.abs(amount)
  }, 0)

  return {
    totalTransactions: transactions.length,
    totalCategories: categories.length,
    totalIncome,
    totalExpenses,
    filteredCount: filtered.length,
    income,
    expenses,
    net: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
  }
}

export function buildChartData(transactions: TransactionRow[], startDate: string, endDate: string) {
  const grouped = filterTransactionsByDateRange(transactions, startDate, endDate).reduce(
    (accumulator, transaction) => {
      const date = transaction.bookingDate
      const amount = parseAmount(transaction.amount)
      if (Number.isNaN(amount)) {
        return accumulator
      }

      if (!accumulator[date]) {
        accumulator[date] = { income: 0, expenses: 0 }
      }

      if (amount > 0) {
        accumulator[date].income += amount
      } else {
        accumulator[date].expenses += Math.abs(amount)
      }

      return accumulator
    },
    {} as Record<string, { income: number; expenses: number }>,
  )

  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((day) => {
    const date = format(day, 'yyyy-MM-dd')
    const data = grouped[date] || { income: 0, expenses: 0 }

    return {
      date: format(day, 'MMM dd'),
      income: Number.parseFloat(data.income.toFixed(2)),
      expenses: Number.parseFloat(data.expenses.toFixed(2)),
    }
  })
}

export function buildExpensesByCategory(
  transactions: TransactionRow[],
  categories: CategoryItem[],
  startDate: string,
  endDate: string,
): ExpenseCategorySlice[] {
  const grouped = filterTransactionsByDateRange(transactions, startDate, endDate).reduce(
    (accumulator, transaction) => {
      const amount = parseAmount(transaction.amount)
      if (Number.isNaN(amount) || amount >= 0) {
        return accumulator
      }

      const key = transaction.categoryId || '__uncategorized__'
      const name = transaction.categoryId
        ? categories.find((category) => category.id === transaction.categoryId)?.name || 'Unknown'
        : 'Uncategorized'

      if (!accumulator[key]) {
        accumulator[key] = { key, name, value: 0 }
      }

      accumulator[key].value += Math.abs(amount)
      return accumulator
    },
    {} as Record<string, ExpenseCategorySlice>,
  )

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      value: Number.parseFloat(item.value.toFixed(2)),
    }))
    .sort((left, right) => right.value - left.value)
}

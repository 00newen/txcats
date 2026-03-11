import type { TransactionRow } from '@/features/upload/types'

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function normalizeDateRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (!startDate || !endDate) {
    return { startDate, endDate }
  }

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate }
}

export function normalizeCategoryFilter(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed : 'all'
}

export function filterTransactions<T extends TransactionRow>(
  transactions: T[],
  filters: { categoryFilter?: string; startDate?: string; endDate?: string },
): T[] {
  return transactions.filter((transaction) => {
    if (filters.categoryFilter && filters.categoryFilter !== 'all') {
      if (filters.categoryFilter === 'uncategorized' && transaction.categoryId) {
        return false
      }

      if (
        filters.categoryFilter !== 'uncategorized' &&
        transaction.categoryId !== filters.categoryFilter
      ) {
        return false
      }
    }

    if (filters.startDate && transaction.bookingDate < filters.startDate) {
      return false
    }

    if (filters.endDate && transaction.bookingDate > filters.endDate) {
      return false
    }

    return true
  })
}

export function buildTransactionQueryKey(params: {
  txId?: string
  txDate?: string
  txAmount?: string
  txDesc?: string
}): string {
  return `${params.txId || ''}|${params.txDate || ''}|${params.txAmount || ''}|${params.txDesc || ''}`
}

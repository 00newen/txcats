import type { CategoryItem } from '@/features/categories/types'
import type { PatternItem } from '@/features/patterns/types'
import type { MappingProfile } from '@/features/upload/types'
import { fetchAccounts } from '@/server/actions/accounts'
import {
  decryptAccounts,
  decryptCategories,
  decryptMappingProfiles,
  decryptPatterns,
  decryptTransactions,
  type AccountItem,
  type DecryptResult,
  type TransactionItem,
} from '@/lib/vault/resources'
import { fetchCategories } from '@/server/actions/categories'
import { fetchMappingProfiles } from '@/server/actions/mappings'
import { fetchPatterns } from '@/server/actions/patterns'
import { fetchTransactions } from '@/server/actions/transactions'

export async function loadAccounts(dek: CryptoKey): Promise<DecryptResult<AccountItem>> {
  const response = await fetchAccounts()
  if (!response.success) {
    throw new Error(response.error)
  }

  const result = await decryptAccounts(response.data.items, dek)
  result.items.sort((left, right) => left.name.localeCompare(right.name))
  return result
}

export async function loadCategories(dek: CryptoKey): Promise<DecryptResult<CategoryItem>> {
  const response = await fetchCategories()
  if (!response.success) {
    throw new Error(response.error)
  }

  const result = await decryptCategories(response.data.items, dek)
  result.items.sort((left, right) => left.name.localeCompare(right.name))
  return result
}

export async function loadPatterns(dek: CryptoKey): Promise<DecryptResult<PatternItem>> {
  const response = await fetchPatterns()
  if (!response.success) {
    throw new Error(response.error)
  }

  return decryptPatterns(response.data.items, dek)
}

export async function loadMappingProfiles(dek: CryptoKey): Promise<DecryptResult<MappingProfile>> {
  const response = await fetchMappingProfiles()
  if (!response.success) {
    throw new Error(response.error)
  }

  return decryptMappingProfiles(response.data.items, dek)
}

export async function loadTransactions(
  dek: CryptoKey,
  options?: { uncategorizedOnly?: boolean },
): Promise<DecryptResult<TransactionItem>> {
  const response = await fetchTransactions()
  if (!response.success) {
    throw new Error(response.error)
  }

  const result = await decryptTransactions(response.data.items, dek)
  result.items.sort((left, right) => new Date(right.bookingDate).getTime() - new Date(left.bookingDate).getTime())

  if (options?.uncategorizedOnly) {
    result.items = result.items.filter((item) => !item.categoryId)
  }

  return result
}

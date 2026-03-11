import type { VaultItem } from '@/types/database'
import { decryptData, encryptData } from '@/crypto/encryption'
import type { CategoryItem } from '@/features/categories/types'
import type { PatternItem } from '@/features/patterns/types'
import type { MappingProfile, TransactionRow } from '@/features/upload/types'
import type { EncryptedPayload } from '@/server/actions/vaultItems'

export type VaultResourceType = 'category' | 'pattern' | 'transaction' | 'mapping_profile'

export type TransactionItem = TransactionRow & { id: string; uniqueId: string }

export type DecryptResult<T> = {
  items: T[]
  failureCount: number
}

type ResourceDecryptor = (
  ciphertextBase64: string,
  ivBase64: string,
  dek: CryptoKey,
  aad?: Uint8Array,
) => Promise<unknown>

function encodeBytesAsBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

export function encodeResourceAAD(resourceType: VaultResourceType): Uint8Array {
  return new TextEncoder().encode(resourceType)
}

export function decodeResourceAAD(aadBase64: string): Uint8Array {
  return new Uint8Array(
    atob(aadBase64)
      .split('')
      .map((char) => char.charCodeAt(0)),
  )
}

export async function encryptResourceItem<T>(
  resourceType: VaultResourceType,
  item: T,
  dek: CryptoKey,
  uniqueId: string,
): Promise<EncryptedPayload> {
  const aad = encodeResourceAAD(resourceType)
  const { ciphertextBase64, ivBase64 } = await encryptData(item, dek, aad)

  return {
    uniqueId,
    ciphertextBase64,
    ivBase64,
    aadBase64: encodeBytesAsBase64(aad),
  }
}

export async function decryptResourceItems<T>(
  items: VaultItem[],
  dek: CryptoKey,
  getAad: (item: VaultItem) => Uint8Array,
  mapItem: (plaintext: T, item: VaultItem) => T,
  decryptor: ResourceDecryptor = decryptData,
): Promise<DecryptResult<T>> {
  let failureCount = 0
  const decryptedItems: T[] = []

  for (const item of items) {
    try {
      const plaintext = (await decryptor(
        item.ciphertextBase64,
        item.ivBase64,
        dek,
        getAad(item),
      )) as T
      decryptedItems.push(mapItem(plaintext, item))
    } catch {
      failureCount += 1
    }
  }

  return {
    items: decryptedItems,
    failureCount,
  }
}

export async function decryptCategories(items: VaultItem[], dek: CryptoKey): Promise<DecryptResult<CategoryItem>> {
  return decryptResourceItems<CategoryItem>(items, dek, () => encodeResourceAAD('category'), (item) => item)
}

export async function decryptPatterns(items: VaultItem[], dek: CryptoKey): Promise<DecryptResult<PatternItem>> {
  return decryptResourceItems<PatternItem>(items, dek, () => encodeResourceAAD('pattern'), (item) => item)
}

export async function decryptMappingProfiles(
  items: VaultItem[],
  dek: CryptoKey,
): Promise<DecryptResult<MappingProfile>> {
  return decryptResourceItems<MappingProfile>(items, dek, () => encodeResourceAAD('mapping_profile'), (item) => item)
}

export async function decryptTransactions(
  items: VaultItem[],
  dek: CryptoKey,
): Promise<DecryptResult<TransactionItem>> {
  return decryptResourceItems<TransactionItem>(
    items,
    dek,
    (item) => decodeResourceAAD(item.aadBase64),
    (plaintext, item) => ({
      ...plaintext,
      id: item.id,
      uniqueId: item.uniqueId || '',
    }),
  )
}

export function dedupeEncryptedPayloads(payloads: EncryptedPayload[]): EncryptedPayload[] {
  return Array.from(new Map(payloads.map((payload) => [payload.uniqueId, payload])).values())
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeResourceAAD, decryptResourceItems, dedupeEncryptedPayloads, encodeResourceAAD } from './resources'
import type { VaultItem } from '@/types/database'

const encoder = new TextEncoder()
const fakeKey = {} as CryptoKey

const vaultItems: VaultItem[] = [
  {
    id: '1',
    vaultId: 'vault',
    resourceType: 'transaction',
    uniqueId: 'tx-1',
    ciphertextBase64: 'cipher-a',
    ivBase64: 'iv-a',
    aadBase64: btoa('transaction'),
    version: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    vaultId: 'vault',
    resourceType: 'transaction',
    uniqueId: 'tx-2',
    ciphertextBase64: 'cipher-b',
    ivBase64: 'iv-b',
    aadBase64: btoa('transaction'),
    version: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

test('encode/decode resource aad round-trips', () => {
  const encoded = encodeResourceAAD('pattern')
  assert.deepEqual(decodeResourceAAD(btoa('pattern')), encoded)
})

test('decryptResourceItems skips failures and keeps successes', async () => {
  const result = await decryptResourceItems<{ description: string }>(
    vaultItems,
    fakeKey,
    () => encoder.encode('transaction'),
    (plaintext, item) => ({ ...plaintext, description: `${plaintext.description}:${item.uniqueId}` }),
    async (ciphertextBase64) => {
      if (ciphertextBase64 === 'cipher-b') {
        throw new Error('boom')
      }

      return { description: 'Coffee' }
    },
  )

  assert.equal(result.failureCount, 1)
  assert.deepEqual(result.items, [{ description: 'Coffee:tx-1' }])
})

test('dedupeEncryptedPayloads keeps the last payload per unique id', () => {
  const deduped = dedupeEncryptedPayloads([
    { uniqueId: 'a', ciphertextBase64: '1', ivBase64: '1', aadBase64: '1' },
    { uniqueId: 'a', ciphertextBase64: '2', ivBase64: '2', aadBase64: '2' },
    { uniqueId: 'b', ciphertextBase64: '3', ivBase64: '3', aadBase64: '3' },
  ])

  assert.deepEqual(deduped, [
    { uniqueId: 'a', ciphertextBase64: '2', ivBase64: '2', aadBase64: '2' },
    { uniqueId: 'b', ciphertextBase64: '3', ivBase64: '3', aadBase64: '3' },
  ])
})

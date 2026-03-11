'use server';

import { createVaultItemsBulk } from '@/db/queries/vaultItems';
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { requirePrimaryVault } from '@/server/actions/shared';

export type EncryptedPayload = {
  uniqueId: string; // Deterministic ID for deduplication
  ciphertextBase64: string;
  ivBase64: string;
  aadBase64: string; // Associated Data (usually also contains version/type info unencrypted context)
};

export async function saveEncryptedItems(
  resourceType: string,
  payloads: EncryptedPayload[],
  upsertMode: boolean = false
) : Promise<ActionResult<{ count: number }>> {
  const vault = await requirePrimaryVault();
  if (!vault.success) return fail(vault.code, vault.error);

  const itemsToInsert = payloads.map(p => ({
    vaultId: vault.data.vaultId,
    uniqueId: p.uniqueId,
    resourceType: resourceType,
    ciphertextBase64: p.ciphertextBase64,
    ivBase64: p.ivBase64,
    aadBase64: p.aadBase64
  }));

  const BATCH_SIZE = 500;
  let insertedCount = 0;
  
  for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
     const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
     const inserted = await createVaultItemsBulk(batch, upsertMode);
     insertedCount += inserted.length;
  }

  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  revalidatePath('/categories');
  
  return ok({ count: insertedCount });
}

/**
 * @deprecated Use saveEncryptedItems('transaction', ...) instead
 */
export async function saveEncryptedTransactions(payloads: EncryptedPayload[]) {
    return saveEncryptedItems('transaction', payloads);
}

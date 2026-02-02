'use server';

import { auth } from '@clerk/nextjs/server';
import { getVaultsByUserId } from '@/src/db/queries/vaults';
import { createVaultItemsBulk } from '@/src/db/queries/vaultItems';
import { revalidatePath } from 'next/cache';

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
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    throw new Error('No vault found. Please complete setup.');
  }
  const primaryVault = vaults[0];

  const itemsToInsert = payloads.map(p => ({
    vaultId: primaryVault.id,
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
  
  return { success: true, count: insertedCount };
}

/**
 * @deprecated Use saveEncryptedItems('transaction', ...) instead
 */
export async function saveEncryptedTransactions(payloads: EncryptedPayload[]) {
    return saveEncryptedItems('transaction', payloads);
}

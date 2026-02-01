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

export async function saveEncryptedTransactions(payloads: EncryptedPayload[]) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 1. Get the user's primary vault
  // For V1, we assume the user has at least one vault created during setup.
  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    throw new Error('No vault found. Please complete setup.');
  }
  const primaryVault = vaults[0];

  // 2. Prepare items for bulk insert
  // We expect the client to provide a deterministic uniqueId
  const itemsToInsert = payloads.map(p => ({
    vaultId: primaryVault.id,
    uniqueId: p.uniqueId,
    resourceType: 'transaction',
    ciphertextBase64: p.ciphertextBase64,
    ivBase64: p.ivBase64,
    aadBase64: p.aadBase64
  }));

  // 3. Batch insert with ON CONFLICT DO NOTHING (Deduplication)
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  
  for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
     const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
     // Note: we need to update createVaultItemsBulk to handle uniqueId and ON CONFLICT
     const inserted = await createVaultItemsBulk(batch);
     insertedCount += inserted.length;
  }

  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  
  return { success: true, count: insertedCount };
}

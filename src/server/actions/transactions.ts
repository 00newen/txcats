'use server';

import { auth } from '@clerk/nextjs/server';
import { getVaultsByUserId } from '@/src/db/queries/vaults';
import { getVaultItems, createVaultItemsBulk } from '@/src/db/queries/vaultItems';
import { EncryptedPayload } from '@/src/server/actions/vaultItems'; // reuse type
import { revalidatePath } from 'next/cache';

export async function fetchTransactions() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  // Get primary vault
  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    return { success: false, error: 'No vault found' };
  }
  const primaryVault = vaults[0];

  const items = await getVaultItems(primaryVault.id, 'transaction');

  return { success: true, items };
}

export async function updateEncryptedItem(
    resourceType: string,
    payload: EncryptedPayload
) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
  
    const vaults = await getVaultsByUserId(userId);
    if (!vaults || vaults.length === 0) throw new Error('No vault');
    const primaryVault = vaults[0];

    // Reuse createVaultItemsBulk with upsertMode=true
    await createVaultItemsBulk([{
        vaultId: primaryVault.id,
        uniqueId: payload.uniqueId,
        resourceType: resourceType,
        ciphertextBase64: payload.ciphertextBase64,
        ivBase64: payload.ivBase64,
        aadBase64: payload.aadBase64
    }], true); // true = upsertMode

    revalidatePath('/transactions');
    return { success: true };
}

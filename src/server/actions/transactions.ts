'use server';

import { auth } from '@clerk/nextjs/server';
import { getVaultsByUserId } from '@/src/db/queries/vaults';
import { getVaultItems } from '@/src/db/queries/vaultItems';

export async function fetchTransactions() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  // Get primary vault
  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    return { success: false, error: 'No vault found' };
  }
  const primaryVault = vaults[0];

  // Get encrypted items
  // Ideally, we might want pagination at DB level later, but for V1 we fetch all for this resource type
  const items = await getVaultItems(primaryVault.id, 'transaction');

  return { success: true, items };
}

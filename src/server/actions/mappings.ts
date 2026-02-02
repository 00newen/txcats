'use server';

import { auth } from '@clerk/nextjs/server';
import { getVaultsByUserId } from '@/src/db/queries/vaults';
import { getVaultItems } from '@/src/db/queries/vaultItems';

export async function fetchMappingProfiles() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    return { success: false, error: 'No vault found' };
  }
  const primaryVault = vaults[0];

  const items = await getVaultItems(primaryVault.id, 'mapping_profile');

  return { success: true, items };
}

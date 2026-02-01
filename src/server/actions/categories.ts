'use server';

import { auth } from '@clerk/nextjs/server';
import { getVaultsByUserId } from '@/src/db/queries/vaults';
import { getVaultItems } from '@/src/db/queries/vaultItems';
import { db } from '@/src/db';
import { vaultItems } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function fetchCategories() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const vaults = await getVaultsByUserId(userId);
  if (!vaults || vaults.length === 0) {
    return { success: false, error: 'No vault' };
  }
  const primaryVault = vaults[0];

  const items = await getVaultItems(primaryVault.id, 'category');
  return { success: true, items };
}

export async function deleteCategory(uniqueId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false };

    const vaults = await getVaultsByUserId(userId);
    if (!vaults || vaults.length === 0) return { success: false };
    const primaryVault = vaults[0];

    // We can delete by uniqueId and vaultId without needing decryption
    await db.delete(vaultItems).where(
        and(
            eq(vaultItems.vaultId, primaryVault.id),
            eq(vaultItems.resourceType, 'category'),
            eq(vaultItems.uniqueId, uniqueId)
        )
    );

    revalidatePath('/categories');
    return { success: true };
}

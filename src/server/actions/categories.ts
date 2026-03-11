'use server';

import { getVaultItems } from '@/db/queries/vaultItems';
import { db } from '@/db';
import { vaultItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { requirePrimaryVault } from '@/server/actions/shared';
import type { VaultItem } from '@/types/database';

export async function fetchCategories(): Promise<ActionResult<{ items: VaultItem[] }>> {
  const vault = await requirePrimaryVault();
  if (!vault.success) return vault;

  const items = await getVaultItems(vault.data.vaultId, 'category');
  return ok({ items });
}

export async function deleteCategory(uniqueId: string): Promise<ActionResult<null>> {
    const vault = await requirePrimaryVault();
    if (!vault.success) return fail(vault.code, vault.error);

    await db.delete(vaultItems).where(
        and(
            eq(vaultItems.vaultId, vault.data.vaultId),
            eq(vaultItems.resourceType, 'category'),
            eq(vaultItems.uniqueId, uniqueId)
        )
    );

    revalidatePath('/categories');
    return ok(null);
}

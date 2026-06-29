'use server';

import { getVaultItems } from '@/db/queries/vaultItems';
import { db } from '@/db';
import { vaultItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { requirePrimaryVault } from '@/server/actions/shared';
import type { VaultItem } from '@/types/database';

export async function fetchPatterns(): Promise<ActionResult<{ items: VaultItem[] }>> {
  const vault = await requirePrimaryVault();
  if (!vault.success) return vault;

  const items = await getVaultItems(vault.data.vaultId, 'pattern');
  return ok({ items });
}

export async function deletePattern(uniqueId: string): Promise<ActionResult<null>> {
    const vault = await requirePrimaryVault();
    if (!vault.success) return fail(vault.code, vault.error);

    await db.delete(vaultItems).where(
        and(
            eq(vaultItems.vaultId, vault.data.vaultId),
            eq(vaultItems.resourceType, 'pattern'),
            eq(vaultItems.uniqueId, uniqueId)
        )
    );

    revalidatePath('/patterns');
    return ok(null);
}

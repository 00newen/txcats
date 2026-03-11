'use server';

import { getVaultItems, createVaultItemsBulk } from '@/db/queries/vaultItems';
import { EncryptedPayload } from '@/server/actions/vaultItems'; // reuse type
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { requirePrimaryVault } from '@/server/actions/shared';
import type { VaultItem } from '@/types/database';

export async function fetchTransactions(): Promise<ActionResult<{ items: VaultItem[] }>> {
  const vault = await requirePrimaryVault();
  if (!vault.success) return vault;

  const items = await getVaultItems(vault.data.vaultId, 'transaction');

  return ok({ items });
}

export async function updateEncryptedItem(
    resourceType: string,
    payload: EncryptedPayload
) : Promise<ActionResult<null>> {
    const vault = await requirePrimaryVault();
    if (!vault.success) return fail(vault.code, vault.error);

    await createVaultItemsBulk([{
        vaultId: vault.data.vaultId,
        uniqueId: payload.uniqueId,
        resourceType: resourceType,
        ciphertextBase64: payload.ciphertextBase64,
        ivBase64: payload.ivBase64,
        aadBase64: payload.aadBase64
    }], true); // true = upsertMode

    revalidatePath('/transactions');
    return ok(null);
}

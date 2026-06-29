'use server';

import { getVaultItems } from '@/db/queries/vaultItems';
import { ok, type ActionResult } from '@/lib/actions/result';
import { requirePrimaryVault } from '@/server/actions/shared';
import type { VaultItem } from '@/types/database';

export async function fetchMappingProfiles(): Promise<ActionResult<{ items: VaultItem[] }>> {
  const vault = await requirePrimaryVault();
  if (!vault.success) return vault;

  const items = await getVaultItems(vault.data.vaultId, 'mapping_profile');

  return ok({ items });
}

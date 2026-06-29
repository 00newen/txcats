'use server';

import { createUserMeta, getUserMeta } from '@/db/queries/userMeta';
import { createVault } from '@/db/queries/vaults';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import type { UserMeta } from '@/types/database';

export type CheckUserSetupResult = {
  isSetup: boolean
  userId: string | null
  meta: UserMeta | null
  vaultId: string | null
}

export async function checkUserSetup(): Promise<CheckUserSetupResult> {
  const { userId } = await auth();
  if (!userId) return { isSetup: false, userId: null, meta: null, vaultId: null };

  const meta = (await getUserMeta(userId)) || null;
  
  // Also fetch primary vault if setup
  let vaultId = null;
  if (meta) {
    const { getVaultsByUserId } = await import('@/db/queries/vaults');
    const userVaults = await getVaultsByUserId(userId);
    if (userVaults.length > 0) {
      vaultId = userVaults[0].id;
    }
  }

  return { isSetup: !!meta, userId, meta, vaultId };
}

export async function completeSetup(payload: {
  salt: string;
  wrappedDEK: string;
  verificationBlob: string;
}): Promise<ActionResult<{ vaultId: string }>> {
  const { userId } = await auth();
  if (!userId) return fail('UNAUTHORIZED', 'Unauthorized');

  // 1. Create User Meta
  await createUserMeta(
    userId,
    payload.salt,
    payload.wrappedDEK,
    payload.verificationBlob
  );

  // 2. Create Default Vault
  const vault = await createVault(userId, 'Personal Vault');

  revalidatePath('/');
  return ok({ vaultId: vault.id });
}

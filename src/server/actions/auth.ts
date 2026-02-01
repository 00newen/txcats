'use server';

import { createUserMeta, getUserMeta } from '@/src/db/queries/userMeta';
import { createVault } from '@/src/db/queries/vaults';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function checkUserSetup() {
  const { userId } = await auth();
  if (!userId) return { isSetup: false, userId: null };

  const meta = await getUserMeta(userId);
  return { isSetup: !!meta, userId, meta };
}

export async function completeSetup(payload: {
  salt: string;
  wrappedDEK: string;
  verificationBlob: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 1. Create User Meta
  await createUserMeta(
    userId,
    payload.salt,
    payload.wrappedDEK,
    payload.verificationBlob
  );

  // 2. Create Default Vault
  await createVault(userId, 'Personal Vault');

  revalidatePath('/');
  return { success: true };
}

'use server';

import { db } from '@/src/db';
import { vaults, vaultItems, userMeta } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

/**
 * DEV ONLY: Wipe all transaction data for the current user's vaults.
 * Keeps categories, patterns, profiles, etc.
 */
export async function devResetTransactions() {
  // if (process.env.NODE_ENV !== 'development') {
  //   throw new Error('Dev only!');
  // }
  
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // get user vaults
  const userVaults = await db.select().from(vaults).where(eq(vaults.ownerId, userId));
  
  if (userVaults.length === 0) return { success: true }; // nothing to do

  const vaultIds = userVaults.map(v => v.id);

  // Delete only transactions
  // we iterate vaults just to be safe, though usually 1 user = 1 vault in V1
  for (const vId of vaultIds) {
      await db.delete(vaultItems)
        .where(
            and(
                eq(vaultItems.vaultId, vId),
                eq(vaultItems.resourceType, 'transaction')
            )
        );
  }

  revalidatePath('/');
  return { success: true };
}

/**
 * DEV ONLY: Wipe EVERYTHING for the current user.
 * Simulates a fresh start (as if user just signed up).
 */
export async function devResetFullAccount() {
  // if (process.env.NODE_ENV !== 'development') {
  //   throw new Error('Dev only!');
  // }

  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // 1. Delete Vaults (Cascade deletes items and permissions)
  await db.delete(vaults).where(eq(vaults.ownerId, userId));

  // 2. Delete User Meta (Reset setup status)
  await db.delete(userMeta).where(eq(userMeta.userId, userId));

  revalidatePath('/');
  return { success: true };
}

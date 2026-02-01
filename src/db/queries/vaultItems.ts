import { db } from '..';
import { vaultItems } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';
import { VaultItem, InsertVaultItem } from '../../types/database';

/**
 * Get all active items in a vault
 * Optionally filter by resourceType
 */
export async function getVaultItems(vaultId: string, resourceType?: string): Promise<VaultItem[]> {
  const conditions = [
    eq(vaultItems.vaultId, vaultId),
    isNull(vaultItems.deletedAt)
  ];

  if (resourceType) {
    conditions.push(eq(vaultItems.resourceType, resourceType));
  }

  return db.query.vaultItems.findMany({
    where: and(...conditions),
  });
}

/**
 * Create a new encrypted item
 */
export async function createVaultItem(
  vaultId: string,
  resourceType: string,
  ciphertextBase64: string,
  ivBase64: string,
  aadBase64: string
): Promise<VaultItem> {
  const [item] = await db.insert(vaultItems).values({
    vaultId,
    resourceType,
    ciphertextBase64,
    ivBase64,
    aadBase64,
  }).returning();
  return item;
}

/**
 * Update an item (optimistic locking via version)
 * Returns undefined if update failed (likely version mismatch or deleted)
 */
export async function updateVaultItem(
  itemId: string,
  ciphertextBase64: string,
  ivBase64: string,
  expectedVersion: number
): Promise<VaultItem | undefined> {
  const [updated] = await db.update(vaultItems)
    .set({
      ciphertextBase64,
      ivBase64,
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(
      eq(vaultItems.id, itemId),
      eq(vaultItems.version, expectedVersion),
      isNull(vaultItems.deletedAt)
    ))
    .returning();
  
  return updated;
}

/**
 * Soft delete an item
 */
export async function softDeleteVaultItem(itemId: string): Promise<void> {
  await db.update(vaultItems)
    .set({
      deletedAt: new Date(),
    })
    .where(eq(vaultItems.id, itemId));
}

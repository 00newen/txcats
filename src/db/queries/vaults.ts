import { db } from '..';
import { vaults, vaultPermissions } from '../schema';
import { eq, and } from 'drizzle-orm';
import { Vault, InsertVault } from '../../types/database';

/**
 * Get all vaults owned by a user
 */
export async function getVaultsByUserId(userId: string): Promise<Vault[]> {
  return db.select().from(vaults).where(eq(vaults.ownerId, userId));
}

/**
 * Get a specific vault by ID, checking ownership
 * Future: also check vaultPermissions
 */
export async function getVaultById(vaultId: string, userId: string): Promise<Vault | undefined> {
  // Check ownership
  const vault = await db.query.vaults.findFirst({
    where: and(eq(vaults.id, vaultId), eq(vaults.ownerId, userId)),
  });

  if (vault) return vault;

  // Check permissions (future proofing)
  // const permission = await db.query.vaultPermissions.findFirst(...)
  
  return undefined;
}

/**
 * Create a new vault
 */
export async function createVault(userId: string, name: string): Promise<Vault> {
  const [vault] = await db.insert(vaults).values({
    name,
    ownerId: userId,
  }).returning();
  return vault;
}

/**
 * Delete a vault (cascade will handle items)
 */
export async function deleteVault(vaultId: string, userId: string): Promise<void> {
  await db.delete(vaults).where(and(eq(vaults.id, vaultId), eq(vaults.ownerId, userId)));
}

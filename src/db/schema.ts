import { pgTable, text, timestamp, uuid, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Vaults - Ownership and sharing boundaries
 * Purpose: Unit of ownership for encrypted data; enables future sharing
 */
export const vaults = pgTable('vaults', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  // Clerk user ID of the owner
  ownerId: text('owner_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vaults_owner_id_idx').on(table.ownerId),
]);

export const vaultsRelations = relations(vaults, ({ many }) => ({
  items: many(vaultItems),
  permissions: many(vaultPermissions),
}));

/**
 * UserMeta - Encryption metadata (per user)
 * Purpose: Zero-knowledge encryption keys; never contains plaintext
 */
export const userMeta = pgTable('user_meta', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Clerk user ID (unique)
  userId: text('user_id').notNull().unique(),
  // Salt for deriving KEK from passphrase
  userSaltBase64: text('user_salt_base64').notNull(),
  // DEK encrypted with KEK
  wrappedDEKBase64: text('wrapped_dek_base64').notNull(),
  // For verifying correct passphrase
  verificationBlobBase64: text('verification_blob_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('user_meta_user_id_idx').on(table.userId),
]);

/**
 * VaultItems - Generic encrypted storage
 * Purpose: Stores all encrypted data; server cannot read contents
 */
export const vaultItems = pgTable('vault_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  vaultId: uuid('vault_id').references(() => vaults.id, { onDelete: 'cascade' }).notNull(),
  // 'transaction', 'category', 'pattern', 'account'
  resourceType: text('resource_type').notNull(),
  // Deterministic ID for deduplication (only for transactions usually)
  uniqueId: text('unique_id'),
  // Encrypted JSON payload
  ciphertextBase64: text('ciphertext_base64').notNull(),
  // Initialization vector for AES-GCM
  ivBase64: text('iv_base64').notNull(),
  // Additional authenticated data (typically vaultId + resourceType)
  aadBase64: text('aad_base64').notNull(),
  // For optimistic locking
  version: integer('version').default(1).notNull(),
  // Soft delete
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vault_items_vault_id_idx').on(table.vaultId),
  index('vault_items_resource_type_idx').on(table.resourceType),
  index('vault_items_deleted_at_idx').on(table.deletedAt),
  // Deduplication constraint: uniqueId must be unique within a vault for a specific resource type
  uniqueIndex('vault_items_dedup_idx').on(table.vaultId, table.resourceType, table.uniqueId),
]);

export const vaultItemsRelations = relations(vaultItems, ({ one }) => ({
  vault: one(vaults, {
    fields: [vaultItems.vaultId],
    references: [vaults.id],
  }),
}));

/**
 * VaultPermissions - Sharing and access control (future)
 * Purpose: Enable vault sharing without re-encryption
 */
export const vaultPermissions = pgTable('vault_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  vaultId: uuid('vault_id').references(() => vaults.id, { onDelete: 'cascade' }).notNull(),
  // Clerk user ID
  userId: text('user_id').notNull(),
  // 'owner', 'editor', 'viewer'
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vault_permissions_vault_id_idx').on(table.vaultId),
  index('vault_permissions_user_id_idx').on(table.userId),
  uniqueIndex('vault_permissions_user_vault_unique').on(table.userId, table.vaultId),
]);

export const vaultPermissionsRelations = relations(vaultPermissions, ({ one }) => ({
  vault: one(vaults, {
    fields: [vaultPermissions.vaultId],
    references: [vaults.id],
  }),
}));

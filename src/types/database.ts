import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { vaults, userMeta, vaultItems, vaultPermissions } from '../db/schema';

// Vaults
export type Vault = InferSelectModel<typeof vaults>;
export type InsertVault = InferInsertModel<typeof vaults>;

// User Meta
export type UserMeta = InferSelectModel<typeof userMeta>;
export type InsertUserMeta = InferInsertModel<typeof userMeta>;

// Vault Items
export type VaultItem = InferSelectModel<typeof vaultItems>;
export type InsertVaultItem = InferInsertModel<typeof vaultItems>;

// Vault Permissions
export type VaultPermission = InferSelectModel<typeof vaultPermissions>;
export type InsertVaultPermission = InferInsertModel<typeof vaultPermissions>;

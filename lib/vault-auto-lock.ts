export type VaultAutoLockMinutes = 5 | 15 | 30;
export type VaultAutoLockSetting = 'never' | VaultAutoLockMinutes;

export const VAULT_AUTO_LOCK_STORAGE_KEY = 'txcats-vault-auto-lock';
export const VAULT_AUTO_LOCK_CHANGED_EVENT = 'txcats-vault-auto-lock-changed';
export const DEFAULT_VAULT_AUTO_LOCK_SETTING: VaultAutoLockSetting = 'never';

export function resolveVaultAutoLockSetting(value: string | null | undefined): VaultAutoLockSetting {
  if (value === '5') return 5;
  if (value === '15') return 15;
  if (value === '30') return 30;
  return DEFAULT_VAULT_AUTO_LOCK_SETTING;
}

export function serializeVaultAutoLockSetting(value: VaultAutoLockSetting): string {
  return value === 'never' ? 'never' : String(value);
}

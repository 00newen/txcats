'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_VAULT_AUTO_LOCK_SETTING,
  VAULT_AUTO_LOCK_CHANGED_EVENT,
  VAULT_AUTO_LOCK_STORAGE_KEY,
  resolveVaultAutoLockSetting,
  serializeVaultAutoLockSetting,
  type VaultAutoLockSetting,
} from '@/lib/vault-auto-lock';

export function useVaultAutoLockSetting() {
  const [autoLockSetting, setAutoLockSettingState] = useState<VaultAutoLockSetting>(DEFAULT_VAULT_AUTO_LOCK_SETTING);

  useEffect(() => {
    const load = () => setAutoLockSettingState(resolveVaultAutoLockSetting(localStorage.getItem(VAULT_AUTO_LOCK_STORAGE_KEY)));

    load();
    window.addEventListener('storage', load);
    window.addEventListener(VAULT_AUTO_LOCK_CHANGED_EVENT, load);

    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(VAULT_AUTO_LOCK_CHANGED_EVENT, load);
    };
  }, []);

  const setAutoLockSetting = useCallback((setting: VaultAutoLockSetting) => {
    localStorage.setItem(VAULT_AUTO_LOCK_STORAGE_KEY, serializeVaultAutoLockSetting(setting));
    setAutoLockSettingState(setting);
    window.dispatchEvent(new CustomEvent(VAULT_AUTO_LOCK_CHANGED_EVENT));
  }, []);

  return { autoLockSetting, setAutoLockSetting };
}

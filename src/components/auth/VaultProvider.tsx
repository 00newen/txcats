'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { checkUserSetup } from '@/server/actions/auth';
import { Loader2 } from 'lucide-react';
import { UserMeta } from '@/types/database';
import { useVaultAutoLockSetting } from '@/hooks/use-vault-auto-lock-setting';

// Context to hold the Data Encryption Key (DEK)
// CAUTION: This key is sensitive and exists in memory only.
interface VaultContextType {
    dek: CryptoKey | null;
    isUnlocked: boolean;
    isSetup: boolean;
    meta: UserMeta | null;
    vaultId: string | null;
    lock: () => void;
    unlock: (key: CryptoKey) => void;
}

const VaultContext = createContext<VaultContextType>({
    dek: null,
    isUnlocked: false,
    isSetup: false,
    meta: null,
    vaultId: null,
    lock: () => { },
    unlock: () => { },
});

export function useVault() {
    return useContext(VaultContext);
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded: isUserLoaded } = useUser();
    const [isSetupChecked, setIsSetupChecked] = useState(false);
    const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
    const [vaultId, setVaultId] = useState<string | null>(null);
    const [dek, setDek] = useState<CryptoKey | null>(null);
    const { autoLockSetting } = useVaultAutoLockSetting();

    const refreshSetupState = useCallback(async () => {
        try {
            const result = await checkUserSetup();
            if (result.meta) {
                setUserMeta(result.meta as UserMeta);
                setVaultId(result.vaultId || null);
                return;
            }

            setUserMeta(null);
            setVaultId(null);
        } catch (e) {
            console.error("Failed to check setup", e);
        } finally {
            setIsSetupChecked(true);
        }
    }, []);

    useEffect(() => {
        if (!isUserLoaded || !user) {
            setUserMeta(null);
            setVaultId(null);
            setIsSetupChecked(true);
            return;
        }

        refreshSetupState();
    }, [isUserLoaded, refreshSetupState, user]);

    const lock = useCallback(() => {
        setDek(null);
    }, []);

    const handleUnlock = useCallback((key: CryptoKey) => {
        setDek(key);
    }, []);

    useEffect(() => {
        if (!dek || autoLockSetting === 'never') return;

        const timeoutMs = autoLockSetting * 60 * 1000;
        let timeoutId = window.setTimeout(lock, timeoutMs);

        const resetTimer = () => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(lock, timeoutMs);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') resetTimer();
        };

        window.addEventListener('pointerdown', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('scroll', resetTimer, true);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener('pointerdown', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('scroll', resetTimer, true);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [autoLockSetting, dek, lock]);

    if (!isUserLoaded || !isSetupChecked) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <VaultContext.Provider value={{
            dek,
            isUnlocked: !!dek,
            lock,
            unlock: handleUnlock,
            isSetup: !!userMeta,
            meta: userMeta,
            vaultId
        }}>
            {children}
        </VaultContext.Provider>
    );
}

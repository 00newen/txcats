'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { checkUserSetup } from '@/server/actions/auth';
import { Loader2 } from 'lucide-react';
import { UserMeta } from '@/types/database';

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

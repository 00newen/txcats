'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { checkUserSetup } from '@/src/server/actions/auth';
import { PassphraseSetup } from './PassphraseSetup';
import { UnlockScreen } from './UnlockScreen';
import { Loader2 } from 'lucide-react';
import { UserMeta } from '@/src/types/database';

// Context to hold the Data Encryption Key (DEK)
// CAUTION: This key is sensitive and exists in memory only.
interface VaultContextType {
    dek: CryptoKey | null;
    isUnlocked: boolean;
    isSetup: boolean;
    meta: UserMeta | null;
    lock: () => void;
    unlock: (key: CryptoKey) => void;
}

const VaultContext = createContext<VaultContextType>({
    dek: null,
    isUnlocked: false,
    isSetup: false,
    meta: null,
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
    const [dek, setDek] = useState<CryptoKey | null>(null);

    // Check setup status when user loads
  useEffect(() => {
    async function checkSetup() {
      if (!isUserLoaded || !user) {
        setIsSetupChecked(true); // Nothing to check if no user
        return;
      }

      try {
        const result = await checkUserSetup();
        // Server action returns plain object, need to cast or ensure it matches
        // But checkUserSetup currently returns { isSetup, userId } or similar
        // We need to update checkUserSetup to return the full meta if established

        // Wait, checkUserSetup needs to be improved to return the meta if it exists
        // Let's modify the server action first to return the META if found.
        if (result.meta) {
          setUserMeta(result.meta as unknown as UserMeta);
        } else {
            // Explicitly set null if not found to handle logout/switch cases
            setUserMeta(null);
        }
      } catch (e) {
        console.error("Failed to check setup", e);
      } finally {
        setIsSetupChecked(true);
      }
    }

    checkSetup();
  }, [isUserLoaded, user]);

    const lock = useCallback(() => {
        setDek(null);
    }, []);

    const handleUnlock = useCallback((key: CryptoKey) => {
        setDek(key);
    }, []);

    const handleSetupComplete = useCallback(async () => {
        // Re-check setup to load the new meta
        try {
            const result = await checkUserSetup();
            if (result.meta) {
                setUserMeta(result.meta as unknown as UserMeta);
                // Auto-unlock logic could go here if we returned the keys from setup, 
                // but for security usually better to ask for login again or structure flow differently.
                // For now, just updating state is enough to move from "Setup" to "Locked" state.
            }
        } catch (e) {
            console.error("Failed to refresh setup state", e);
        }
    }, []);

    // 1. Loading State
    if (!isUserLoaded || !isSetupChecked) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // 5. Always Render Children with Context
    // logic: if user is not logged in, or setup not done, or locked, we just reflect that in the context
    // The UI components will decide what to show based on this state.
    return (
        <VaultContext.Provider value={{
            dek,
            isUnlocked: !!dek,
            lock,
            unlock: handleUnlock,
            isSetup: !!userMeta,
            meta: userMeta
        }}>
            {children}
        </VaultContext.Provider>
    );
}

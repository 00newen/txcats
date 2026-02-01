'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { UnlockScreen } from '@/src/components/auth/UnlockScreen';
import { PassphraseSetup } from '@/src/components/auth/PassphraseSetup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

/**
 * Wrapper component for pages that require an unlocked vault.
 * Shows the content if unlocked, or the appropriate Setup/Unlock UI if not.
 */
export function ProtectedVaultContent({ children }: { children: React.ReactNode }) {
    const { isUnlocked, isSetup, meta, unlock } = useVault();
    const [showSetup, setShowSetup] = useState(false);

    if (isUnlocked) {
        return <>{children}</>;
    }

    // Not Setup
    if (!isSetup) {
        // If we want to show setup immediately or a prompt
        // Let's show a prompt first to be less intrusive, or just the setup card directly
        // since this is a "Protected Content" area request.
        return (
            <div className="container mx-auto max-w-2xl py-12">
                <PassphraseSetup onComplete={() => window.location.reload()} />
            </div>
        );
    }

    // Locked
    if (meta) {
        return (
            <div className="container mx-auto max-w-md py-12">
                <UnlockScreen userMeta={meta} onUnlock={unlock} />
            </div>
        );
    }

    return null;
}

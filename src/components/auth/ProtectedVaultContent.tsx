'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { useUser } from '@clerk/nextjs';
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
    const { isSignedIn } = useUser();
    const [showSetup, setShowSetup] = useState(false);

    if (isUnlocked) {
        return <>{children}</>;
    }

    if (!isSignedIn) {
        return (
            <div className="container mx-auto max-w-4xl py-12 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Sign in to access your vault</CardTitle>
                        <CardDescription>
                            Log in to create or unlock your vault and view encrypted data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Lock className="h-4 w-4" />
                            Your vault is tied to your account.
                        </div>
                    </CardContent>
                </Card>
                <div className="pointer-events-none opacity-60" aria-disabled="true">
                    {children}
                </div>
            </div>
        );
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

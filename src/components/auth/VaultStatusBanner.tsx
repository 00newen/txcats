'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { Button } from '@/components/ui/button';
import { Lock, PlusCircle, Unlock, X } from 'lucide-react';
import { useState } from 'react';
import { PassphraseSetup } from './PassphraseSetup';
import { UnlockScreen } from './UnlockScreen';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function VaultStatusBanner() {
    const { isUnlocked, isSetup, meta, unlock } = useVault();
    const [showDialog, setShowDialog] = useState(false);

    // If everything is good (Setup AND Unlocked), don't show banner OR show a minimized "Unlocked" pill?
    // User request: "Vault creation banner to be on top... content visible... buttons disabled"
    // Usually if unlocked, we don't need a banner warning.
    if (isSetup && isUnlocked) return null;

    // User request: "Banner appear in the page content. Don't displace the sidebar."
    // We can make it a floating card or just a block element.
    // Using sticky only within the main content area effectively.
    return (
        <div className="w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 p-3 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    {!isSetup ? (
                        <>
                            <PlusCircle className="h-5 w-5" />
                            <span className="text-sm font-medium">Vault not created. You need to create a vault to secure your data.</span>
                        </>
                    ) : (
                        <>
                            <Lock className="h-5 w-5" />
                            <span className="text-sm font-medium">Vault is locked. Decryption keys are cleared from memory.</span>
                        </>
                    )}
                </div>

                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900">
                            {!isSetup ? "Create Vault" : "Unlock Vault"}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-background border shadow-lg">
                        {!isSetup ? (
                            <PassphraseSetup onComplete={() => setShowDialog(false)} />
                        ) : (
                            meta && <UnlockScreen userMeta={meta} onUnlock={(k) => {
                                unlock(k);
                                setShowDialog(false);
                            }} />
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

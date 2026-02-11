'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { PassphraseSetup } from './PassphraseSetup';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export function VaultStatusBanner() {
    const { isSetup } = useVault();
    const { isSignedIn } = useUser();
    const [showDialog, setShowDialog] = useState(false);

    if (!isSignedIn || isSetup) return null;

    return (
        <div className="w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <PlusCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Vault not created. You need to create a vault to secure your data.</span>
                </div>

                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900">
                            Create Vault
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-background border shadow-lg">
                        <PassphraseSetup onComplete={() => setShowDialog(false)} />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

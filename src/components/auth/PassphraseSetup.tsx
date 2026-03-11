'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { preparePassphraseSetup } from '@/lib/auth/passphrase';
import { completeSetup } from '@/server/actions/auth';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { unwrap } from '@/lib/actions/result';

export function PassphraseSetup({ onComplete }: { onComplete: () => Promise<void> | void }) {
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passphrase.length < 8) {
            toast({ title: "Passphrase too short", description: "Must be at least 8 characters", variant: "destructive" });
            return;
        }

        if (passphrase !== confirmPassphrase) {
            toast({ title: "Mismatch", description: "Passphrases do not match", variant: "destructive" });
            return;
        }

        setIsLoading(true);

        try {
            // 1. Client-side crypto (CPU intensive)
            const { salt, wrappedDEK, verificationBlob, dek } = await preparePassphraseSetup(passphrase);

            // 2. Server-side storage (Create meta and vault)
            const response = unwrap(await completeSetup({ salt, wrappedDEK, verificationBlob }));

            if (response.vaultId) {
                // 3. Initialize Default Categories
                const { prepareDefaultCategories } = await import('@/features/categories/utils/defaults');
                const { encryptData } = await import('@/crypto/encryption');
                const { saveEncryptedItems } = await import('@/server/actions/vaultItems');

                const defaultCategories = await prepareDefaultCategories(response.vaultId);
                const encryptedPayloads = await Promise.all(
                    defaultCategories.map(async (cat) => {
                        const aad = new TextEncoder().encode('category');
                        const { ciphertextBase64, ivBase64 } = await encryptData(cat, dek, aad);
                        const aadBase64 = btoa(String.fromCharCode(...aad));
                        return {
                            uniqueId: cat.id,
                            ciphertextBase64,
                            ivBase64,
                            aadBase64
                        };
                    })
                );

                unwrap(await saveEncryptedItems('category', encryptedPayloads));
            }

            toast({ title: "Setup Complete", description: "Your vault is ready with default categories." });

            // Call the callback provided by VaultProvider to update internal state
            await onComplete();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to setup vault.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Create your Vault</CardTitle>
                <CardDescription>
                    Choose a strong passphrase to encrypt your data. <br />
                    <span className="text-red-500 font-bold">If you lose this, your data is lost forever.</span>
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="passphrase">Passphrase</Label>
                        <Input
                            id="passphrase"
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirm Passphrase</Label>
                        <Input
                            id="confirm"
                            type="password"
                            value={confirmPassphrase}
                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Initialize Vault
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

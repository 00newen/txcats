'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { unlockVault } from '@/src/lib/auth/passphrase';
import { Loader2, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserMeta } from '@/src/types/database';

interface UnlockScreenProps {
    userMeta: UserMeta;
    onUnlock: (dek: CryptoKey) => void;
}

export function UnlockScreen({ userMeta, onUnlock }: UnlockScreenProps) {
    const [passphrase, setPassphrase] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const dek = await unlockVault(
                passphrase,
                userMeta.userSaltBase64,
                userMeta.wrappedDEKBase64,
                userMeta.verificationBlobBase64
            );

            if (dek) {
                onUnlock(dek);
            } else {
                toast({ title: "Incorrect Passphrase", description: "Please try again.", variant: "destructive" });
                setPassphrase('');
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "An error occurred while unlocking.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-sm mx-auto">
            <CardHeader className="text-center">
                <div className="mx-auto bg-muted p-3 rounded-full w-fit mb-2">
                    <Lock className="h-6 w-6" />
                </div>
                <CardTitle>Unlock Vault</CardTitle>
                <CardDescription>
                    Enter your passphrase to access your data.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="unlock-passphrase" className="sr-only">Passphrase</Label>
                        <Input
                            id="unlock-passphrase"
                            type="password"
                            placeholder="Passphrase"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            disabled={isLoading}
                            autoFocus
                            required
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Unlock
                    </Button>

                    <div className="w-full pt-4 border-t">
                        <p className="text-xs text-muted-foreground text-center mb-2 font-mono">DEV OPTIONS</p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="w-1/2 text-xs"
                                onClick={async () => {
                                    if (confirm("Reset TRANSACTIONS only? This cannot be undone.")) {
                                        const { devResetTransactions } = await import('@/src/server/actions/dev');
                                        await devResetTransactions();
                                        toast({ title: "Transactions Reset", description: "All transaction data wiped." });
                                        window.location.reload();
                                    }
                                }}
                            >
                                Reset Txs
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="w-1/2 text-xs"
                                onClick={async () => {
                                    if (confirm("Reset FULL ACCOUNT? This deletes keys, vault, and data. You will need to start over.")) {
                                        const { devResetFullAccount } = await import('@/src/server/actions/dev');
                                        await devResetFullAccount();
                                        toast({ title: "Account Reset", description: "Vault wiped. Refreshing..." });
                                        window.location.reload();
                                    }
                                }}
                            >
                                Reset All
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}

'use client';

import { useVault } from '@/auth/VaultProvider';
import { PassphraseSetup } from '@/auth/PassphraseSetup';
import { UnlockScreen } from '@/auth/UnlockScreen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, ShieldCheck, ShieldAlert, TriangleAlert, KeyRound } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

export default function LockPage() {
  const { isSetup, isUnlocked, meta, lock, unlock } = useVault();
  const { isSignedIn } = useUser();

  return (
    <div className='container mx-auto max-w-3xl p-6 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Lock className='h-5 w-5' />
            Vault Security
          </CardTitle>
          <CardDescription>Your data key only lives in memory while the vault is unlocked.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Current status:</span>
            {!isSetup && <Badge variant='secondary'>Not Setup</Badge>}
            {isSetup && isUnlocked && (
              <Badge className='gap-1'>
                <ShieldCheck className='h-3 w-3' />
                Unlocked
              </Badge>
            )}
            {isSetup && !isUnlocked && (
              <Badge variant='outline' className='gap-1'>
                <ShieldAlert className='h-3 w-3' />
                Locked
              </Badge>
            )}
          </div>

          <div className='rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground'>
            {isUnlocked
              ? 'You can continue using all encrypted features. Locking will clear the key from memory immediately.'
              : 'Unlock to decrypt transactions, categories, and patterns on this device.'}
          </div>

          {isSignedIn ? (
            <div className='flex flex-wrap gap-2'>
              {isUnlocked && (
                <Button onClick={lock} variant='destructive'>
                  Lock Vault Now
                </Button>
              )}
              {!isSetup && (
                <Badge variant='outline' className='gap-1 px-2 py-1'>
                  <KeyRound className='h-3 w-3' />
                  Passphrase Required
                </Badge>
              )}
            </div>
          ) : (
            <div className='text-sm text-muted-foreground flex items-center gap-2'>
              <Lock className='h-4 w-4' />
              Log in to create or unlock your vault.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Important Reminder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
            <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
            <p>
              Your passphrase is never stored on the server. If you lose it, encrypted data cannot be recovered.
            </p>
          </div>
        </CardContent>
      </Card>

      {isSignedIn && !isSetup && <PassphraseSetup onComplete={() => window.location.reload()} />}
      {isSignedIn && isSetup && !isUnlocked && meta && <UnlockScreen userMeta={meta} onUnlock={unlock} />}
    </div>
  );
}

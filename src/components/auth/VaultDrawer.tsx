'use client';

import { useUser } from '@clerk/nextjs';
import { KeyRound, Lock, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';

import { PassphraseSetup } from '@/auth/PassphraseSetup';
import { UnlockScreen } from '@/auth/UnlockScreen';
import { useVault } from '@/auth/VaultProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface VaultDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VaultDrawer({ open, onOpenChange }: VaultDrawerProps) {
  const { isSetup, isUnlocked, meta, lock, unlock } = useVault();
  const { isSignedIn } = useUser();

  const handleLock = () => {
    lock();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='max-w-[min(420px,100vw)]'>
        <SheetHeader className='border-b'>
          <SheetTitle>Vault Security</SheetTitle>
          <SheetDescription>Your data key only lives in memory while the vault is unlocked.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-6'>
          <div className='space-y-5'>
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

            {!isSignedIn && (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Lock className='h-4 w-4' />
                Log in to create or unlock your vault.
              </div>
            )}

            {isSignedIn && isUnlocked && (
              <Button onClick={handleLock} variant='destructive' className='w-full'>
                Lock Vault Now
              </Button>
            )}

            {isSignedIn && !isSetup && (
              <div className='space-y-4'>
                <Badge variant='outline' className='gap-1 px-2 py-1'>
                  <KeyRound className='h-3 w-3' />
                  Passphrase Required
                </Badge>
                <PassphraseSetup onComplete={() => window.location.reload()} />
              </div>
            )}

            {isSignedIn && isSetup && !isUnlocked && meta && <UnlockScreen userMeta={meta} onUnlock={unlock} />}

            <div className='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
              <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
              <p>Your passphrase is never stored on the server. If you lose it, encrypted data cannot be recovered.</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

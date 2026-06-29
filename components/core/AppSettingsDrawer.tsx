'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { formatAmount, getFormatLabel } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';
import { useDashboardDefaultRange } from '@/hooks/use-dashboard-default-range';
import { usePrivacyMode } from '@/hooks/use-privacy-mode';
import { useVaultAutoLockSetting } from '@/hooks/use-vault-auto-lock-setting';
import { cn } from '@/lib/utils';
import type { DashboardDefaultRange } from '@/lib/dashboard-range';
import type { VaultAutoLockSetting } from '@/lib/vault-auto-lock';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface AppSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppSettingsDrawer({ open, onOpenChange }: AppSettingsDrawerProps) {
  const { amountFormat, setAmountFormat } = useAmountFormat();
  const { dashboardDefaultRange, setDashboardDefaultRange } = useDashboardDefaultRange();
  const { privacyMode, setPrivacyMode } = usePrivacyMode();
  const { autoLockSetting, setAutoLockSetting } = useVaultAutoLockSetting();
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themeOptions = [
    { key: 'system', label: 'System', icon: Monitor },
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
  ] as const;
  const autoLockOptions: { key: VaultAutoLockSetting; label: string }[] = [
    { key: 'never', label: 'Never' },
    { key: 5, label: '5 min' },
    { key: 15, label: '15 min' },
    { key: 30, label: '30 min' },
  ];
  const dashboardRangeOptions: { key: DashboardDefaultRange; label: string }[] = [
    { key: 'currentMonth', label: 'Current month' },
    { key: 'last30Days', label: 'Last 30 days' },
    { key: 'currentYear', label: 'Current year' },
    { key: 'allTime', label: 'All time' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='max-w-[min(420px,100vw)]'>
        <SheetHeader className='border-b'>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Adjust how txCats displays your workspace.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-8 overflow-y-auto px-6 py-6'>
          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-bold'>Theme</h3>
              <p className='mt-1 text-sm text-muted-foreground'>Choose how txCats follows your display preference.</p>
            </div>

            <div className='grid grid-cols-3 gap-2'>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = isMounted && (theme || 'system') === option.key;
                return (
                  <button
                    key={option.key}
                    type='button'
                    onClick={() => setTheme(option.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs font-bold transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <Icon className='h-4 w-4' />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-bold'>Privacy Mode</h3>
              <p className='mt-1 text-sm text-muted-foreground'>Hide financial details when you are sharing your screen.</p>
            </div>

            <button
              type='button'
              onClick={() => setPrivacyMode(!privacyMode)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                privacyMode ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
              )}
            >
              <span>
                <span className='block font-bold'>Hide financial details</span>
                <span className='text-xs text-muted-foreground'>Masks amounts and account identifiers.</span>
              </span>
              <span
                className={cn(
                  'relative h-6 w-10 rounded-full transition-colors',
                  privacyMode ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                    privacyMode ? 'translate-x-5' : 'translate-x-1',
                  )}
                />
              </span>
            </button>
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-bold'>Vault Auto-Lock</h3>
              <p className='mt-1 text-sm text-muted-foreground'>Automatically lock your vault after inactivity.</p>
            </div>

            <div className='grid grid-cols-4 gap-2'>
              {autoLockOptions.map((option) => (
                <button
                  key={option.key}
                  type='button'
                  onClick={() => setAutoLockSetting(option.key)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                    autoLockSetting === option.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-bold'>Default Dashboard Range</h3>
              <p className='mt-1 text-sm text-muted-foreground'>Choose the date range used when Dashboard opens without URL dates.</p>
            </div>

            <div className='space-y-2'>
              {dashboardRangeOptions.map((option) => (
                <button
                  key={option.key}
                  type='button'
                  onClick={() => setDashboardDefaultRange(option.key)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm font-bold transition-colors',
                    dashboardDefaultRange === option.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-bold'>Amount Number Format</h3>
              <p className='mt-1 text-sm text-muted-foreground'>Choose how all amounts are displayed across the app.</p>
            </div>

            <div className='space-y-2'>
              {(['us', 'eu', 'space'] as const).map((formatKey) => (
                <button
                  key={formatKey}
                  type='button'
                  onClick={() => setAmountFormat(formatKey)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    amountFormat === formatKey ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  <p className='font-bold'>{getFormatLabel(formatKey)}</p>
                  <p className='text-xs text-muted-foreground'>Preview: ${formatAmount(1234.56, formatKey)}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

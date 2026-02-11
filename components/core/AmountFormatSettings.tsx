'use client';

import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatAmount, getFormatLabel } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';

export function AmountFormatSettings() {
  const { amountFormat, setAmountFormat } = useAmountFormat();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon' aria-label='Amount format settings'>
          <Settings2 className='h-5 w-5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Amount Number Format</DialogTitle>
          <DialogDescription>Choose how all amounts are displayed across the app.</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
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
      </DialogContent>
    </Dialog>
  );
}


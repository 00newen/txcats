'use client';

import { useVault } from '@/auth/VaultProvider';
import { ProtectedVaultContent } from '@/auth/ProtectedVaultContent';
import { PatternManager } from '@/features/patterns/components/PatternManager';
import { PatternItem } from '@/features/patterns/types';
import { CategoryItem } from '@/features/categories/types';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { loadCategories, loadPatterns } from '@/lib/vault/loaders';

export default function PatternsPage() {
  const { dek } = useVault();
  const { isSignedIn } = useUser();
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    try {
      const [categoryResult, patternResult] = await Promise.all([loadCategories(dek), loadPatterns(dek)]);
      setCategories(categoryResult.items as CategoryItem[]);
      setPatterns(patternResult.items as PatternItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [dek, loadData]);

  if (isLoading && patterns.length === 0 && isSignedIn) {
    return (
      <ProtectedVaultContent>
        <div className='flex justify-center items-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </ProtectedVaultContent>
    );
  }

  return (
    <ProtectedVaultContent>
      <div className='container mx-auto p-6 space-y-6'>
        <div className='flex flex-col space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>Patterns</h1>
          <p className='text-muted-foreground'>
            Manage automation rules to categorize your transactions automatically.
          </p>
        </div>

        <div className={cn('transition-opacity', !isLoading && 'animate-in fade-in-50')}>
          <PatternManager patterns={patterns} categories={categories} onRefresh={loadData} />
        </div>
      </div>
    </ProtectedVaultContent>
  );
}

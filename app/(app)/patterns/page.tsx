'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { PatternManager } from '@/src/features/patterns/components/PatternManager';
import { PatternItem } from '@/src/features/patterns/types';
import { CategoryItem } from '@/src/features/categories/types';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { decryptData } from '@/src/crypto/encryption';
import { fetchPatterns } from '@/src/server/actions/patterns';
import { fetchCategories } from '@/src/server/actions/categories';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

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
      // Fetch Categories first (needed for patterns)
      const catRes = await fetchCategories();
      const decCategories: CategoryItem[] = [];
      if (catRes.success && catRes.items) {
        for (const item of catRes.items) {
          try {
            const aad = new TextEncoder().encode('category');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decCategories.push(plain as CategoryItem);
          } catch {}
        }
      }
      setCategories(decCategories);

      // Fetch Patterns
      const patRes = await fetchPatterns();
      const decPatterns: PatternItem[] = [];
      if (patRes.success && patRes.items) {
        for (const item of patRes.items) {
          try {
            const aad = new TextEncoder().encode('pattern');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decPatterns.push(plain as PatternItem);
          } catch {}
        }
      }
      setPatterns(decPatterns);
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

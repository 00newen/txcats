'use client';

import { useVault } from '@/auth/VaultProvider';
import { ProtectedVaultContent } from '@/auth/ProtectedVaultContent';
import { CategoryManager } from '@/features/categories/components/CategoryManager';
import { CategoryItem } from '@/features/categories/types';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { loadCategories as loadDecryptedCategories } from '@/lib/vault/loaders';

export default function CategoriesPage() {
  const { dek } = useVault();
  const { isSignedIn } = useUser();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    try {
      const result = await loadDecryptedCategories(dek);
      setCategories(result.items as CategoryItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      loadCategories();
    } else {
      setIsLoading(false);
    }
  }, [dek, loadCategories]);

  if (isLoading && categories.length === 0 && isSignedIn) {
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
        <div className={cn('transition-opacity', !isLoading && 'animate-in fade-in-50')}>
          <CategoryManager categories={categories} onRefresh={loadCategories} />
        </div>
      </div>
    </ProtectedVaultContent>
  );
}

'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { CategoryManager } from '@/src/features/categories/components/CategoryManager';
import { CategoryItem } from '@/src/features/categories/types';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { decryptData } from '@/src/crypto/encryption';
import { fetchCategories } from '@/src/server/actions/categories';

export default function CategoriesPage() {
  const { dek } = useVault();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    try {
      const { success, items } = await fetchCategories();
      if (success && items) {
        const decrypted: CategoryItem[] = [];
        for (const item of items) {
          try {
            const aad = new TextEncoder().encode('category');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decrypted.push(plain as CategoryItem);
          } catch (e) {
            console.error("Failed to decrypt category", item.uniqueId, e);
          }
        }
        // Sort: Income first, then Expense, then alphabetical
        decrypted.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setCategories(decrypted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      loadCategories();
    }
  }, [dek, loadCategories]);

  if (isLoading && categories.length === 0) {
    return (
      <ProtectedVaultContent>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ProtectedVaultContent>
    );
  }

  return (
    <ProtectedVaultContent>
      <div className="container mx-auto p-6 space-y-6">
        <CategoryManager
          categories={categories}
          onRefresh={loadCategories}
        />
      </div>
    </ProtectedVaultContent>
  );
}

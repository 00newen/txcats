'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { decryptData, encryptData } from '@/src/crypto/encryption';
import { TransactionRow } from '@/src/features/upload/types';
import { CategoryItem } from '@/src/features/categories/types';
import { fetchTransactions, updateEncryptedItem } from '@/src/server/actions/transactions';
import { fetchCategories } from '@/src/server/actions/categories';
import { fetchPatterns } from '@/src/server/actions/patterns';
import { matchTransaction } from '@/src/features/patterns/utils/engine';
import { PatternItem } from '@/src/features/patterns/types';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Sparkles, Check } from 'lucide-react';

export default function TransactionsPage() {
  const { dek } = useVault();
  const { toast } = useToast();

  const [data, setData] = useState<(TransactionRow & { id: string, uniqueId: string })[] | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination / Filter states in client for now
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Load Categories
  const loadCategories = useCallback(async () => {
    if (!dek) return;
    const { success, items } = await fetchCategories();
    if (success && items) {
      const decrypted: CategoryItem[] = [];
      for (const item of items) {
        try {
          const aad = new TextEncoder().encode('category');
          const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad) as CategoryItem;
          decrypted.push(plain);
        } catch { }
      }
      setCategories(decrypted);
    }
  }, [dek]);

  const loadPatterns = useCallback(async () => {
    if (!dek) return;
    const { success, items } = await fetchPatterns();
    if (success && items) {
      const decrypted: PatternItem[] = [];
      for (const item of items) {
        try {
          const aad = new TextEncoder().encode('pattern');
          const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
          decrypted.push(plain as PatternItem);
        } catch { }
      }
      setPatterns(decrypted);
    }
  }, [dek]);

  // Load Transactions
  const loadTransactions = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchTransactions();

      if (!response.success || !response.items) {
        throw new Error(response.error || "Failed to fetch");
      }

      const items = response.items;
      const decryptedItems: (TransactionRow & { uniqueId: string, id: string })[] = [];

      for (const item of items) {
        try {
          // Decode stored AAD 
          const aadBytes = new Uint8Array(atob(item.aadBase64).split('').map(c => c.charCodeAt(0)));

          const plaintext = await decryptData(
            item.ciphertextBase64,
            item.ivBase64,
            dek,
            aadBytes
          );
          // Store ID for local state tracking and uniqueId for vault updates
          decryptedItems.push({ ...plaintext as TransactionRow, id: item.id, uniqueId: item.uniqueId || '' });
        } catch (err) {
          console.error(`Failed to decrypt item ${item.id}`, err);
        }
      }

      // Sort by date desc
      decryptedItems.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());

      setData(decryptedItems);
    } catch (e) {
      setError("Could not load transactions");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      Promise.all([loadCategories(), loadPatterns(), loadTransactions()]);
    }
  }, [dek, loadCategories, loadPatterns, loadTransactions]);

  const handleCategoryChange = async (id: string, newCategoryId: string) => {
    if (!data || !dek) return;

    const txIndex = data.findIndex(d => d.id === id);
    if (txIndex === -1) return;

    const tx = data[txIndex];
    const updatedTx = { ...tx, categoryId: newCategoryId || undefined };

    // Optimistic update
    const newData = [...data];
    newData[txIndex] = updatedTx;
    setData(newData);

    try {
      // Encrypt & Save (Upsert) using the uniqueId for vault targeting
      const aad = new TextEncoder().encode('transaction');
      const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      // TODO: Ensure saveEncryptedItems uses upsertMode=true?
      // I didn't verify if I exposed upsertMode in saveEncryptedItems.
      // Let's assume it does OR I need to add a wrapper action for updates.
      // CURRENTLY: saveEncryptedItems calls createVaultItemsBulk without 2nd arg -> Default false (DO NOTHING)
      // I need to update saveEncryptedItems to accept upsertMode or create new action.

      // For now, I will create a new Server Action for updating transactions or modify existing one.
      // Since I can't modify the server action in this same artifact, I'll rely on a future fix or 
      // optimistically assume I'll fix the server action in the next step.
      // I will create `updateEncryptedItem` in server actions in next step.
      // const { updateEncryptedItem } = await import('@/src/server/actions/transactions'); // New action I need to create

      await updateEncryptedItem('transaction', {
        uniqueId: tx.uniqueId,
        ciphertextBase64,
        ivBase64,
        aadBase64
      });

      toast({ title: "Updated", description: "Category assigned." });
    } catch (e) {
      console.error(e);
      toast({ title: "Update Failed", variant: "destructive" });
      // Revert
      loadTransactions();
    }
  };

  const applyAllSuggestions = async () => {
    if (!data || !patterns.length || !dek) return;

    setIsLoading(true);
    let count = 0;
    const newData = [...data];

    try {
      const payloads: any[] = [];
      for (let i = 0; i < newData.length; i++) {
        const tx = newData[i];
        if (!tx.categoryId) {
          const suggestedId = matchTransaction(tx, patterns);
          if (suggestedId) {
            const updatedTx = { ...tx, categoryId: suggestedId };
            newData[i] = updatedTx;

            // Encrypt
            const aad = new TextEncoder().encode('transaction');
            const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
            const aadBase64 = btoa(String.fromCharCode(...aad));

            payloads.push({
              uniqueId: tx.uniqueId,
              ciphertextBase64,
              ivBase64,
              aadBase64
            });
            count++;
          }
        }
      }

      if (payloads.length > 0) {
        // Deduplicate payloads by uniqueId to prevent Postgres conflict error in batch
        const uniquePayloads = Array.from(
          new Map(payloads.map(p => [p.uniqueId, p])).values()
        );
        await saveEncryptedItems('transaction', uniquePayloads, true);
      }

      setData(newData as (TransactionRow & { id: string, uniqueId: string })[]);
      toast({ title: "Rules Applied", description: `Automatically categorized ${count} transactions.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error applying rules", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryName = (id?: string) => {
    if (!id) return null;
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : id;
  };

  // Client-side pagination
  const paginatedData = data ? data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) : [];
  const totalPages = data ? Math.ceil(data.length / ITEMS_PER_PAGE) : 1;

  if (isLoading && !data) {
    return (
      <ProtectedVaultContent>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Decrypting vault...</span>
        </div>
      </ProtectedVaultContent>
    );
  }

  return (
    <ProtectedVaultContent>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground">{data ? data.length : 0} items found</p>
          </div>
          <div className="flex gap-2">
            {patterns.length > 0 && data?.some(d => !d.categoryId && matchTransaction(d, patterns)) && (
              <Button
                variant="outline"
                size="sm"
                className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary transition-all"
                onClick={applyAllSuggestions}
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Apply Rules to Uncategorized
              </Button>
            )}
          </div>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Manage your transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const allAccountIds = new Set(data?.map(d => d.accountId).filter(Boolean) || []);
                  return paginatedData.map((row, i) => {
                    const amount = parseFloat(row.amount.replace(/[^0-9.-]/g, ""));
                    const isTransfer = row.counterparty && allAccountIds.has(row.counterparty);
                    const type = isTransfer ? 'transfer' : (amount > 0 ? 'income' : 'expense');
                    const category = categories.find(c => c.id === row.categoryId);

                    return (
                      <TableRow key={row.uniqueId || i}>
                        <TableCell className="font-medium whitespace-nowrap">{row.bookingDate}</TableCell>
                        <TableCell className="max-w-xs truncate" title={row.description}>{row.description}</TableCell>
                        <TableCell className={amount < 0 ? 'text-red-500 font-mono' : 'text-green-600 font-mono'}>
                          {row.amount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={type === 'transfer' ? 'outline' : (type === 'income' ? 'default' : 'secondary')}
                            className={cn(
                              "capitalize text-[10px] px-1.5 py-0 font-medium",
                              type === 'income' && "bg-green-50 text-green-700 border-green-200 hover:bg-green-50",
                              type === 'expense' && "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
                              type === 'transfer' && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50"
                            )}
                          >
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-56">
                          <div className="flex items-center gap-2">
                            {category && (
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: category.color }}
                              />
                            )}
                            <select
                              className={cn(
                                "w-full text-xs h-8 border rounded-md px-2 focus:bg-background transition-colors",
                                !row.categoryId ? "bg-muted/30 italic" : "bg-muted/30"
                              )}
                              value={row.categoryId || ''}
                              onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                            >
                              <option value="">Uncategorized</option>
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            {!row.categoryId && (() => {
                              const suggestedId = matchTransaction(row, patterns);
                              if (suggestedId) {
                                const suggestedCat = categories.find(c => c.id === suggestedId);
                                return (
                                  <button
                                    onClick={() => handleCategoryChange(row.id, suggestedId)}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-all shrink-0"
                                    title={`Suggested: ${suggestedCat?.name}`}
                                  >
                                    <Sparkles className="w-3 h-3 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase">{suggestedCat?.name}</span>
                                    <Check className="w-3 h-3" />
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.accountId ? <Badge variant="outline" className="text-[10px] font-mono">{row.accountId}</Badge> : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {/* Empty State */}
                {paginatedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No transactions found. Upload a CSV to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">Page {page} of {totalPages}</span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedVaultContent>
  );
}

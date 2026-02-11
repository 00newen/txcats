'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, Calendar, Tag, Info, X, Layers } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { decryptData, encryptData } from '@/src/crypto/encryption';
import { TransactionRow } from '@/src/features/upload/types';
import { CategoryItem } from '@/src/features/categories/types';
import { fetchTransactions, updateEncryptedItem } from '@/src/server/actions/transactions';
import { fetchCategories } from '@/src/server/actions/categories';
import { fetchPatterns } from '@/src/server/actions/patterns';
import { matchTransaction, findMatchingPattern } from '@/src/features/patterns/utils/engine';
import { PatternItem } from '@/src/features/patterns/types';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRef } from 'react';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';
import { useUser } from '@clerk/nextjs';

export default function TransactionsPage() {
  const { dek } = useVault();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { amountFormat } = useAmountFormat();
  const { isSignedIn } = useUser();

  const [data, setData] = useState<(TransactionRow & { id: string; uniqueId: string })[] | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Detail Modal
  const [selectedTx, setSelectedTx] = useState<(TransactionRow & { id: string; uniqueId: string }) | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openedFromQueryRef = useRef<string>('');

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
          const plain = (await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad)) as CategoryItem;
          decrypted.push(plain);
        } catch {}
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
        } catch {}
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
        throw new Error(response.error || 'Failed to fetch');
      }

      const items = response.items;
      const decryptedItems: (TransactionRow & { uniqueId: string; id: string })[] = [];

      for (const item of items) {
        try {
          // Decode stored AAD
          const aadBytes = new Uint8Array(
            atob(item.aadBase64)
              .split('')
              .map((c) => c.charCodeAt(0)),
          );

          const plaintext = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aadBytes);
          // Store ID for local state tracking and uniqueId for vault updates
          decryptedItems.push({ ...(plaintext as TransactionRow), id: item.id, uniqueId: item.uniqueId || '' });
        } catch (err) {
          console.error(`Failed to decrypt item ${item.id}`, err);
        }
      }

      // Sort by date desc
      decryptedItems.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());

      setData(decryptedItems);
    } catch (e) {
      setError('Could not load transactions');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      Promise.all([loadCategories(), loadPatterns(), loadTransactions()]);
    } else {
      setIsLoading(false);
      setData([]);
    }
  }, [dek, loadCategories, loadPatterns, loadTransactions]);

  useEffect(() => {
    const nextStart = searchParams.get('startDate') || '';
    const nextEnd = searchParams.get('endDate') || '';
    const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    const safeStart = isDate(nextStart) ? nextStart : '';
    const safeEnd = isDate(nextEnd) ? nextEnd : '';

    if (safeStart && safeEnd && safeStart > safeEnd) {
      setStartDate(safeEnd);
      setEndDate(safeStart);
    } else {
      setStartDate(safeStart);
      setEndDate(safeEnd);
    }
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const txId = searchParams.get('txId') || '';
    const txDate = searchParams.get('txDate') || '';
    const txAmount = searchParams.get('txAmount') || '';
    const txDesc = searchParams.get('txDesc') || '';
    const queryKey = `${txId}|${txDate}|${txAmount}|${txDesc}`;

    if (queryKey === '|||') return;
    if (openedFromQueryRef.current === queryKey) return;

    let target = txId ? data.find((tx) => tx.uniqueId === txId) : undefined;
    if (!target) {
      target = data.find((tx) => {
        if (txDate && tx.bookingDate !== txDate) return false;
        if (txAmount && tx.amount !== txAmount) return false;
        if (txDesc && tx.description !== txDesc) return false;
        return !!txDate || !!txAmount || !!txDesc;
      });
    }

    if (target) {
      setSelectedTx(target);
      setIsModalOpen(true);
      openedFromQueryRef.current = queryKey;
    }
  }, [data, searchParams]);

  const handleCategoryChange = async (id: string, newCategoryId: string) => {
    if (!data || !dek) return;

    const txIndex = data.findIndex((d) => d.id === id);
    if (txIndex === -1) return;

    const tx = data[txIndex];
    const updatedTx = { ...tx, categoryId: newCategoryId || undefined };

    // Optimistic update
    const newData = [...data];
    newData[txIndex] = updatedTx;
    setData(newData);

    try {
      const aad = new TextEncoder().encode('transaction');
      const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await updateEncryptedItem('transaction', {
        uniqueId: tx.uniqueId,
        ciphertextBase64,
        ivBase64,
        aadBase64,
      });

      // Notify sidebar to refresh count
      window.dispatchEvent(new CustomEvent('tx-count-changed'));

      toast({ title: 'Updated', description: 'Category assigned.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Update Failed', variant: 'destructive' });
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

            const aad = new TextEncoder().encode('transaction');
            const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
            const aadBase64 = btoa(String.fromCharCode(...aad));

            payloads.push({
              uniqueId: tx.uniqueId,
              ciphertextBase64,
              ivBase64,
              aadBase64,
            });
            count++;
          }
        }
      }

      if (payloads.length > 0) {
        const uniquePayloads = Array.from(new Map(payloads.map((p) => [p.uniqueId, p])).values());
        await saveEncryptedItems('transaction', uniquePayloads, true);
      }

      setData(newData as (TransactionRow & { id: string; uniqueId: string })[]);

      // Notify sidebar to refresh count
      window.dispatchEvent(new CustomEvent('tx-count-changed'));

      toast({ title: 'Rules Applied', description: `Automatically categorized ${count} transactions.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error applying rules', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side filtering
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((tx) => {
      // Category Filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized' && tx.categoryId) return false;
        if (categoryFilter !== 'uncategorized' && tx.categoryId !== categoryFilter) return false;
      }

      // Date Filters
      if (startDate && tx.bookingDate < startDate) return false;
      if (endDate && tx.bookingDate > endDate) return false;

      return true;
    });
  }, [data, categoryFilter, startDate, endDate]);

  const paginatedData = filteredData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  const resetFilters = () => {
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const openTxDetail = (tx: TransactionRow & { id: string; uniqueId: string }) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  if (isLoading && !data && isSignedIn) {
    return (
      <ProtectedVaultContent>
        <div className='flex justify-center items-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          <span className='ml-2 text-muted-foreground'>Decrypting vault...</span>
        </div>
      </ProtectedVaultContent>
    );
  }

  return (
    <ProtectedVaultContent>
      <div className='container mx-auto p-6 space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <h1 className='text-3xl font-bold tracking-tight'>Transactions</h1>
            <p className='text-sm text-muted-foreground'>{filteredData.length} items found</p>
          </div>
          <div className='flex gap-2'>
            {patterns.length > 0 && data?.some((d) => !d.categoryId && matchTransaction(d, patterns)) && (
              <Button
                variant='outline'
                size='sm'
                className='bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary transition-all'
                onClick={applyAllSuggestions}
                disabled={isLoading}
              >
                <Sparkles className='w-4 h-4 mr-2' />
                Apply Rules to Uncategorized
              </Button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <Card className='bg-muted/30 border-none shadow-none'>
          <CardContent className='pt-6 pb-6 space-y-4'>
            <div className='flex flex-wrap items-end gap-4'>
              <div className='space-y-1.5 flex-1 min-w-[200px]'>
                <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1'>
                  Category
                </Label>
                <div className='relative'>
                  <Tag className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none' />
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setPage(1);
                    }}
                    className='flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <option value='all'>All Categories</option>
                    <option value='uncategorized'>Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='space-y-1.5 w-44'>
                <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1'>
                  From
                </Label>
                <div className='relative'>
                  <Calendar className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none' />
                  <Input
                    type='date'
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className='pl-9'
                  />
                </div>
              </div>

              <div className='space-y-1.5 w-44'>
                <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1'>To</Label>
                <div className='relative'>
                  <Calendar className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none' />
                  <Input
                    type='date'
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className='pl-9'
                  />
                </div>
              </div>

              <Button
                variant='ghost'
                size='icon'
                onClick={resetFilters}
                className='h-10 w-10 shrink-0'
                title='Reset Filters'
              >
                <X className='w-4 h-4' />
              </Button>
            </div>

            {(categoryFilter !== 'all' || startDate || endDate) && (
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-bold text-muted-foreground uppercase'>Active Filters:</span>
                {categoryFilter !== 'all' && (
                  <Badge variant='secondary' className='text-[9px] h-5'>
                    Category:{' '}
                    {categoryFilter === 'uncategorized'
                      ? 'Uncategorized'
                      : categories.find((c) => c.id === categoryFilter)?.name}
                  </Badge>
                )}
                {startDate && (
                  <Badge variant='secondary' className='text-[9px] h-5'>
                    From: {startDate}
                  </Badge>
                )}
                {endDate && (
                  <Badge variant='secondary' className='text-[9px] h-5'>
                    To: {endDate}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className='text-red-500 font-medium p-4 bg-red-50 rounded-lg border border-red-100'>{error}</div>
        )}

        <Card className={cn('transition-opacity', !isLoading && 'animate-in fade-in-50')}>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Manage your transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant / Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const allAccountIds = new Set(data?.map((d) => d.accountId).filter(Boolean) || []);
                  return paginatedData.map((row, i) => {
                    const amount = parseAmount(row.amount);
                    const isTransfer = row.counterparty && allAccountIds.has(row.counterparty);
                    const type = isTransfer ? 'transfer' : amount > 0 ? 'income' : 'expense';
                    const category = categories.find((c) => c.id === row.categoryId);

                    return (
                      <TableRow
                        key={row.uniqueId || i}
                        className='cursor-pointer hover:bg-muted/50 transition-colors group'
                        onClick={() => openTxDetail(row)}
                      >
                        <TableCell className='font-medium whitespace-nowrap'>{row.bookingDate}</TableCell>
                        <TableCell className='font-bold relative'>
                          <div className='flex items-center gap-2 text-sm'>
                            <span className='truncate max-w-[150px]'>{row.merchantOrName || '-'}</span>
                            <Info className='w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0' />
                          </div>
                        </TableCell>
                        <TableCell
                          className='max-w-xs truncate text-[10px] text-muted-foreground'
                          title={row.description}
                        >
                          {row.description}
                        </TableCell>
                        <TableCell
                          className={amount < 0 ? 'text-red-500 font-mono text-sm' : 'text-green-600 font-mono text-sm'}
                        >
                          {isNaN(amount) ? row.amount : `${amount >= 0 ? '+' : '-'}$${formatAmount(Math.abs(amount), amountFormat)}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={type === 'transfer' ? 'outline' : type === 'income' ? 'default' : 'secondary'}
                            className={cn(
                              'capitalize text-[9px] px-1.5 py-0 font-medium',
                              type === 'income' && 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50',
                              type === 'expense' && 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50',
                              type === 'transfer' && 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
                            )}
                          >
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell className='w-56'>
                          <div className='flex items-center gap-2'>
                            {category && (
                              <div
                                className='w-2 h-2 rounded-full shrink-0'
                                style={{ backgroundColor: category.color }}
                              />
                            )}
                            <select
                              className={cn(
                                'w-full text-[11px] h-7 border rounded px-1.5 focus:bg-background transition-colors',
                                !row.categoryId ? 'bg-muted/30 italic' : 'bg-muted/30',
                              )}
                              value={row.categoryId || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleCategoryChange(row.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value=''>Uncategorized</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {!row.categoryId &&
                              (() => {
                                const suggestedId = matchTransaction(row, patterns);
                                if (suggestedId) {
                                  const suggestedCat = categories.find((c) => c.id === suggestedId);
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCategoryChange(row.id, suggestedId);
                                      }}
                                      className='flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-all shrink-0'
                                      title={`Suggested: ${suggestedCat?.name}`}
                                    >
                                      <Sparkles className='w-2.5 h-2.5 animate-pulse' />
                                      <Check className='w-2.5 h-2.5' />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.accountId ? (
                            <Badge variant='outline' className='text-[9px] font-mono px-1'>
                              {row.accountId}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {/* Empty State */}
                {paginatedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className='text-center py-12 text-muted-foreground'>
                      <div className='flex flex-col items-center gap-2'>
                        <Layers className='w-8 h-8 opacity-20' />
                        <p>No transactions match your current filters.</p>
                        <Button variant='link' size='sm' onClick={resetFilters}>
                          Clear Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className='flex justify-center mt-6 gap-2'>
                <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <div className='flex items-center px-4 text-sm text-muted-foreground'>
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle className='text-2xl font-black'>Transaction Details</DialogTitle>
              <DialogDescription>Full structural and metadata view from your secure vault.</DialogDescription>
            </DialogHeader>

            {selectedTx && (
              <div className='space-y-6 pt-4'>
                {/* Header Info */}
                <div className='flex justify-between items-start border-b pb-6'>
                  <div className='space-y-1'>
                    <h3 className='text-lg font-bold'>{selectedTx.merchantOrName || 'Unnamed Transaction'}</h3>
                    <p className='text-sm text-muted-foreground font-mono'>{selectedTx.bookingDate}</p>
                  </div>
                  <div
                    className={cn(
                      'text-2xl font-black font-mono',
                      parseAmount(selectedTx.amount) < 0 ? 'text-red-500' : 'text-green-600',
                    )}
                  >
                    {(() => {
                      const parsed = parseAmount(selectedTx.amount);
                      if (isNaN(parsed)) return selectedTx.amount;
                      return `${parsed >= 0 ? '+' : '-'}$${formatAmount(Math.abs(parsed), amountFormat)}`;
                    })()}
                  </div>
                </div>

                {/* Automation Context */}
                {selectedTx.categoryId && (
                  <div className='bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs font-bold text-primary uppercase tracking-wider'>Current Category</span>
                      <Badge className='bg-primary/20 text-primary hover:bg-primary/30 border-none'>
                        {categories.find((c) => c.id === selectedTx.categoryId)?.name}
                      </Badge>
                    </div>

                    {(() => {
                      const pattern = findMatchingPattern(selectedTx, patterns);
                      if (pattern) {
                        return (
                          <div className='pt-2 border-t border-primary/10'>
                            <div className='flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mb-2'>
                              <Sparkles className='w-3 h-3 text-primary' />
                              Automation Rule Applied
                            </div>
                            <div className='grid grid-cols-2 gap-4 text-sm'>
                              <div>
                                <p className='text-[10px] text-muted-foreground uppercase font-bold'>Match String</p>
                                <p className='font-mono bg-background px-2 py-1 rounded border mt-1'>
                                  {pattern.matchString}
                                </p>
                              </div>
                              <div>
                                <p className='text-[10px] text-muted-foreground uppercase font-bold'>Match Type</p>
                                <p className='capitalize mt-1'>{pattern.matchType}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p className='text-xs text-muted-foreground italic pt-2 border-t border-primary/10'>
                          This transaction was categorized manually.
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Detailed Data */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  <div className='space-y-4'>
                    <div>
                      <h4 className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                        Description / Memo
                      </h4>
                      <div className='text-sm bg-muted/30 p-3 rounded-lg border whitespace-pre-wrap'>
                        {selectedTx.description}
                      </div>
                    </div>

                    {selectedTx.accountId && (
                      <div>
                        <h4 className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                          Account ID
                        </h4>
                        <div className='text-sm font-mono'>{selectedTx.accountId}</div>
                      </div>
                    )}
                  </div>

                  <div className='space-y-4'>
                    {selectedTx.extraColumns && Object.keys(selectedTx.extraColumns).length > 0 && (
                      <div>
                        <h4 className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                          Custom Columns
                        </h4>
                        <div className='space-y-2'>
                          {Object.entries(selectedTx.extraColumns).map(([key, value]) => (
                            <div key={key} className='flex justify-between text-xs border-b border-dashed pb-1'>
                              <span className='font-medium text-muted-foreground'>{key}</span>
                              <span className='font-bold'>{value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                        Security Metadata
                      </h4>
                      <p className='text-[9px] text-muted-foreground break-all font-mono bg-muted/10 p-2 rounded'>
                        VaultID: {selectedTx.uniqueId}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw CSV Data */}
                <div className='pt-4 mt-6 border-t font-mono'>
                  <h4 className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3'>
                    Original CSV Data (Decrypted)
                  </h4>
                  <div className='bg-muted p-4 rounded-lg text-[11px] overflow-auto max-h-40 border shadow-inner'>
                    <pre>{JSON.stringify(selectedTx.rawRow, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedVaultContent>
  );
}

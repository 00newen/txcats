'use client';

import { useVault } from '@/auth/VaultProvider';
import { ProtectedVaultContent } from '@/auth/ProtectedVaultContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, Calendar, Tag, Info, X, Layers } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TransactionRow } from '@/features/upload/types';
import { CategoryItem } from '@/features/categories/types';
import { updateEncryptedItem } from '@/server/actions/transactions';
import { findMatchingPattern, matchTransaction } from '@/features/patterns/utils/engine';
import { PatternItem } from '@/features/patterns/types';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRef } from 'react';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';
import { useUser } from '@clerk/nextjs';
import { loadCategories, loadPatterns, loadTransactions } from '@/lib/vault/loaders';
import { dedupeEncryptedPayloads, encryptResourceItem } from '@/lib/vault/resources';
import { filterTransactions, isDateOnly, normalizeCategoryFilter, normalizeDateRange } from '@/features/transactions/utils/filters';
import { unwrap } from '@/lib/actions/result';

export default function TransactionsPage() {
  const { dek } = useVault();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
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
  const isHydratingFiltersFromUrlRef = useRef(true);

  // Pagination / Filter states in client for now
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Load Categories
  const loadCategoryData = useCallback(async () => {
    if (!dek) return;
    const result = await loadCategories(dek);
    setCategories(result.items as CategoryItem[]);
  }, [dek]);

  const loadPatternData = useCallback(async () => {
    if (!dek) return;
    const result = await loadPatterns(dek);
    setPatterns(result.items as PatternItem[]);
  }, [dek]);

  const loadTransactionData = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadTransactions(dek);
      setData(result.items);
    } catch (e) {
      setError('Could not load transactions');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      Promise.all([loadCategoryData(), loadPatternData(), loadTransactionData()]);
    } else {
      setIsLoading(false);
      setData([]);
    }
  }, [dek, loadCategoryData, loadPatternData, loadTransactionData]);

  useEffect(() => {
    isHydratingFiltersFromUrlRef.current = true;

    const nextCategory = searchParams.get('category') || '';
    const nextStart = searchParams.get('startDate') || '';
    const nextEnd = searchParams.get('endDate') || '';

    const safeCategory = normalizeCategoryFilter(nextCategory);
    const safeStart = isDateOnly(nextStart) ? nextStart : '';
    const safeEnd = isDateOnly(nextEnd) ? nextEnd : '';

    const normalizedRange = normalizeDateRange(safeStart, safeEnd);
    setCategoryFilter(safeCategory);
    setStartDate(normalizedRange.startDate);
    setEndDate(normalizedRange.endDate);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const currentCategory = normalizeCategoryFilter(searchParams.get('category') || '');
    const currentStart = isDateOnly(searchParams.get('startDate') || '') ? searchParams.get('startDate') || '' : '';
    const currentEnd = isDateOnly(searchParams.get('endDate') || '') ? searchParams.get('endDate') || '' : '';
    const nextCategory = normalizeCategoryFilter(categoryFilter);
    const nextStart = isDateOnly(startDate) ? startDate : '';
    const nextEnd = isDateOnly(endDate) ? endDate : '';

    if (isHydratingFiltersFromUrlRef.current) {
      if (nextCategory !== currentCategory || nextStart !== currentStart || nextEnd !== currentEnd) return;
      isHydratingFiltersFromUrlRef.current = false;
      return;
    }

    if (nextCategory === currentCategory && nextStart === currentStart && nextEnd === currentEnd) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextCategory !== 'all') params.set('category', nextCategory);
    else params.delete('category');

    if (nextStart) params.set('startDate', nextStart);
    else params.delete('startDate');

    if (nextEnd) params.set('endDate', nextEnd);
    else params.delete('endDate');

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [categoryFilter, startDate, endDate, pathname, router, searchParams]);

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
      const payload = await encryptResourceItem('transaction', updatedTx, dek, tx.uniqueId);
      unwrap(await updateEncryptedItem('transaction', payload));

      // Notify sidebar to refresh count
      window.dispatchEvent(new CustomEvent('tx-count-changed'));

      toast({ title: 'Updated', description: 'Category assigned.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Update Failed', variant: 'destructive' });
      loadTransactionData();
    }
  };

  const applyAllSuggestions = async () => {
    if (!data || !patterns.length || !dek) return;

    setIsLoading(true);
    let count = 0;
    const newData = [...data];

    try {
      const payloads = [];
      for (let i = 0; i < newData.length; i++) {
        const tx = newData[i];
        if (!tx.categoryId) {
          const suggestedId = matchTransaction(tx, patterns);
          if (suggestedId) {
            const updatedTx = { ...tx, categoryId: suggestedId };
            newData[i] = updatedTx;
            payloads.push(await encryptResourceItem('transaction', updatedTx, dek, tx.uniqueId));
            count++;
          }
        }
      }

      if (payloads.length > 0) {
        unwrap(await saveEncryptedItems('transaction', dedupeEncryptedPayloads(payloads), true));
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
    return filterTransactions(data, { categoryFilter, startDate, endDate });
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

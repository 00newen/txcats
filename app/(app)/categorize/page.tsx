'use client';

import { useVault } from '@/auth/VaultProvider';
import { ProtectedVaultContent } from '@/auth/ProtectedVaultContent';
import { getAccountDisplay } from '@/features/accounts/utils/display';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Zap,
  Search,
  ArrowLeft,
  Layers,
  Plus,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TransactionRow } from '@/features/upload/types';
import { CategoryItem } from '@/features/categories/types';
import {
  PATTERN_MATCH_FIELDS,
  PATTERN_MATCH_FIELD_LABELS,
  PatternItem,
  type PatternCondition,
  type PatternConditionMode,
} from '@/features/patterns/types';
import { updateEncryptedItem } from '@/server/actions/transactions';
import { matchTransaction, matchesPattern } from '@/features/patterns/utils/engine';
import { createPatternFromConditions, createSingleConditionPattern } from '@/features/patterns/utils/model';
import { PATTERN_AMOUNT_OPERATORS, PATTERN_TEXT_OPERATORS, type PatternAmountOperator, type PatternTextOperator } from '@/features/patterns/types';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';
import { useUser } from '@clerk/nextjs';
import { CATEGORY_ICON_MAP } from '@/features/categories/utils/icons';
import { loadAccounts, loadCategories, loadPatterns, loadTransactions } from '@/lib/vault/loaders';
import { dedupeEncryptedPayloads, encryptResourceItem, type AccountItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PatternDraftCondition = {
  id: string;
  field: (typeof PATTERN_MATCH_FIELDS)[number];
  operator: PatternTextOperator | PatternAmountOperator;
  value: string;
  secondaryValue: string;
};

export default function CategorizePage() {
  const { dek } = useVault();
  const { toast } = useToast();
  const { amountFormat } = useAmountFormat();
  const { isSignedIn } = useUser();

  const [transactions, setTransactions] = useState<(TransactionRow & { id: string; uniqueId: string })[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<{ tx: TransactionRow & { id: string; uniqueId: string }; index: number }[]>(
    [],
  );
  const [recentCategorized, setRecentCategorized] = useState<
    { tx: TransactionRow & { id: string; uniqueId: string }; categoryId: string; categorizedAt: number }[]
  >([]);
  const [displayTx, setDisplayTx] = useState<(TransactionRow & { id: string; uniqueId: string }) | null>(null);
  const [txAnimationPhase, setTxAnimationPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const txAnimationTimeoutRef = useRef<number | null>(null);

  // Category Navigation & Search
  const [navPath, setNavPath] = useState<CategoryItem[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const currentParentId = navPath[navPath.length - 1]?.id || null;
  const currentParentCategory = navPath[navPath.length - 1] || null;

  // Pattern Dialog State
  const [isPatternDialogOpen, setIsPatternDialogOpen] = useState(false);
  const [patternMatchText, setPatternMatchText] = useState('');
  const [patternMatchSecondaryValue, setPatternMatchSecondaryValue] = useState('');
  const [patternCategory, setPatternCategory] = useState('');
  const [patternMatchType, setPatternMatchType] = useState<PatternTextOperator | PatternAmountOperator>('contains');
  const [patternMatchField, setPatternMatchField] = useState<(typeof PATTERN_MATCH_FIELDS)[number]>('descriptionOrName');
  const [isPatternAdvancedOpen, setIsPatternAdvancedOpen] = useState(false);
  const [patternConditionMode, setPatternConditionMode] = useState<PatternConditionMode>('all');
  const [additionalPatternConditions, setAdditionalPatternConditions] = useState<PatternDraftCondition[]>([]);
  const isAmountPatternField = patternMatchField === 'amount';
  const amountPatternNeedsSecondaryValue = patternMatchType === 'between';
  const emitTxCountChanged = () => window.dispatchEvent(new CustomEvent('tx-count-changed'));

  // Load Data
  const loadData = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    try {
      const [accountResult, categoryResult, patternResult, transactionResult] = await Promise.all([
        loadAccounts(dek),
        loadCategories(dek),
        loadPatterns(dek),
        loadTransactions(dek, { uncategorizedOnly: true }),
      ]);
      setAccounts(accountResult.items as AccountItem[]);
      setCategories(categoryResult.items as CategoryItem[]);
      setPatterns(patternResult.items as PatternItem[]);
      setTransactions(transactionResult.items);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [dek, toast]);

  useEffect(() => {
    if (dek) {
      loadData();
    } else {
      setIsLoading(false);
      setAccounts([]);
      setTransactions([]);
      setCategories([]);
      setPatterns([]);
    }
  }, [dek, loadData]);

  // Restore persistence
  useEffect(() => {
    const saved = localStorage.getItem('categorize-index');
    if (saved && transactions.length > 0) {
      const idx = parseInt(saved, 10);
      if (idx < transactions.length) {
        setCurrentIndex(idx);
      }
    }
  }, [transactions.length > 0]);

  // Save persistence
  useEffect(() => {
    localStorage.setItem('categorize-index', currentIndex.toString());
  }, [currentIndex]);

  const currentTx = transactions[currentIndex];
  const txForDisplay = displayTx || currentTx || null;
  const isTxAnimating = txAnimationPhase !== 'idle';
  const accountDisplay = useMemo(() => getAccountDisplay(accounts, txForDisplay?.accountId), [accounts, txForDisplay?.accountId]);

  useEffect(() => {
    return () => {
      if (txAnimationTimeoutRef.current) {
        window.clearTimeout(txAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentTx) {
      setDisplayTx(null);
      setTxAnimationPhase('idle');
      return;
    }

    if (!displayTx) {
      setDisplayTx(currentTx);
      setTxAnimationPhase('in');
      if (txAnimationTimeoutRef.current) {
        window.clearTimeout(txAnimationTimeoutRef.current);
      }
      txAnimationTimeoutRef.current = window.setTimeout(() => setTxAnimationPhase('idle'), 220);
      return;
    }

    if (displayTx.id === currentTx.id) return;

    setTxAnimationPhase('out');
    if (txAnimationTimeoutRef.current) {
      window.clearTimeout(txAnimationTimeoutRef.current);
    }

    txAnimationTimeoutRef.current = window.setTimeout(() => {
      setDisplayTx(currentTx);
      setTxAnimationPhase('in');
      txAnimationTimeoutRef.current = window.setTimeout(() => setTxAnimationPhase('idle'), 220);
    }, 170);
  }, [currentTx?.id, currentTx, displayTx]);

  const handleCategorize = async (categoryId: string) => {
    if (!currentTx || !dek) return;
    // Always reset category navigation to top-level for the next transaction.
    setNavPath([]);
    setCatSearch('');
    setHistory((prev) => [{ tx: currentTx, index: currentIndex }, ...prev].slice(0, 50));

    try {
      const updatedTx = { ...currentTx, categoryId };
      const payload = await encryptResourceItem('transaction', updatedTx, dek, currentTx.uniqueId);
      unwrap(await updateEncryptedItem('transaction', payload));

      const newTxs = transactions.filter((t) => t.id !== currentTx.id);
      setTransactions(newTxs);
      setRecentCategorized((prev) =>
        [{ tx: currentTx, categoryId, categorizedAt: Date.now() }, ...prev.filter((item) => item.tx.id !== currentTx.id)].slice(0, 10),
      );
      if (currentIndex >= newTxs.length && currentIndex > 0) {
        setCurrentIndex(newTxs.length - 1);
      }
      emitTxCountChanged();
      toast({ title: 'Categorized', description: updatedTx.description });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to categorize', variant: 'destructive' });
    }
  };

  const handleUndo = async () => {
    const lastEntry = history[0];
    if (!lastEntry || !dek) return;

    const { tx: lastTx, index: lastIndex } = lastEntry;

    setIsLoading(true);
    try {
      const updatedTx = { ...lastTx, categoryId: undefined };
      const payload = await encryptResourceItem('transaction', updatedTx, dek, lastTx.uniqueId);
      unwrap(await updateEncryptedItem('transaction', payload));

      // Restore to list exactly where it was
      setTransactions((prev) => {
        const next = [...prev];
        next.splice(lastIndex, 0, lastTx);
        return next;
      });
      setRecentCategorized((prev) => {
        const removeIndex = prev.findIndex((item) => item.tx.id === lastTx.id);
        if (removeIndex < 0) return prev;
        return prev.filter((_, idx) => idx !== removeIndex);
      });
      setHistory((prev) => prev.slice(1));
      setCurrentIndex(lastIndex);
      emitTxCountChanged();
      toast({ title: 'Undo successful', description: 'Transaction restored to its previous position.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Undo failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < transactions.length - 1) setCurrentIndex(currentIndex + 1);
    else setCurrentIndex(0);
  };

  const buildDraftConditionPattern = useCallback(
    (draft: PatternDraftCondition, id: string) =>
      draft.field === 'amount'
        ? createSingleConditionPattern({
            id,
            categoryId: patternCategory || '',
            field: 'amount',
            operator: draft.operator as PatternAmountOperator,
            value: draft.value,
            secondaryValue: draft.secondaryValue,
            priority: 0,
          })
        : createSingleConditionPattern({
            id,
            categoryId: patternCategory || '',
            field: draft.field,
            operator: draft.operator as PatternTextOperator,
            value: draft.value,
            priority: 0,
          }),
    [patternCategory],
  );

  const buildPatternFromDialogState = useCallback(
    (id: string): PatternItem | null => {
      const primaryDraft: PatternDraftCondition = {
        id: 'primary',
        field: patternMatchField,
        operator: patternMatchType,
        value: patternMatchText,
        secondaryValue: patternMatchSecondaryValue,
      };

      if (!primaryDraft.value.trim()) return null;
      if (primaryDraft.field === 'amount' && primaryDraft.operator === 'between' && !primaryDraft.secondaryValue.trim()) return null;

      if (!isPatternAdvancedOpen || additionalPatternConditions.length === 0) {
        return buildDraftConditionPattern(primaryDraft, id);
      }

      if (primaryDraft.field === 'descriptionOrName') return null;

      const drafts = [primaryDraft, ...additionalPatternConditions];
      const conditions: PatternCondition[] = [];

      for (const draft of drafts) {
        if (!draft.value.trim()) return null;
        if (draft.field === 'descriptionOrName') return null;
        if (draft.field === 'amount' && draft.operator === 'between' && !draft.secondaryValue.trim()) return null;
        const pattern = buildDraftConditionPattern(draft, `${id}-${draft.id}`);
        conditions.push(...pattern.conditions);
      }

      return createPatternFromConditions({
        id,
        categoryId: patternCategory,
        conditionMode: patternConditionMode,
        conditions,
        priority: 0,
      });
    },
    [
      additionalPatternConditions,
      buildDraftConditionPattern,
      isPatternAdvancedOpen,
      patternCategory,
      patternConditionMode,
      patternMatchField,
      patternMatchSecondaryValue,
      patternMatchText,
      patternMatchType,
    ],
  );

  const openPatternDialog = (categoryId: string) => {
    if (!currentTx) return;
    setPatternMatchText(currentTx.description);
    setPatternCategory(categoryId);
    setPatternMatchType('contains');
    setPatternMatchField('descriptionOrName');
    setPatternMatchSecondaryValue('');
    setIsPatternAdvancedOpen(false);
    setPatternConditionMode('all');
    setAdditionalPatternConditions([]);
    setIsPatternDialogOpen(true);
  };

  const handleSavePattern = async () => {
    if (!dek || !patternCategory) return;
    setIsLoading(true);
    try {
      const newPattern = buildPatternFromDialogState(crypto.randomUUID());
      if (!newPattern) return;

      const patternPayload = await encryptResourceItem('pattern', newPattern, dek, newPattern.id);
      unwrap(await saveEncryptedItems('pattern', [patternPayload]));

      const matchingTxs = transactions.filter((tx) => matchesPattern(tx, newPattern));

      const payloads = [];
      for (const tx of matchingTxs) {
        const updatedTx = { ...tx, categoryId: patternCategory };
        payloads.push(await encryptResourceItem('transaction', updatedTx, dek, tx.uniqueId));
      }

      if (payloads.length > 0) {
        unwrap(await saveEncryptedItems('transaction', dedupeEncryptedPayloads(payloads), true));
      }

      toast({
        title: 'Rule Created',
        description: `Auto-categorized ${matchingTxs.length} transactions.`,
      });
      setIsPatternDialogOpen(false);
      await loadData();
      emitTxCountChanged();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error saving rule', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const affectedTransactions = useMemo(() => {
    const previewPattern = buildPatternFromDialogState('preview');
    if (!previewPattern) return [];
    return transactions.filter((transaction) => matchesPattern(transaction, previewPattern));
  }, [buildPatternFromDialogState, transactions]);

  const affectedCount = affectedTransactions.length;
  const canSavePattern = !!buildPatternFromDialogState('validate');

  const canUseAdvancedConditions = patternMatchField !== 'descriptionOrName';

  const addAdvancedCondition = () => {
    setAdditionalPatternConditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        field: 'description',
        operator: 'contains',
        value: '',
        secondaryValue: '',
      },
    ]);
  };

  const updateAdvancedCondition = (
    id: string,
    updater: (condition: PatternDraftCondition) => PatternDraftCondition,
  ) => {
    setAdditionalPatternConditions((prev) => prev.map((condition) => (condition.id === id ? updater(condition) : condition)));
  };

  const removeAdvancedCondition = (id: string) => {
    setAdditionalPatternConditions((prev) => prev.filter((condition) => condition.id !== id));
  };

  const displayedCategories = useMemo(() => {
    if (catSearch.trim()) {
      return categories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()));
    }
    return categories.filter((c) => (!currentParentId ? !c.parentId : c.parentId === currentParentId));
  }, [categories, currentParentId, catSearch]);

  const handleCategoryClick = (cat: CategoryItem) => {
    const hasChildren = categories.some((c) => c.parentId === cat.id);
    if (hasChildren && !catSearch) {
      setNavPath((prev) => [...prev, cat]);
    } else {
      handleCategorize(cat.id);
    }
  };

  const jumpTo = (i: number) => {
    if (i === -1) setNavPath([]);
    else setNavPath((prev) => prev.slice(0, i + 1));
  };

  if (isSignedIn && transactions.length === 0 && !isLoading) {
    return (
      <ProtectedVaultContent>
        <div className='container mx-auto p-6 max-w-7xl'>
          <Card className='border-dashed border-2 bg-muted/20'>
            <CardContent className='flex flex-col items-center justify-center py-20 text-center space-y-4'>
              <div className='bg-primary/10 p-6 rounded-full'>
                <Check className='w-12 h-12 text-primary' />
              </div>
              <div className='space-y-2'>
                <h2 className='text-2xl font-bold'>All Caught Up!</h2>
                <p className='text-muted-foreground'>You've categorized everything. Great job!</p>
              </div>
              <Button asChild className='mt-4 shadow-lg px-8'>
                <Link href='/transactions'>View History</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedVaultContent>
    );
  }

  const suggestedId = txForDisplay ? matchTransaction(txForDisplay, patterns) : undefined;
  const suggestedCat = suggestedId ? categories.find((c) => c.id === suggestedId) : undefined;

  return (
    <ProtectedVaultContent>
      <div className='container mx-auto p-4 md:p-6 max-w-7xl space-y-8'>
        <div className='flex flex-col space-y-2'>
          <div className='flex items-center justify-between'>
            <h1 className='text-3xl font-bold tracking-tight'>Categorize</h1>
            <div className='flex items-center gap-3'>
              {history.length > 0 && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleUndo}
                  className='gap-2 h-9 border-2 font-bold'
                  disabled={isLoading}
                >
                  <RotateCcw className='w-4 h-4' /> Undo Last
                </Button>
              )}
              <Badge variant='outline' className='px-3 py-1 text-sm font-mono'>
                {transactions.length} items remaining
              </Badge>
            </div>
          </div>
          <p className='text-muted-foreground'>Focus on one transaction at a time.</p>
        </div>

        <div className={cn('relative min-h-[50vh] transition-opacity', !isLoading && 'animate-in fade-in-50')}>
          {isLoading && (
            <div className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-2xl'>
              <Loader2 className='w-12 h-12 animate-spin text-primary' />
              <p className='mt-4 text-sm font-medium animate-pulse uppercase tracking-tight'>Updating Vault...</p>
            </div>
          )}

          {currentTx && (
            <div className={cn('max-w-7xl mx-auto transition-all duration-500', isLoading && 'opacity-50 grayscale-[0.5]')}>
              <Card className='shadow-2xl border-t-4 border-t-primary relative overflow-hidden'>
                <CardContent className={cn('pt-10 pb-8 px-4 sm:px-8 space-y-10', isTxAnimating && 'pointer-events-none')}>
                  {/* Internal Navigation & Header */}
                  <div className='relative flex flex-col items-center text-center px-12'>
                    {/* Left Arrow */}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full'
                      onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : transactions.length - 1))}
                    >
                      <ChevronLeft className='w-8 h-8' />
                    </Button>

                    <div
                      className={cn(
                        'space-y-2 transition-all duration-200 ease-out',
                        txAnimationPhase === 'out' && 'opacity-0 -translate-y-2',
                        txAnimationPhase !== 'out' && 'opacity-100 translate-y-0',
                      )}
                    >
                      <div className='text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]'>
                        {txForDisplay?.bookingDate}
                      </div>
                      <h2 className='text-3xl md:text-4xl font-black leading-tight tracking-tighter'>
                        {txForDisplay?.merchantOrName || txForDisplay?.description}
                      </h2>
                      <div className='mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 pt-2 sm:grid-cols-2'>
                        {[
                          txForDisplay?.accountId
                            ? { label: 'Account', value: accountDisplay.label, secondary: accountDisplay.secondary }
                            : null,
                          { label: 'Name', value: txForDisplay?.merchantOrName },
                          { label: 'Description', value: txForDisplay?.description },
                          { label: 'Sender', value: txForDisplay?.sender },
                          { label: 'Recipient', value: txForDisplay?.recipient },
                          { label: 'Counterparty', value: txForDisplay?.counterparty },
                        ]
                          .filter((item): item is { label: string; value: string; secondary?: string } => !!item?.value)
                          .map((item) => (
                            <div key={item.label} className='rounded-xl border bg-muted/30 px-3 py-2 text-left shadow-sm'>
                              <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>{item.label}</p>
                              <p className='truncate text-sm font-medium'>{item.value}</p>
                              {item.secondary && <p className='truncate text-[11px] text-muted-foreground'>{item.secondary}</p>}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Right Arrow (Skip) */}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full'
                      onClick={handleSkip}
                    >
                      <ChevronRight className='w-8 h-8' />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      'flex flex-col items-center space-y-2 transition-all duration-200 ease-out',
                      txAnimationPhase === 'out' && 'opacity-0 translate-y-2',
                      txAnimationPhase !== 'out' && 'opacity-100 translate-y-0',
                    )}
                  >
                    <div
                      className={cn(
                        'text-5xl font-black font-mono tracking-tighter',
                        parseAmount(txForDisplay?.amount || '0') < 0 ? 'text-red-500' : 'text-green-600',
                      )}
                    >
                      {(() => {
                        if (!txForDisplay) return '';
                        const parsed = parseAmount(txForDisplay.amount);
                        if (isNaN(parsed)) return txForDisplay.amount;
                        return `${parsed >= 0 ? '+' : '-'}$${formatAmount(Math.abs(parsed), amountFormat)}`;
                      })()}
                    </div>
                  </div>

                  {suggestedCat && (
                    <div className='bg-primary/5 rounded-xl p-6 border border-primary/10 flex flex-col items-center space-y-4 shadow-inner'>
                      <div className='flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider'>
                        <Sparkles className='w-5 h-5 animate-pulse' /> Smart Suggestion
                      </div>
                      <Button
                        size='lg'
                        className='w-full max-w-xs shadow-lg transition-transform hover:scale-105'
                        onClick={() => handleCategorize(suggestedCat.id)}
                      >
                        Assign to <b>{suggestedCat.name}</b>
                      </Button>
                    </div>
                  )}

                  <div className='space-y-6'>
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-4 px-2'>
                      <div className='flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider'>
                        <Filter className='w-3 h-3' /> {catSearch ? 'Search Results' : 'Selection'}
                      </div>
                      <div className='relative w-full sm:w-64'>
                        <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          placeholder='Find category...'
                          className='pl-9 pr-9 h-9 rounded-lg bg-muted/60'
                          value={catSearch}
                          onChange={(e) => setCatSearch(e.target.value)}
                        />
                        {catSearch && (
                          <button
                            onClick={() => setCatSearch('')}
                            className='absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors'
                          >
                            <X className='h-4 w-4' />
                          </button>
                        )}
                      </div>
                    </div>

                    {!catSearch && (
                      <div className='flex items-center gap-1.5 px-2 overflow-x-auto py-1'>
                        <button
                          onClick={() => jumpTo(-1)}
                          className={cn(
                            'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md',
                            !currentParentId
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted',
                          )}
                        >
                          All
                        </button>
                        {navPath.map((cat, i) => (
                          <div key={cat.id} className='flex items-center gap-1.5 shrink-0'>
                            <ChevronRight className='w-3 h-3 text-muted-foreground/40' />
                            <button
                              onClick={() => jumpTo(i)}
                              className={cn(
                                'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md',
                                i === navPath.length - 1
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:bg-muted',
                              )}
                            >
                              {cat.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
                      {currentParentCategory && !catSearch && (
                        <button
                          onClick={() => handleCategorize(currentParentCategory.id)}
                          className='flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left group'
                        >
                          <div className='w-10 h-10 rounded-lg flex items-center justify-center bg-primary/15 text-primary transition-colors'>
                            <Check className='w-5 h-5' />
                          </div>
                          <div className='min-w-0'>
                            <p className='text-sm font-bold truncate'>Assign to {currentParentCategory.name}</p>
                            <p className='text-[10px] text-muted-foreground'>Use parent category directly</p>
                          </div>
                        </button>
                      )}
                      {navPath.length > 0 && !catSearch && (
                        <button
                          onClick={() => setNavPath((prev) => prev.slice(0, -1))}
                          className='flex items-center gap-3 p-3 rounded-xl border border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group'
                        >
                          <div className='w-10 h-10 rounded-lg flex items-center justify-center bg-muted/40 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors'>
                            <ArrowLeft className='w-5 h-5' />
                          </div>
                          <span className='text-sm font-bold opacity-60 group-hover:opacity-100'>Go Back</span>
                        </button>
                      )}
                      {displayedCategories.map((cat) => {
                        const Icon = CATEGORY_ICON_MAP[cat.icon] || Layers;
                        const hasChildren = categories.some((c) => c.parentId === cat.id);
                        return (
                          <div
                            key={cat.id}
                            className='flex items-center gap-1.5 p-1 rounded-xl border group transition-all relative overflow-hidden hover:shadow-md hover:border-primary/40'
                            style={{
                              background: `linear-gradient(90deg, ${cat.color}12 0%, transparent 100%)`,
                              borderColor: `${cat.color}30`,
                            }}
                          >
                            <button
                              onClick={() => handleCategoryClick(cat)}
                              className='flex-1 flex items-center gap-3 p-1.5 text-left'
                            >
                              <div
                                className='w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105'
                                style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                              >
                                <Icon className='w-5 h-5' />
                              </div>
                              <div className='flex flex-col min-w-0 justify-center flex-1'>
                                <div className='flex items-center gap-1.5'>
                                  <span className='text-sm font-bold truncate leading-tight'>{cat.name}</span>
                                  {hasChildren && !catSearch && (
                                    <ChevronRight className='w-3 h-3 text-muted-foreground opacity-40' />
                                  )}
                                </div>
                                <span className='text-[10px] text-muted-foreground leading-none'>
                                  {hasChildren && !catSearch ? 'View children' : 'Select'}
                                </span>
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPatternDialog(cat.id);
                              }}
                              className='w-10 h-10 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary opacity-40 group-hover:opacity-100 transition-all mr-1'
                              title='Create rule'
                            >
                              <Zap className='w-4 h-4' />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Dialog open={isPatternDialogOpen} onOpenChange={setIsPatternDialogOpen}>
          <DialogContent className='flex max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl'>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <Sparkles className='w-5 h-5 text-primary' /> Create Rule
              </DialogTitle>
              <DialogDescription>Automatically categorize matches.</DialogDescription>
            </DialogHeader>
            <div className='space-y-4 overflow-y-auto py-4 pr-1'>
              <div className='space-y-2'>
                <Label>{isAmountPatternField ? 'Amount' : 'Match Text'}</Label>
                <div className='flex gap-2'>
                  <Input
                    value={patternMatchText}
                    onChange={(e) => setPatternMatchText(e.target.value)}
                    placeholder={isAmountPatternField ? 'e.g. 2500' : 'Search term...'}
                    className='font-mono text-sm'
                  />
                  <div className='flex shrink-0 gap-1'>
                    {!isAmountPatternField && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => {
                          setPatternMatchText(currentTx?.description || '');
                          setPatternMatchField('description');
                        }}
                        title='Use full description'
                      >
                        Desc
                      </Button>
                    )}
                    {!isAmountPatternField && currentTx?.merchantOrName && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => {
                          setPatternMatchText(currentTx.merchantOrName || '');
                          setPatternMatchField('name');
                        }}
                        title='Use merchant name'
                      >
                        Name
                      </Button>
                    )}
                    {!isAmountPatternField && currentTx?.sender && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => {
                          setPatternMatchText(currentTx.sender || '');
                          setPatternMatchField('sender');
                        }}
                        title='Use sender'
                      >
                        Sender
                      </Button>
                    )}
                    {!isAmountPatternField && currentTx?.recipient && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => {
                          setPatternMatchText(currentTx.recipient || '');
                          setPatternMatchField('recipient');
                        }}
                        title='Use recipient'
                      >
                        Recipient
                      </Button>
                    )}
                    {isAmountPatternField && currentTx && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => setPatternMatchText(currentTx.amount)}
                        title='Use transaction amount'
                      >
                        Amt
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Field</Label>
                <select
                  className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                  value={patternMatchField}
                  onChange={(e) => {
                    const nextField = e.target.value as (typeof PATTERN_MATCH_FIELDS)[number];
                    setPatternMatchField(nextField);
                    setPatternMatchType(nextField === 'amount' ? 'eq' : 'contains');
                    setPatternMatchSecondaryValue('');
                  }}
                >
                  {PATTERN_MATCH_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {PATTERN_MATCH_FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>
              </div>
              <div className='space-y-2'>
                <Label>Operator</Label>
                <div className='flex bg-muted/80 p-1 rounded-xl gap-1'>
                  {(isAmountPatternField ? PATTERN_AMOUNT_OPERATORS : PATTERN_TEXT_OPERATORS).map((m) => (
                    <button
                      key={m}
                      type='button'
                      onClick={() => {
                        setPatternMatchType(m);
                        if (m !== 'between') setPatternMatchSecondaryValue('');
                      }}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border border-transparent',
                        patternMatchType === m
                          ? 'bg-background shadow-md text-primary border-primary/10'
                          : 'text-muted-foreground hover:bg-background/40 hover:text-foreground',
                      )}
                    >
                      {m === 'lt' ? 'Less Than' : m === 'gt' ? 'Greater Than' : m === 'eq' ? 'Exactly' : m}
                    </button>
                  ))}
                </div>
              </div>
              {amountPatternNeedsSecondaryValue && (
                <div className='space-y-2'>
                  <Label>And Amount</Label>
                  <Input
                    value={patternMatchSecondaryValue}
                    onChange={(e) => setPatternMatchSecondaryValue(e.target.value)}
                    placeholder='e.g. 3500'
                    className='font-mono text-sm'
                  />
                </div>
              )}
              <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-sm font-bold'>Advanced Rule</p>
                    <p className='text-xs text-muted-foreground'>Add extra conditions without leaving the current transaction.</p>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setIsPatternAdvancedOpen((prev) => !prev);
                      if (isPatternAdvancedOpen) {
                        setAdditionalPatternConditions([]);
                        setPatternConditionMode('all');
                      }
                    }}
                  >
                    {isPatternAdvancedOpen ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {isPatternAdvancedOpen && (
                  <div className='space-y-4'>
                    <div className='space-y-2'>
                      <Label>Rule Logic</Label>
                      <select
                        className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                        value={patternConditionMode}
                        onChange={(e) => setPatternConditionMode(e.target.value as PatternConditionMode)}
                        disabled={!canUseAdvancedConditions}
                      >
                        <option value='all'>Match all conditions</option>
                        <option value='any'>Match any condition</option>
                      </select>
                    </div>
                    {!canUseAdvancedConditions && (
                      <p className='text-xs text-muted-foreground'>
                        Change the primary field from "Description or Name" to a specific field before adding more conditions.
                      </p>
                    )}
                    {additionalPatternConditions.map((condition, index) => {
                      const isAmountCondition = condition.field === 'amount';
                      const needsSecondaryValue = condition.operator === 'between';

                      return (
                        <div key={condition.id} className='space-y-3 rounded-lg border bg-background p-3'>
                          <div className='flex items-center justify-between'>
                            <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Condition {index + 2}</p>
                            <Button type='button' variant='ghost' size='icon' onClick={() => removeAdvancedCondition(condition.id)}>
                              <X className='h-4 w-4' />
                            </Button>
                          </div>
                          <div className='grid gap-3 md:grid-cols-3'>
                            <div className='space-y-2'>
                              <Label>Field</Label>
                              <select
                                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                                value={condition.field}
                                onChange={(e) =>
                                  updateAdvancedCondition(condition.id, (current) => ({
                                    ...current,
                                    field: e.target.value as PatternDraftCondition['field'],
                                    operator: e.target.value === 'amount' ? 'eq' : 'contains',
                                    secondaryValue: '',
                                  }))
                                }
                              >
                                {PATTERN_MATCH_FIELDS.filter((field) => field !== 'descriptionOrName').map((field) => (
                                  <option key={field} value={field}>
                                    {PATTERN_MATCH_FIELD_LABELS[field]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className='space-y-2'>
                              <Label>Operator</Label>
                              <select
                                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                                value={condition.operator}
                                onChange={(e) =>
                                  updateAdvancedCondition(condition.id, (current) => ({
                                    ...current,
                                    operator: e.target.value as PatternDraftCondition['operator'],
                                    secondaryValue: e.target.value === 'between' ? current.secondaryValue : '',
                                  }))
                                }
                              >
                                {(isAmountCondition ? PATTERN_AMOUNT_OPERATORS : PATTERN_TEXT_OPERATORS).map((operator) => (
                                  <option key={operator} value={operator}>
                                    {operator === 'lt'
                                      ? 'Less Than'
                                      : operator === 'gt'
                                        ? 'Greater Than'
                                        : operator === 'eq'
                                          ? 'Exactly'
                                          : operator === 'between'
                                            ? 'Between'
                                            : operator}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className='space-y-2'>
                              <Label>{isAmountCondition ? 'Amount' : 'Value'}</Label>
                              <Input
                                value={condition.value}
                                onChange={(e) =>
                                  updateAdvancedCondition(condition.id, (current) => ({ ...current, value: e.target.value }))
                                }
                                placeholder={isAmountCondition ? 'e.g. 2500' : 'Enter value'}
                              />
                            </div>
                          </div>
                          {needsSecondaryValue && (
                            <div className='space-y-2'>
                              <Label>And Amount</Label>
                              <Input
                                value={condition.secondaryValue}
                                onChange={(e) =>
                                  updateAdvancedCondition(condition.id, (current) => ({ ...current, secondaryValue: e.target.value }))
                                }
                                placeholder='e.g. 3500'
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Button type='button' variant='outline' size='sm' onClick={addAdvancedCondition} disabled={!canUseAdvancedConditions}>
                      <Plus className='mr-2 h-4 w-4' />
                      Add Condition
                    </Button>
                  </div>
                )}
              </div>
              <div className='bg-primary/5 rounded-xl p-4 border border-primary/10 flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-primary uppercase'>Affects</p>
                  <p className='text-sm font-black'>{affectedCount} items</p>
                </div>
                <div className='text-right'>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase'>Field</p>
                  <p className='text-sm font-bold'>{PATTERN_MATCH_FIELD_LABELS[patternMatchField]}</p>
                </div>
                <div className='text-right'>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase'>Target</p>
                  <p className='text-sm font-bold'>{categories.find((c) => c.id === patternCategory)?.name}</p>
                </div>
              </div>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label>Matching Transactions</Label>
                  {affectedCount > 0 && <span className='text-[11px] text-muted-foreground'>{affectedCount} shown below</span>}
                </div>
                <div className='max-h-64 overflow-y-auto rounded-xl border bg-muted/20'>
                  {affectedTransactions.length === 0 ? (
                    <div className='px-4 py-6 text-sm text-muted-foreground'>No uncategorized transactions match this rule.</div>
                  ) : (
                    <div className='divide-y'>
                      {affectedTransactions.map((tx) => {
                        const parsedAmount = parseAmount(tx.amount);
                        const formattedAmount =
                          isNaN(parsedAmount) || !isFinite(parsedAmount)
                            ? tx.amount
                            : `${parsedAmount >= 0 ? '+' : '-'}$${formatAmount(Math.abs(parsedAmount), amountFormat)}`;

                        return (
                          <div key={tx.id} className='flex items-center justify-between gap-3 px-4 py-3'>
                            <div className='min-w-0'>
                              <p className='truncate text-sm font-semibold'>{tx.merchantOrName || tx.description}</p>
                              <p className='truncate text-[11px] text-muted-foreground'>
                                {tx.bookingDate}
                                {tx.merchantOrName ? ` • ${tx.description}` : ''}
                              </p>
                              {(tx.sender || tx.recipient) && (
                                <p className='truncate text-[11px] text-muted-foreground'>
                                  {tx.sender ? `Sender: ${tx.sender}` : ''}
                                  {tx.sender && tx.recipient ? ' • ' : ''}
                                  {tx.recipient ? `Recipient: ${tx.recipient}` : ''}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                'shrink-0 text-sm font-mono font-bold',
                                parsedAmount < 0 ? 'text-red-500' : 'text-green-600',
                              )}
                            >
                              {formattedAmount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className='border-t pt-4 gap-2 sm:gap-0'>
              <Button variant='ghost' onClick={() => setIsPatternDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePattern} disabled={isLoading || !canSavePattern}>
                {isLoading && <Loader2 className='w-4 h-4 mr-2 animate-spin' />}Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {recentCategorized.length > 0 && (
          <Card className='shadow-md border-muted/60'>
            <CardContent className='pt-5 pb-4 px-4 sm:px-6 space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-black uppercase tracking-wider'>Recently Categorized</h3>
                <span className='text-[11px] text-muted-foreground'>Last {recentCategorized.length} items</span>
              </div>
              <div className='space-y-2'>
                {recentCategorized.map((item) => {
                  const categoryName = categories.find((cat) => cat.id === item.categoryId)?.name || 'Unknown';
                  const parsedAmount = parseAmount(item.tx.amount);
                  const formattedAmount =
                    isNaN(parsedAmount) || !isFinite(parsedAmount)
                      ? item.tx.amount
                      : `${parsedAmount >= 0 ? '+' : '-'}$${formatAmount(Math.abs(parsedAmount), amountFormat)}`;

                  return (
                    <div key={`${item.tx.id}-${item.categorizedAt}`} className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold truncate'>{item.tx.merchantOrName || item.tx.description}</p>
                        <p className='text-[11px] text-muted-foreground truncate'>{item.tx.bookingDate}</p>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <Badge variant='secondary' className='font-medium'>
                          {categoryName}
                        </Badge>
                        <span
                          className={cn(
                            'text-sm font-mono font-bold',
                            parseAmount(item.tx.amount) < 0 ? 'text-red-500' : 'text-green-600',
                          )}
                        >
                          {formattedAmount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedVaultContent>
  );
}

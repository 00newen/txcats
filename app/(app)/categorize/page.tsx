'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
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
  Home,
  Plug,
  Utensils,
  Car,
  HeartPulse,
  User,
  Film,
  ShoppingBag,
  Repeat,
  Plane,
  Wallet,
  ArrowLeftRight,
  Briefcase,
  Coffee,
  Gift,
  Shirt,
  Hammer,
  Book,
  Smartphone,
  PiggyBank,
  LucideIcon,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { decryptData, encryptData } from '@/src/crypto/encryption';
import { TransactionRow } from '@/src/features/upload/types';
import { CategoryItem } from '@/src/features/categories/types';
import { PatternItem } from '@/src/features/patterns/types';
import { fetchTransactions, updateEncryptedItem } from '@/src/server/actions/transactions';
import { fetchCategories } from '@/src/server/actions/categories';
import { fetchPatterns } from '@/src/server/actions/patterns';
import { matchTransaction } from '@/src/features/patterns/utils/engine';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';
import { useUser } from '@clerk/nextjs';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  plug: Plug,
  utensils: Utensils,
  car: Car,
  'heart-pulse': HeartPulse,
  user: User,
  film: Film,
  'shopping-bag': ShoppingBag,
  repeat: Repeat,
  plane: Plane,
  wallet: Wallet,
  'arrow-left-right': ArrowLeftRight,
  layers: Layers,
  briefcase: Briefcase,
  coffee: Coffee,
  gift: Gift,
  shirt: Shirt,
  hammer: Hammer,
  book: Book,
  smartphone: Smartphone,
  'piggy-bank': PiggyBank,
};

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

export default function CategorizePage() {
  const { dek } = useVault();
  const { toast } = useToast();
  const { amountFormat } = useAmountFormat();
  const { isSignedIn } = useUser();

  const [transactions, setTransactions] = useState<(TransactionRow & { id: string; uniqueId: string })[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<{ tx: TransactionRow & { id: string; uniqueId: string }; index: number }[]>(
    [],
  );

  // Category Navigation & Search
  const [navPath, setNavPath] = useState<CategoryItem[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const currentParentId = navPath[navPath.length - 1]?.id || null;

  // Pattern Dialog State
  const [isPatternDialogOpen, setIsPatternDialogOpen] = useState(false);
  const [patternMatchText, setPatternMatchText] = useState('');
  const [patternCategory, setPatternCategory] = useState('');
  const [patternMatchType, setPatternMatchType] = useState<'contains' | 'exact' | 'regex'>('contains');

  // Load Data
  const loadData = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    try {
      // 1. Categories
      const catRes = await fetchCategories();
      const decCats: CategoryItem[] = [];
      if (catRes.success && catRes.items) {
        for (const item of catRes.items) {
          try {
            const aad = new TextEncoder().encode('category');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decCats.push(plain as CategoryItem);
          } catch {}
        }
      }
      setCategories(decCats);

      // 2. Patterns
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

      // 3. Transactions
      const txRes = await fetchTransactions();
      if (txRes.success && txRes.items) {
        const decTxs: (TransactionRow & { id: string; uniqueId: string })[] = [];
        for (const item of txRes.items) {
          try {
            const aadBytes = new Uint8Array(
              atob(item.aadBase64)
                .split('')
                .map((c) => c.charCodeAt(0)),
            );
            const plain = (await decryptData(item.ciphertextBase64, item.ivBase64, dek, aadBytes)) as TransactionRow;
            if (!plain.categoryId) {
              decTxs.push({ ...plain, id: item.id, uniqueId: item.uniqueId || '' });
            }
          } catch {}
        }
        decTxs.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
        setTransactions(decTxs);
      }
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

  const handleCategorize = async (categoryId: string) => {
    if (!currentTx || !dek) return;
    setHistory((prev) => [{ tx: currentTx, index: currentIndex }, ...prev].slice(0, 50));

    try {
      const updatedTx = { ...currentTx, categoryId };
      const aad = new TextEncoder().encode('transaction');
      const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await updateEncryptedItem('transaction', {
        uniqueId: currentTx.uniqueId,
        ciphertextBase64,
        ivBase64,
        aadBase64,
      });

      const newTxs = transactions.filter((t) => t.id !== currentTx.id);
      setTransactions(newTxs);
      if (currentIndex >= newTxs.length && currentIndex > 0) {
        setCurrentIndex(newTxs.length - 1);
      }
      window.dispatchEvent(new CustomEvent('tx-count-changed'));
      setCatSearch('');
      setNavPath([]);
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
      const aad = new TextEncoder().encode('transaction');
      const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await updateEncryptedItem('transaction', {
        uniqueId: lastTx.uniqueId,
        ciphertextBase64,
        ivBase64,
        aadBase64,
      });

      // Restore to list exactly where it was
      setTransactions((prev) => {
        const next = [...prev];
        next.splice(lastIndex, 0, lastTx);
        return next;
      });
      setHistory((prev) => prev.slice(1));
      setCurrentIndex(lastIndex);
      window.dispatchEvent(new CustomEvent('tx-count-changed'));
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

  const openPatternDialog = (categoryId: string) => {
    if (!currentTx) return;
    setPatternMatchText(currentTx.description);
    setPatternCategory(categoryId);
    setPatternMatchType('contains');
    setIsPatternDialogOpen(true);
  };

  const handleSavePattern = async () => {
    if (!dek || !patternMatchText.trim() || !patternCategory) return;
    setIsLoading(true);
    try {
      const newPattern: PatternItem = {
        id: crypto.randomUUID(),
        matchString: patternMatchText.trim(),
        categoryId: patternCategory,
        matchType: patternMatchType,
        priority: 0,
      };

      const aad = new TextEncoder().encode('pattern');
      const { ciphertextBase64, ivBase64 } = await encryptData(newPattern, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await saveEncryptedItems('pattern', [
        {
          uniqueId: newPattern.id,
          ciphertextBase64,
          ivBase64,
          aadBase64,
        },
      ]);

      const matchingTxs = transactions.filter((tx) => {
        const desc = tx.description.toLowerCase();
        const merchant = (tx.merchantOrName || '').toLowerCase();
        const match = patternMatchText.toLowerCase();
        if (patternMatchType === 'contains') return desc.includes(match) || merchant.includes(match);
        if (patternMatchType === 'exact') return desc === match || merchant === match;
        if (patternMatchType === 'regex') {
          try {
            const regex = new RegExp(patternMatchText, 'i');
            return regex.test(tx.description) || (tx.merchantOrName && regex.test(tx.merchantOrName));
          } catch {
            return false;
          }
        }
        return false;
      });

      const payloads = [];
      for (const tx of matchingTxs) {
        const updatedTx = { ...tx, categoryId: patternCategory };
        const txAad = new TextEncoder().encode('transaction');
        const { ciphertextBase64: txCt, ivBase64: txIv } = await encryptData(updatedTx, dek, txAad);
        const txAadB64 = btoa(String.fromCharCode(...txAad));
        payloads.push({
          uniqueId: tx.uniqueId,
          ciphertextBase64: txCt,
          ivBase64: txIv,
          aadBase64: txAadB64,
        });
      }

      if (payloads.length > 0) {
        const uniquePayloads = Array.from(new Map(payloads.map((p) => [p.uniqueId, p])).values());
        await saveEncryptedItems('transaction', uniquePayloads, true);
      }

      toast({
        title: 'Rule Created',
        description: `Auto-categorized ${matchingTxs.length} transactions.`,
      });
      setIsPatternDialogOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error saving rule', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const affectedCount = useMemo(() => {
    if (!patternMatchText.trim()) return 0;
    const match = patternMatchText.toLowerCase();

    return transactions.filter((tx) => {
      const desc = tx.description.toLowerCase();
      const merchant = (tx.merchantOrName || '').toLowerCase();

      if (patternMatchType === 'contains') {
        return desc.includes(match) || merchant.includes(match);
      }
      if (patternMatchType === 'exact') {
        return desc === match || merchant === match;
      }
      if (patternMatchType === 'regex') {
        try {
          const regex = new RegExp(patternMatchText, 'i');
          return regex.test(tx.description) || (tx.merchantOrName && regex.test(tx.merchantOrName));
        } catch {
          return false;
        }
      }
      return false;
    }).length;
  }, [patternMatchText, patternMatchType, transactions]);

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

  const suggestedId = currentTx ? matchTransaction(currentTx, patterns) : undefined;
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
            <div
              className={cn('max-w-7xl mx-auto transition-all duration-500', isLoading && 'opacity-50 grayscale-[0.5]')}
              key={currentTx.id}
            >
              <Card className='shadow-2xl border-t-4 border-t-primary relative overflow-hidden'>
                <CardContent className='pt-10 pb-8 px-4 sm:px-8 space-y-10'>
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

                    <div className='space-y-2'>
                      <div className='text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]'>
                        {currentTx.bookingDate}
                      </div>
                      <h2 className='text-3xl md:text-4xl font-black leading-tight tracking-tighter'>
                        {currentTx.merchantOrName || currentTx.description}
                      </h2>
                      {currentTx.merchantOrName && (
                        <p className='text-xs text-muted-foreground italic line-clamp-1 max-w-lg mx-auto opacity-70'>
                          {currentTx.description}
                        </p>
                      )}
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

                  <div className='flex flex-col items-center space-y-2'>
                    <div
                      className={cn(
                        'text-5xl font-black font-mono tracking-tighter',
                        parseAmount(currentTx.amount) < 0 ? 'text-red-500' : 'text-green-600',
                      )}
                    >
                      {(() => {
                        const parsed = parseAmount(currentTx.amount);
                        if (isNaN(parsed)) return currentTx.amount;
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
                        const Icon = ICON_MAP[cat.icon] || Layers;
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
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <Sparkles className='w-5 h-5 text-primary' /> Create Rule
              </DialogTitle>
              <DialogDescription>Automatically categorize matches.</DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label>Match Text</Label>
                <div className='flex gap-2'>
                  <Input
                    value={patternMatchText}
                    onChange={(e) => setPatternMatchText(e.target.value)}
                    placeholder='Search term...'
                    className='font-mono text-sm'
                  />
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-[10px] px-2 h-9'
                      onClick={() => setPatternMatchText(currentTx?.description || '')}
                      title='Use full description'
                    >
                      Desc
                    </Button>
                    {currentTx?.merchantOrName && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-[10px] px-2 h-9'
                        onClick={() => setPatternMatchText(currentTx.merchantOrName || '')}
                        title='Use merchant name'
                      >
                        Name
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Match Mode</Label>
                <div className='flex bg-muted/80 p-1 rounded-xl gap-1'>
                  {(['contains', 'exact', 'regex'] as const).map((m) => (
                    <button
                      key={m}
                      type='button'
                      onClick={() => setPatternMatchType(m)}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border border-transparent',
                        patternMatchType === m
                          ? 'bg-background shadow-md text-primary border-primary/10'
                          : 'text-muted-foreground hover:bg-background/40 hover:text-foreground',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className='bg-primary/5 rounded-xl p-4 border border-primary/10 flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-primary uppercase'>Affects</p>
                  <p className='text-sm font-black'>{affectedCount} items</p>
                </div>
                <div className='text-right'>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase'>Target</p>
                  <p className='text-sm font-bold'>{categories.find((c) => c.id === patternCategory)?.name}</p>
                </div>
              </div>
            </div>
            <DialogFooter className='gap-2 sm:gap-0'>
              <Button variant='ghost' onClick={() => setIsPatternDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePattern} disabled={isLoading || !patternMatchText.trim()}>
                {isLoading && <Loader2 className='w-4 h-4 mr-2 animate-spin' />}Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedVaultContent>
  );
}

'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, ChevronLeft, ChevronRight, Inbox, Filter } from 'lucide-react';
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
import {
  Home, Plug, Utensils, Car, HeartPulse, User, Film,
  ShoppingBag, Repeat, Plane, Wallet, ArrowLeftRight, Layers,
  Briefcase, Coffee, Gift, Shirt, Hammer, Book, Smartphone, PiggyBank,
  LucideIcon
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'home': Home,
  'plug': Plug,
  'utensils': Utensils,
  'car': Car,
  'heart-pulse': HeartPulse,
  'user': User,
  'film': Film,
  'shopping-bag': ShoppingBag,
  'repeat': Repeat,
  'plane': Plane,
  'wallet': Wallet,
  'arrow-left-right': ArrowLeftRight,
  'layers': Layers,
  'briefcase': Briefcase,
  'coffee': Coffee,
  'gift': Gift,
  'shirt': Shirt,
  'hammer': Hammer,
  'book': Book,
  'smartphone': Smartphone,
  'piggy-bank': PiggyBank,
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CategorizePage() {
  const { dek } = useVault();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<(TransactionRow & { id: string, uniqueId: string })[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

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
          } catch { }
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
          } catch { }
        }
      }
      setPatterns(decPatterns);

      // 3. Transactions
      const txRes = await fetchTransactions();
      if (txRes.success && txRes.items) {
        const decTxs: (TransactionRow & { id: string, uniqueId: string })[] = [];
        for (const item of txRes.items) {
          try {
            const aadBytes = new Uint8Array(atob(item.aadBase64).split('').map(c => c.charCodeAt(0)));
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aadBytes) as TransactionRow;
            // ONLY Uncategorized
            if (!plain.categoryId) {
              decTxs.push({ ...plain, id: item.id, uniqueId: item.uniqueId || '' });
            }
          } catch { }
        }
        // Sort by date desc
        decTxs.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
        setTransactions(decTxs);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [dek, toast]);

  useEffect(() => {
    if (dek) loadData();
  }, [dek, loadData]);

  const currentTx = transactions[currentIndex];

  const handleCategorize = async (categoryId: string) => {
    if (!currentTx || !dek) return;

    try {
      const updatedTx = { ...currentTx, categoryId };
      const aad = new TextEncoder().encode('transaction');
      const { ciphertextBase64, ivBase64 } = await encryptData(updatedTx, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await updateEncryptedItem('transaction', {
        uniqueId: currentTx.uniqueId,
        ciphertextBase64,
        ivBase64,
        aadBase64
      });

      // Remove from local list and stay at same index (or move if at end)
      const newTxs = transactions.filter(t => t.id !== currentTx.id);
      setTransactions(newTxs);

      if (currentIndex >= newTxs.length && currentIndex > 0) {
        setCurrentIndex(newTxs.length - 1);
      }

      toast({ title: "Categorized", description: updatedTx.description });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to categorize", variant: "destructive" });
    }
  };

  const handleSkip = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
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
        priority: 0
      };

      const aad = new TextEncoder().encode('pattern');
      const { ciphertextBase64, ivBase64 } = await encryptData(newPattern, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      await saveEncryptedItems('pattern', [{
        uniqueId: newPattern.id,
        ciphertextBase64,
        ivBase64,
        aadBase64
      }]);

      // Apply it to all current transactions locally
      const matchingTxs = transactions.filter(tx => {
        const desc = tx.description.toLowerCase();
        const merchant = (tx.merchantOrName || '').toLowerCase();
        const match = patternMatchText.toLowerCase();

        if (patternMatchType === 'contains') return desc.includes(match) || merchant.includes(match);
        if (patternMatchType === 'exact') return desc === match || merchant === match;
        if (patternMatchType === 'regex') {
          try {
            const regex = new RegExp(patternMatchText, 'i');
            return regex.test(tx.description) || (tx.merchantOrName && regex.test(tx.merchantOrName));
          } catch { return false; }
        }
        return false;
      });

      // Encrypt and save all matching ones
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
          aadBase64: txAadB64
        });
      }

      if (payloads.length > 0) {
        // Deduplicate payloads by uniqueId to prevent Postgres conflict error in batch
        const uniquePayloads = Array.from(
          new Map(payloads.map(p => [p.uniqueId, p])).values()
        );
        await saveEncryptedItems('transaction', uniquePayloads, true);
      }

      toast({
        title: "Rule Created",
        description: `Auto-categorized ${matchingTxs.length} transactions as ${categories.find(c => c.id === patternCategory)?.name}`
      });

      setIsPatternDialogOpen(false);
      await loadData(); // Refresh everything
    } catch (e) {
      console.error(e);
      toast({ title: "Error saving rule", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const affectedCount = useMemo(() => {
    if (!patternMatchText.trim()) return 0;
    return transactions.filter(tx => {
      const desc = tx.description.toLowerCase();
      const match = patternMatchText.toLowerCase();
      if (patternMatchType === 'contains') return desc.includes(match);
      if (patternMatchType === 'exact') return desc === match;
      if (patternMatchType === 'regex') {
        try { return new RegExp(patternMatchText, 'i').test(tx.description); } catch { return false; }
      }
      return false;
    }).length;
  }, [patternMatchText, patternMatchType, transactions]);

  if (transactions.length === 0 && !isLoading) {
    return (
      <ProtectedVaultContent>
        <div className="container mx-auto p-6 max-w-2xl">
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="bg-primary/10 p-6 rounded-full">
                <Check className="w-12 h-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">All Caught Up!</h2>
                <p className="text-muted-foreground">
                  You've categorized every transaction in your vault. Great job keeping your finances tidy.
                </p>
              </div>
              <Button asChild className="mt-4">
                <a href="/transactions">View History</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedVaultContent>
    );
  }

  const suggestedId = currentTx ? matchTransaction(currentTx, patterns) : undefined;
  const suggestedCat = suggestedId ? categories.find(c => c.id === suggestedId) : undefined;

  return (
    <ProtectedVaultContent>
      <div className="container mx-auto p-6 max-w-4xl space-y-8">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Categorize</h1>
            <Badge variant="outline" className="px-3 py-1 text-sm font-mono">
              {transactions.length} items remaining
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Focus on one transaction at a time to keep your records accurate.
          </p>
        </div>

        <div className="relative min-h-[50vh]">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-2xl transition-all duration-300">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse uppercase tracking-tight">Updating Vault...</p>
            </div>
          )}

          {!currentTx && !isLoading ? (
            <div className="animate-in fade-in zoom-in duration-500">
              <Card className="border-dashed border-2 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="bg-primary/10 p-6 rounded-full">
                    <Check className="w-12 h-12 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">All Caught Up!</h2>
                    <p className="text-muted-foreground">
                      You've categorized every transaction in your vault. Great job keeping your finances tidy.
                    </p>
                  </div>
                  <Button asChild className="mt-4" variant="default">
                    <a href="/transactions">View History</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : currentTx ? (
            <div className={cn(
              "flex items-center gap-4 transition-all duration-500",
              isLoading ? "opacity-50 grayscale-[0.5]" : "animate-in fade-in"
            )} key={currentTx.id}>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : transactions.length - 1))}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>

              <Card className="flex-1 shadow-2xl border-t-4 border-t-primary overflow-hidden">
                <CardContent className="pt-10 pb-8 px-8 space-y-10">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{currentTx.bookingDate}</div>

                    {currentTx.merchantOrName ? (
                      <div className="space-y-1">
                        <h2 className="text-3xl font-black leading-tight max-w-md">{currentTx.merchantOrName}</h2>
                        <p className="text-sm text-muted-foreground italic line-clamp-2 max-w-sm mx-auto">{currentTx.description}</p>
                      </div>
                    ) : (
                      <h2 className="text-2xl font-bold leading-tight max-w-md">{currentTx.description}</h2>
                    )}

                    <div className={cn(
                      "text-4xl font-black font-mono",
                      parseFloat(currentTx.amount.replace(/[^-0-9.]/g, '')) < 0 ? "text-red-500" : "text-green-600"
                    )}>
                      {currentTx.amount}
                    </div>

                    {/* Extra user-defined info */}
                    {currentTx.extraColumns && Object.keys(currentTx.extraColumns).length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        {Object.entries(currentTx.extraColumns).map(([key, value]) => (
                          <div key={key} className="bg-muted px-2 py-1 rounded text-[10px] flex items-center gap-1.5 border">
                            <span className="font-bold opacity-50 uppercase">{key}:</span>
                            <span>{value || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {suggestedCat && (
                    <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 flex flex-col items-center space-y-4 shadow-inner">
                      <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                        Smart Suggestion
                      </div>
                      <Button
                        size="lg"
                        className="w-full max-w-xs shadow-lg hover:scale-105 transition-transform"
                        onClick={() => handleCategorize(suggestedCat.id)}
                      >
                        <span className="mr-2">Assign to</span>
                        <span className="font-bold">{suggestedCat.name}</span>
                      </Button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                      <Filter className="w-3 h-3" />
                      Manual Selection
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {categories.map(cat => {
                        const Icon = ICON_MAP[cat.icon] || Layers;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorize(cat.id)}
                            className="group flex flex-col items-center p-4 rounded-xl border hover:border-primary transition-all hover:shadow-lg bg-card relative overflow-hidden"
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity" style={{ backgroundColor: cat.color }} />
                            <div
                              className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center transition-all group-hover:scale-110 shadow-sm"
                              style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold text-center line-clamp-1">{cat.name}</span>

                            {/* Create Rule Trigger */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPatternDialog(cat.id);
                              }}
                              className="absolute -top-2 -right-2 p-1.5 bg-primary text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                              title="Create auto-rule"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={handleSkip}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
          ) : null}
        </div>

        {!isLoading && currentTx && (
          <div className="flex justify-center flex-wrap gap-4 pt-4 animate-in slide-in-from-bottom-4 duration-700">
            <Button variant="outline" onClick={handleSkip} className="h-12 px-8 rounded-full border-2 hover:bg-muted font-bold tracking-tight">
              Skip for Now
            </Button>
            <Button variant="ghost" onClick={loadData} className="h-12 px-8 rounded-full text-muted-foreground">
              Reset & Refetch
            </Button>
          </div>
        )}

        <Dialog open={isPatternDialogOpen} onOpenChange={setIsPatternDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Create Automation Rule
              </DialogTitle>
              <DialogDescription>
                Automatically categorize future transactions matching this text.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Match Mode</Label>
                <div className="flex gap-2">
                  {(['contains', 'exact', 'regex'] as const).map(type => (
                    <Button
                      key={type}
                      variant={patternMatchType === type ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => setPatternMatchType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Match Text</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPatternMatchText(currentTx?.description || '')}
                      className="text-[10px] text-primary hover:underline font-mono"
                    >
                      Use Desc
                    </button>
                    {currentTx?.merchantOrName && (
                      <button
                        onClick={() => setPatternMatchText(currentTx.merchantOrName || '')}
                        className="text-[10px] text-primary hover:underline font-mono"
                      >
                        Use Name
                      </button>
                    )}
                  </div>
                </div>
                <Input
                  value={patternMatchText}
                  onChange={e => setPatternMatchText(e.target.value)}
                  placeholder="Match text..."
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground italic px-1">
                  Rules now automatically check both Description and Merchant Name.
                </p>
              </div>

              <div className="bg-primary/5 rounded-lg p-4 border border-primary/10 flex items-center justify-between">
                <div className="text-sm font-medium">Affected Transactions</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-primary">{affectedCount}</span>
                  <span className="text-xs text-muted-foreground">will be updated</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPatternDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePattern} disabled={isLoading || !patternMatchText.trim()}>
                Save & Apply Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex justify-center flex-wrap gap-4 pt-4">
          <Button variant="outline" onClick={handleSkip} className="h-12 px-8 rounded-full border-2 hover:bg-muted font-bold tracking-tight">
            Skip for Now
          </Button>
          <Button variant="ghost" onClick={loadData} className="h-12 px-8 rounded-full text-muted-foreground">
            Reset & Refetch
          </Button>
        </div>
      </div>
    </ProtectedVaultContent>
  );
}

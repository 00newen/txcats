'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Wallet,
  Layers,
  Receipt,
  ArrowRight,
  Calendar,
  Loader2,
  Filter,
  X,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchTransactions } from '@/src/server/actions/transactions';
import { fetchCategories } from '@/src/server/actions/categories';
import { decryptData } from '@/src/crypto/encryption';
import { TransactionRow } from '@/src/features/upload/types';
import { CategoryItem } from '@/src/features/categories/types';
import { startOfMonth, endOfMonth, format, parseISO, eachDayOfInterval, startOfYear, endOfYear, subDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/core/ThemeToggle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';

type DashboardTx = TransactionRow & { uniqueId?: string };
type ExpenseCategorySlice = { key: string; name: string; value: number };

export default function DashboardPage() {
  const { isUnlocked, dek } = useVault();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<DashboardTx[] | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [isLargestTxModalOpen, setIsLargestTxModalOpen] = useState(false);
  const [selectedExpenseCategoryKey, setSelectedExpenseCategoryKey] = useState<string | null>(null);
  const { amountFormat } = useAmountFormat();
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Persistence logic (URL -> local storage fallback)
  useEffect(() => {
    const urlStart = searchParams.get('startDate') || '';
    const urlEnd = searchParams.get('endDate') || '';

    if (isDateOnly(urlStart) && isDateOnly(urlEnd)) {
      if (urlStart !== startDate || urlEnd !== endDate) {
        if (urlStart <= urlEnd) {
          setStartDate(urlStart);
          setEndDate(urlEnd);
        } else {
          setStartDate(urlEnd);
          setEndDate(urlStart);
        }
      }
      return;
    }

    const savedStart = localStorage.getItem('dashboard-start-date');
    const savedEnd = localStorage.getItem('dashboard-end-date');
    if (savedStart && savedEnd && isDateOnly(savedStart) && isDateOnly(savedEnd)) {
      if (savedStart <= savedEnd) {
        setStartDate(savedStart);
        setEndDate(savedEnd);
      } else {
        setStartDate(savedEnd);
        setEndDate(savedStart);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('dashboard-start-date', startDate);
    localStorage.setItem('dashboard-end-date', endDate);

    const currentStart = searchParams.get('startDate') || '';
    const currentEnd = searchParams.get('endDate') || '';
    if (currentStart === startDate && currentEnd === endDate) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [startDate, endDate, pathname, router, searchParams]);

  const loadData = useCallback(async () => {
    if (!dek) return;
    setIsLoading(true);
    setLoadError(null);
    setLoadWarning(null);
    try {
      // Load Categories
      const catRes = await fetchCategories();
      let categoryDecryptFailures = 0;
      const decCats: CategoryItem[] = [];
      if (catRes.success && catRes.items) {
        const categoriesResults = await Promise.all(
          catRes.items.map(async (item) => {
            try {
              const aad = new TextEncoder().encode('category');
              return (await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad)) as CategoryItem;
            } catch {
              categoryDecryptFailures++;
              return null;
            }
          }),
        );
        decCats.push(...categoriesResults.filter((item): item is CategoryItem => item !== null));
      }
      setCategories(decCats);

      // Load Transactions
      const txRes = await fetchTransactions();
      let txDecryptFailures = 0;
      if (txRes.success && txRes.items) {
        const txResults = await Promise.all(
          txRes.items.map(async (item) => {
            try {
              const aadBytes = new Uint8Array(
                atob(item.aadBase64)
                  .split('')
                  .map((c) => c.charCodeAt(0)),
              );
              const plain = (await decryptData(item.ciphertextBase64, item.ivBase64, dek, aadBytes)) as TransactionRow;
              return {
                ...plain,
                uniqueId: item.uniqueId || undefined,
              } as DashboardTx;
            } catch {
              txDecryptFailures++;
              return null;
            }
          }),
        );
        const decTxs = txResults.filter((item): item is DashboardTx => item !== null);
        setTransactions(decTxs);
      } else {
        setTransactions([]);
      }

      if (categoryDecryptFailures > 0 || txDecryptFailures > 0) {
        setLoadWarning(
          `${categoryDecryptFailures + txDecryptFailures} item(s) could not be decrypted and were skipped.`,
        );
      }
    } catch (e) {
      console.error(e);
      setLoadError('Failed to load vault data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      loadData();
    } else {
      setIsLoading(false);
      setTransactions([]);
      setCategories([]);
    }
  }, [dek, loadData]);

  const stats = useMemo(() => {
    if (!transactions) return null;

    const filtered = transactions.filter((tx) => {
      const date = tx.bookingDate;
      return date >= startDate && date <= endDate;
    });

    const totalIncome = transactions.reduce((acc, tx) => {
      const val = parseAmount(tx.amount);
      if (isNaN(val)) return acc;
      return val > 0 ? acc + val : acc;
    }, 0);

    const totalExpenses = transactions.reduce((acc, tx) => {
      const val = parseAmount(tx.amount);
      if (isNaN(val)) return acc;
      return val < 0 ? acc + Math.abs(val) : acc;
    }, 0);

    const income = filtered.reduce((acc, tx) => {
      const val = parseAmount(tx.amount);
      if (isNaN(val)) return acc;
      return val > 0 ? acc + val : acc;
    }, 0);

    const expenses = filtered.reduce((acc, tx) => {
      const val = parseAmount(tx.amount);
      if (isNaN(val)) return acc;
      return val < 0 ? acc + Math.abs(val) : acc;
    }, 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
      totalTransactions: transactions.length,
      totalCategories: categories.length,
      totalIncome,
      totalExpenses,
      filteredCount: filtered.length,
      income,
      expenses,
      net: income - expenses,
      savingsRate,
    };
  }, [transactions, categories, startDate, endDate]);

  const chartData = useMemo(() => {
    if (!transactions) return [];

    const filtered = transactions.filter((tx) => {
      const date = tx.bookingDate;
      return date >= startDate && date <= endDate;
    });

    // Optimize by pre-grouping transactions by date
    const grouped = filtered.reduce(
      (acc, tx) => {
        const d = tx.bookingDate;
        if (!acc[d]) acc[d] = { income: 0, expenses: 0 };
        const val = parseAmount(tx.amount);
        if (isNaN(val)) return acc;
        if (val > 0) acc[d].income += val;
        else acc[d].expenses += Math.abs(val);
        return acc;
      },
      {} as Record<string, { income: number; expenses: number }>,
    );

    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = grouped[dateStr] || { income: 0, expenses: 0 };

      return {
        date: format(day, 'MMM dd'),
        income: parseFloat(data.income.toFixed(2)),
        expenses: parseFloat(data.expenses.toFixed(2)),
      };
    });
  }, [transactions, startDate, endDate]);

  const expensesByCategory = useMemo(() => {
    if (!transactions) return [];

    const grouped = transactions.reduce(
      (acc, tx) => {
        const date = tx.bookingDate;
        if (date < startDate || date > endDate) return acc;

        const amount = parseAmount(tx.amount);
        if (isNaN(amount) || amount >= 0) return acc;

        const key = tx.categoryId || '__uncategorized__';
        const name = tx.categoryId
          ? categories.find((c) => c.id === tx.categoryId)?.name || 'Unknown'
          : 'Uncategorized';
        if (!acc[key]) {
          acc[key] = { key, name, value: 0 };
        }
        acc[key].value += Math.abs(amount);
        return acc;
      },
      {} as Record<string, ExpenseCategorySlice>,
    );

    return Object.values(grouped)
      .map((item) => ({ ...item, value: parseFloat(item.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, startDate, endDate, categories]);

  useEffect(() => {
    if (expensesByCategory.length === 0) {
      setSelectedExpenseCategoryKey(null);
      return;
    }

    const hasSelection = selectedExpenseCategoryKey
      ? expensesByCategory.some((item) => item.key === selectedExpenseCategoryKey)
      : false;

    if (!hasSelection) {
      setSelectedExpenseCategoryKey(expensesByCategory[0].key);
    }
  }, [expensesByCategory, selectedExpenseCategoryKey]);

  const selectedExpenseCategory = useMemo(
    () => expensesByCategory.find((item) => item.key === selectedExpenseCategoryKey) || null,
    [expensesByCategory, selectedExpenseCategoryKey],
  );

  const selectedCategoryTransactions = useMemo(() => {
    if (!transactions || !selectedExpenseCategoryKey) return [];

    return [...transactions]
      .filter((tx) => {
        const date = tx.bookingDate;
        if (date < startDate || date > endDate) return false;

        const amount = parseAmount(tx.amount);
        if (isNaN(amount) || amount >= 0) return false;

        const key = tx.categoryId || '__uncategorized__';
        return key === selectedExpenseCategoryKey;
      })
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  }, [transactions, selectedExpenseCategoryKey, startDate, endDate]);

  const recentActivity = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
      .slice(0, 5);
  }, [transactions]);

  const periodInsights = useMemo(() => {
    if (!transactions) return null;

    const filtered = transactions.filter((tx) => {
      const date = tx.bookingDate;
      return date >= startDate && date <= endDate;
    });

    if (filtered.length === 0) {
      return {
        largestTx: null,
        bestInDay: null,
        worstOutDay: null,
      };
    }

    let largestTx: { amount: number; tx: DashboardTx } | null = null;
    const groupedByDay: Record<string, { income: number; expenses: number }> = {};

    for (const tx of filtered) {
      const amount = parseAmount(tx.amount);
      if (isNaN(amount)) continue;

      if (!largestTx || Math.abs(amount) > Math.abs(largestTx.amount)) {
        largestTx = {
          amount,
          tx,
        };
      }

      if (!groupedByDay[tx.bookingDate]) {
        groupedByDay[tx.bookingDate] = { income: 0, expenses: 0 };
      }
      if (amount > 0) {
        groupedByDay[tx.bookingDate].income += amount;
      } else if (amount < 0) {
        groupedByDay[tx.bookingDate].expenses += Math.abs(amount);
      }
    }

    const days = Object.entries(groupedByDay);
    const bestInDay = days
      .filter(([, value]) => value.income > 0)
      .reduce<{ date: string; amount: number } | null>(
        (best, [date, value]) => {
          if (!best || value.income > best.amount) {
            return { date, amount: value.income };
          }
          return best;
        },
        null,
      );

    const worstOutDay = days
      .filter(([, value]) => value.expenses > 0)
      .reduce<{ date: string; amount: number } | null>(
        (worst, [date, value]) => {
          if (!worst || value.expenses > worst.amount) {
            return { date, amount: value.expenses };
          }
          return worst;
        },
        null,
      );

    return {
      largestTx,
      bestInDay,
      worstOutDay,
    };
  }, [transactions, startDate, endDate]);

  const getCategoryName = (id?: string) => {
    if (!id) return 'Uncategorized';
    return categories.find((c) => c.id === id)?.name || 'Unknown';
  };

  const txDateBounds = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const validDates = transactions
      .map((tx) => tx.bookingDate)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();

    if (validDates.length === 0) return null;
    return { min: validDates[0], max: validDates[validDates.length - 1] };
  }, [transactions]);

  const clampToBounds = useCallback((date: string, bounds: { min: string; max: string }) => {
    if (date < bounds.min) return bounds.min;
    if (date > bounds.max) return bounds.max;
    return date;
  }, []);

  const applyRange = useCallback(
    (nextStart: string, nextEnd: string) => {
      if (!txDateBounds) return;
      let safeStart = clampToBounds(nextStart, txDateBounds);
      let safeEnd = clampToBounds(nextEnd, txDateBounds);
      if (safeStart > safeEnd) {
        safeStart = safeEnd;
      }
      setStartDate(safeStart);
      setEndDate(safeEnd);
    },
    [clampToBounds, txDateBounds],
  );

  const isThisMonthSelection = useMemo(() => {
    if (!txDateBounds) return false;

    let monthStart = clampToBounds(format(startOfMonth(new Date()), 'yyyy-MM-dd'), txDateBounds);
    const monthEnd = clampToBounds(format(endOfMonth(new Date()), 'yyyy-MM-dd'), txDateBounds);

    if (monthStart > monthEnd) {
      monthStart = monthEnd;
    }

    return startDate === monthStart && endDate === monthEnd;
  }, [clampToBounds, endDate, startDate, txDateBounds]);

  useEffect(() => {
    if (!txDateBounds) return;
    applyRange(startDate, endDate);
    // Intentionally run when bounds appear/change to sanitize persisted dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txDateBounds]);

  const selectThisMonth = () => {
    const now = new Date();
    applyRange(format(startOfMonth(now), 'yyyy-MM-dd'), format(endOfMonth(now), 'yyyy-MM-dd'));
  };

  const selectThisYear = () => {
    const now = new Date();
    applyRange(format(startOfYear(now), 'yyyy-MM-dd'), format(endOfYear(now), 'yyyy-MM-dd'));
  };

  const selectLast30Days = () => {
    const rangeEnd = txDateBounds?.max || format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(parseISO(rangeEnd), 29), 'yyyy-MM-dd');
    applyRange(start, rangeEnd);
  };

  const selectAllData = () => {
    if (!txDateBounds) return;
    applyRange(txDateBounds.min, txDateBounds.max);
  };

  const resetFilters = () => {
    selectThisMonth();
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.showPicker?.();
    input.focus();
  };

  const periodTransactionsHref = `/transactions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const largestTxHref =
    periodInsights?.largestTx &&
    `/transactions?startDate=${encodeURIComponent(periodInsights.largestTx.tx.bookingDate)}&endDate=${encodeURIComponent(periodInsights.largestTx.tx.bookingDate)}${
      periodInsights.largestTx.tx.uniqueId ? `&txId=${encodeURIComponent(periodInsights.largestTx.tx.uniqueId)}` : ''
    }&txDate=${encodeURIComponent(periodInsights.largestTx.tx.bookingDate)}&txAmount=${encodeURIComponent(
      periodInsights.largestTx.tx.amount,
    )}&txDesc=${encodeURIComponent(periodInsights.largestTx.tx.description || '')}`;
  const expenseCategoryColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1'];
  const expenseTotal = expensesByCategory.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className='container mx-auto p-4 md:p-6 space-y-8 max-w-7xl'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
        <div className='space-y-1'>
          <h1 className='text-3xl font-black tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground'>Welcome back to your secure financial hub.</p>
        </div>
        <div className='flex items-center gap-3'>
          {isUnlocked ? (
            <span className='flex items-center text-green-600 text-[10px] font-bold uppercase tracking-wider bg-green-50 px-3 py-1.5 rounded-full border border-green-200'>
              <ShieldCheck className='w-3.5 h-3.5 mr-1.5' />
              Vault Unlocked
            </span>
          ) : (
            <span className='flex items-center text-amber-600 text-[10px] font-bold uppercase tracking-wider bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200'>
              <ShieldAlert className='w-3.5 h-3.5 mr-1.5' />
              Vault Locked
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>

      <ProtectedVaultContent>
        {loadError && (
          <Card className='border-red-200 bg-red-50/60'>
            <CardContent className='py-4 text-sm text-red-700'>{loadError}</CardContent>
          </Card>
        )}
        {loadWarning && (
          <Card className='border-amber-200 bg-amber-50/60'>
            <CardContent className='py-4 text-sm text-amber-700'>{loadWarning}</CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity', !isLoading && 'animate-in fade-in-50')}>
          <Card className='border-none shadow-sm bg-primary/5'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                    Total Transactions
                  </p>
                  <h3 className='text-2xl font-black mt-1'>{stats?.totalTransactions || 0}</h3>
                </div>
                <div className='bg-primary/10 p-2 rounded-lg'>
                  <Receipt className='w-5 h-5 text-primary' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='border-none shadow-sm bg-blue-50/50'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                    Active Categories
                  </p>
                  <h3 className='text-2xl font-black mt-1'>{stats?.totalCategories || 0}</h3>
                </div>
                <div className='bg-blue-100 p-2 rounded-lg text-blue-600'>
                  <Layers className='w-5 h-5' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='border-none shadow-sm bg-green-50/50'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                    Total Income
                  </p>
                  <h3 className='text-2xl font-black mt-1 text-green-600'>
                    +{formatAmount(stats?.totalIncome || 0, amountFormat)}
                  </h3>
                </div>
                <div className='bg-green-100 p-2 rounded-lg text-green-600'>
                  <TrendingUp className='w-5 h-5' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='border-none shadow-sm bg-red-50/50'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                    Total Expenses
                  </p>
                  <h3 className='text-2xl font-black mt-1 text-red-600'>
                    -{formatAmount(stats?.totalExpenses || 0, amountFormat)}
                  </h3>
                </div>
                <div className='bg-red-100 p-2 rounded-lg text-red-600'>
                  <TrendingDown className='w-5 h-5' />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2'>
            {/* Chart Section */}
            <Card className={cn('shadow-xl border-none transition-opacity', !isLoading && 'animate-in fade-in-50')}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-7'>
              <div>
                <CardTitle className='text-xl font-black'>Cash Flow</CardTitle>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-2 mt-2'>
                  <div className='flex items-center gap-3'>
                    <div className='flex flex-col'>
                      <span className='text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1'>
                        Period In
                      </span>
                      <span className='text-sm font-black text-green-600 flex items-center gap-1'>
                        <TrendingUp className='w-3.5 h-3.5' /> ${formatAmount(stats?.income || 0, amountFormat)}
                      </span>
                    </div>
                    <div className='w-px h-6 bg-border mx-1' />
                    <div className='flex flex-col'>
                      <span className='text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1'>
                        Period Out
                      </span>
                      <span className='text-sm font-black text-red-500 flex items-center gap-1'>
                        <TrendingDown className='w-3.5 h-3.5' /> ${formatAmount(stats?.expenses || 0, amountFormat)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex items-center gap-1 bg-muted p-1 rounded-lg'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2 text-[10px] font-bold'
                    onClick={selectThisMonth}
                    disabled={!txDateBounds}
                  >
                    Month
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2 text-[10px] font-bold'
                    onClick={selectThisYear}
                    disabled={!txDateBounds}
                  >
                    Year
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2 text-[10px] font-bold'
                    onClick={selectLast30Days}
                    disabled={!txDateBounds}
                  >
                    Last 30D
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2 text-[10px] font-bold'
                    onClick={selectAllData}
                    disabled={!txDateBounds}
                  >
                    All
                  </Button>
                  <div
                    className='relative cursor-pointer'
                    onClick={() => openDatePicker(startDateInputRef.current)}
                  >
                    <Calendar className='absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none' />
                    <input
                      ref={startDateInputRef}
                      type='date'
                      value={startDate}
                      min={txDateBounds?.min}
                      max={txDateBounds?.max}
                      disabled={!txDateBounds}
                      onChange={(e) => applyRange(e.target.value, endDate)}
                      className='bg-transparent border-none text-[10px] font-bold pl-8 pr-2 py-1 focus:ring-0 outline-none w-32 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden'
                    />
                  </div>
                  <span className='text-muted-foreground text-xs'>to</span>
                  <div
                    className='relative cursor-pointer'
                    onClick={() => openDatePicker(endDateInputRef.current)}
                  >
                    <Calendar className='absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none' />
                    <input
                      ref={endDateInputRef}
                      type='date'
                      value={endDate}
                      min={txDateBounds?.min}
                      max={txDateBounds?.max}
                      disabled={!txDateBounds}
                      onChange={(e) => applyRange(startDate, e.target.value)}
                      className='bg-transparent border-none text-[10px] font-bold pl-8 pr-2 py-1 focus:ring-0 outline-none w-32 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden'
                    />
                  </div>
                </div>
                {txDateBounds && startDate && endDate && !isThisMonthSelection && (
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-muted-foreground'
                    onClick={resetFilters}
                    title='Reset to Current Month'
                  >
                    <X className='w-4 h-4' />
                  </Button>
                )}
              </div>
            </CardHeader>
            {txDateBounds && (
              <div className='px-6 -mt-3 pb-2 text-[10px] font-medium text-muted-foreground'>
                Available data: {txDateBounds.min} to {txDateBounds.max}
              </div>
            )}
            <div className='px-6 pb-3 grid grid-cols-1 md:grid-cols-3 gap-2'>
              <div className='rounded-lg border bg-muted/20 p-3'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>Highest TX (Period)</p>
                {periodInsights?.largestTx ? (
                  <button
                    type='button'
                    className='w-full text-left hover:opacity-80 transition-opacity'
                    onClick={() => setIsLargestTxModalOpen(true)}
                  >
                    <p className={cn('text-sm font-black mt-1', periodInsights.largestTx.amount >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {periodInsights.largestTx.amount >= 0 ? '+' : '-'}${formatAmount(
                        Math.abs(periodInsights.largestTx.amount),
                        amountFormat,
                      )}
                    </p>
                    <p className='text-[10px] text-muted-foreground truncate'>
                      {periodInsights.largestTx.tx.bookingDate} •{' '}
                      {periodInsights.largestTx.tx.merchantOrName || periodInsights.largestTx.tx.description || 'Transaction'}
                    </p>
                  </button>
                ) : (
                  <p className='text-xs mt-1 text-muted-foreground'>No data</p>
                )}
              </div>
              <div className='rounded-lg border bg-muted/20 p-3'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>Peak Cash-In Day</p>
                {periodInsights?.bestInDay ? (
                  <>
                    <p className='text-sm font-black mt-1 text-green-600'>
                      +${formatAmount(periodInsights.bestInDay.amount, amountFormat)}
                    </p>
                    <p className='text-[10px] text-muted-foreground'>{periodInsights.bestInDay.date}</p>
                  </>
                ) : (
                  <p className='text-xs mt-1 text-muted-foreground'>No income in period</p>
                )}
              </div>
              <div className='rounded-lg border bg-muted/20 p-3'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>Peak Cash-Out Day</p>
                {periodInsights?.worstOutDay ? (
                  <>
                    <p className='text-sm font-black mt-1 text-red-500'>
                      -${formatAmount(periodInsights.worstOutDay.amount, amountFormat)}
                    </p>
                    <p className='text-[10px] text-muted-foreground'>{periodInsights.worstOutDay.date}</p>
                  </>
                ) : (
                  <p className='text-xs mt-1 text-muted-foreground'>No expenses in period</p>
                )}
              </div>
            </div>
            <CardContent className='h-[350px]'>
              {isLoading ? (
                <div className='h-full flex flex-col items-center justify-center space-y-3'>
                  <Loader2 className='w-8 h-8 animate-spin text-primary' />
                  <p className='text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse'>
                    Decrypting data...
                  </p>
                </div>
              ) : (stats?.filteredCount || 0) === 0 ? (
                <div className='h-full flex items-center justify-center text-sm text-muted-foreground'>
                  No transactions in this selected period.
                </div>
              ) : (
                <ResponsiveContainer width='100%' height='100%'>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id='colorIncome' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='#10b981' stopOpacity={0.1} />
                        <stop offset='95%' stopColor='#10b981' stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id='colorExpense' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='#ef4444' stopOpacity={0.1} />
                        <stop offset='95%' stopColor='#ef4444' stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#e2e8f0' />
                    <XAxis
                      dataKey='date'
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                      dy={10}
                      interval='preserveStartEnd'
                      minTickGap={30}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                      itemStyle={{ fontWeight: 700 }}
                    />
                    <Legend
                      verticalAlign='top'
                      align='right'
                      content={({ payload }) => (
                        <div className='flex items-center justify-end gap-2 pr-2 pb-5 text-[10px] font-bold'>
                          {(payload || []).map((entry) => {
                            const name = entry.value === 'Income' ? 'Income' : 'Expenses';
                            const amount = name === 'Income' ? stats?.income || 0 : stats?.expenses || 0;
                            return (
                              <span key={name} className='inline-flex items-center gap-1.5 uppercase tracking-widest opacity-80'>
                                <span className='inline-block h-2 w-2 rounded-full' style={{ backgroundColor: entry.color }} />
                                {name}
                                <span className='opacity-50'>(${formatAmount(amount, amountFormat)})</span>
                              </span>
                            );
                          })}
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]',
                              (stats?.net || 0) >= 0
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-red-200 bg-red-50 text-red-700',
                            )}
                          >
                            Difference {(stats?.net || 0) >= 0 ? '+' : '-'}$
                            {formatAmount(Math.abs(stats?.net || 0), amountFormat)}
                          </span>
                        </div>
                      )}
                    />
                    <Area
                      type='monotone'
                      dataKey='income'
                      stroke='#10b981'
                      strokeWidth={3}
                      fillOpacity={1}
                      fill='url(#colorIncome)'
                      name='Income'
                    />
                    <Area
                      type='monotone'
                      dataKey='expenses'
                      stroke='#ef4444'
                      strokeWidth={3}
                      fillOpacity={1}
                      fill='url(#colorExpense)'
                      name='Expenses'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
            <div className='px-6 pt-2 pb-6 border-t'>
              <div className='mb-4'>
                <h3 className='text-lg font-black'>Expenses by Category</h3>
                <p className='text-xs text-muted-foreground'>Expense distribution for the selected period</p>
              </div>
              {isLoading ? (
                <div className='h-[280px] flex flex-col items-center justify-center space-y-3'>
                  <Loader2 className='w-8 h-8 animate-spin text-primary' />
                  <p className='text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse'>
                    Preparing chart...
                  </p>
                </div>
              ) : expensesByCategory.length === 0 ? (
                <div className='h-[280px] flex items-center justify-center text-sm text-muted-foreground'>
                  No expense data in this selected period.
                </div>
              ) : (
                <>
                  <div className='grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4 items-center'>
                    <div className='h-[280px]'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <PieChart>
                          <Pie
                            data={expensesByCategory}
                            dataKey='value'
                            nameKey='name'
                            cx='50%'
                            cy='50%'
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={2}
                            onClick={(_, index) => {
                              const selected = expensesByCategory[index];
                              if (selected) setSelectedExpenseCategoryKey(selected.key);
                            }}
                          >
                            {expensesByCategory.map((entry, index) => {
                              const isSelected = selectedExpenseCategoryKey === entry.key;
                              return (
                                <Cell
                                  key={`expense-category-${entry.key}`}
                                  fill={expenseCategoryColors[index % expenseCategoryColors.length]}
                                  stroke={isSelected ? '#0f172a' : 'transparent'}
                                  strokeWidth={isSelected ? 2 : 0}
                                  fillOpacity={isSelected ? 1 : 0.55}
                                  className='cursor-pointer'
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip
                            formatter={(value) => `$${formatAmount(Number(value) || 0, amountFormat)}`}
                            contentStyle={{
                              borderRadius: '12px',
                              border: 'none',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className='space-y-2'>
                      <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>Category Split</p>
                      <div className='space-y-1 max-h-[240px] overflow-auto pr-1'>
                        {expensesByCategory.map((item, index) => {
                          const pct = expenseTotal > 0 ? (item.value / expenseTotal) * 100 : 0;
                          const isSelected = selectedExpenseCategoryKey === item.key;
                          return (
                            <button
                              key={item.key}
                              type='button'
                              onClick={() => setSelectedExpenseCategoryKey(item.key)}
                              className={cn(
                                'w-full flex items-center justify-between gap-3 text-xs rounded-md px-2 py-1.5 text-left transition-colors',
                                isSelected ? 'bg-muted border' : 'hover:bg-muted/50',
                              )}
                            >
                              <span className='inline-flex items-center gap-2 min-w-0'>
                                <span
                                  className='inline-block h-2.5 w-2.5 rounded-full shrink-0'
                                  style={{ backgroundColor: expenseCategoryColors[index % expenseCategoryColors.length] }}
                                />
                                <span className='truncate font-medium'>{item.name}</span>
                              </span>
                              <span className='font-black whitespace-nowrap'>
                                ${formatAmount(item.value, amountFormat)} ({pct.toFixed(0)}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className='mt-5 border rounded-lg'>
                    <div className='px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-3'>
                      <div>
                        <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>
                          Selected Category Transactions
                        </p>
                        <p className='text-sm font-bold'>
                          {selectedExpenseCategory?.name || 'None selected'}
                        </p>
                      </div>
                      {selectedExpenseCategory && (
                        <p className='text-xs font-black text-red-500'>
                          -${formatAmount(selectedExpenseCategory.value, amountFormat)}
                        </p>
                      )}
                    </div>
                    {selectedCategoryTransactions.length === 0 ? (
                      <div className='px-3 py-6 text-sm text-muted-foreground text-center'>
                        No transactions found for this category in the selected period.
                      </div>
                    ) : (
                      <div className='max-h-[260px] overflow-auto divide-y'>
                        {selectedCategoryTransactions.slice(0, 25).map((tx, idx) => {
                          const amount = Math.abs(parseAmount(tx.amount));
                          return (
                            <div key={`${tx.uniqueId || tx.bookingDate}-${idx}`} className='px-3 py-2.5 flex items-center justify-between gap-3'>
                              <div className='min-w-0'>
                                <p className='text-sm font-semibold truncate'>
                                  {tx.merchantOrName || tx.description || 'Transaction'}
                                </p>
                                <p className='text-[10px] text-muted-foreground truncate'>
                                  {tx.bookingDate} {tx.description ? `• ${tx.description}` : ''}
                                </p>
                              </div>
                              <p className='text-xs font-black text-red-500 whitespace-nowrap'>
                                -${formatAmount(amount, amountFormat)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className='px-6 pb-6 flex justify-end'>
              <Link href={periodTransactionsHref}>
                <Button variant='outline' size='sm' className='h-8 text-[10px] font-bold uppercase tracking-wider'>
                  View Period TXs
                </Button>
              </Link>
            </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className='shadow-lg border-none'>
            <CardHeader>
              <CardTitle className='text-xl font-black'>Recent Activity</CardTitle>
              <CardDescription>Latest vault entries</CardDescription>
            </CardHeader>
            <CardContent className='p-0'>
              <div className='space-y-1'>
                {recentActivity.length > 0 ? (
                  recentActivity.map((tx, idx) => {
                    const amount = parseAmount(tx.amount);
                    return (
                      <div
                        key={idx}
                        className='flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b last:border-0'
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                            amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600',
                          )}
                        >
                          {amount > 0 ? <TrendingUp className='w-4 h-4' /> : <TrendingDown className='w-4 h-4' />}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-bold truncate'>{tx.merchantOrName || tx.description}</p>
                          <div className='flex items-center gap-2'>
                            <p className='text-[10px] font-medium text-muted-foreground'>{tx.bookingDate}</p>
                            <Badge variant='outline' className='text-[8px] h-4 py-0 leading-none'>
                              {getCategoryName(tx.categoryId)}
                            </Badge>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'text-sm font-black font-mono whitespace-nowrap',
                            amount > 0 ? 'text-green-600' : 'text-red-500',
                          )}
                        >
                          {amount >= 0 ? '+' : '-'}${formatAmount(Math.abs(amount), amountFormat)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='py-12 text-center space-y-3'>
                    <div className='bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto opacity-40'>
                      <Receipt className='w-6 h-6 text-muted-foreground' />
                    </div>
                    <p className='text-xs font-medium text-muted-foreground italic'>No transactions found.</p>
                  </div>
                )}
              </div>
              <div className='p-4 border-t'>
                <Link href='/transactions'>
                  <Button variant='ghost' size='sm' className='w-full text-xs font-bold uppercase tracking-wider gap-2'>
                    View All Transactions
                    <ArrowRight className='w-3 h-3' />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <Link href='/upload' className='group'>
            <Card className='hover:border-primary/50 transition-all hover:shadow-md h-full'>
              <CardContent className='p-6 flex flex-col items-center text-center space-y-2'>
                <div className='w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <Wallet className='w-6 h-6 text-primary' />
                </div>
                <h4 className='font-bold text-sm'>Import CSV</h4>
                <p className='text-[11px] text-muted-foreground'>Add new statements</p>
              </CardContent>
            </Card>
          </Link>
          <Link href='/categorize' className='group'>
            <Card className='hover:border-primary/50 transition-all hover:shadow-md h-full'>
              <CardContent className='p-6 flex flex-col items-center text-center space-y-2'>
                <div className='w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <Filter className='w-6 h-6 text-primary' />
                </div>
                <h4 className='font-bold text-sm'>Categorize</h4>
                <p className='text-[11px] text-muted-foreground'>Review pending items</p>
              </CardContent>
            </Card>
          </Link>
          <Link href='/patterns' className='group'>
            <Card className='hover:border-primary/50 transition-all hover:shadow-md h-full'>
              <CardContent className='p-6 flex flex-col items-center text-center space-y-2'>
                <div className='w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <Sparkles className='w-6 h-6 text-primary' />
                </div>
                <h4 className='font-bold text-sm'>Automations</h4>
                <p className='text-[11px] text-muted-foreground'>Set smart rules</p>
              </CardContent>
            </Card>
          </Link>
          <Link href='/lock' className='group'>
            <Card className='hover:border-primary/50 transition-all hover:shadow-md h-full'>
              <CardContent className='p-6 flex flex-col items-center text-center space-y-2'>
                <div className='w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <ShieldAlert className='w-6 h-6 text-primary' />
                </div>
                <h4 className='font-bold text-sm'>Lock Vault</h4>
                <p className='text-[11px] text-muted-foreground'>Secure your session</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </ProtectedVaultContent>

      <Dialog open={isLargestTxModalOpen} onOpenChange={setIsLargestTxModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Highest Transaction (Selected Period)</DialogTitle>
            <DialogDescription>Details for the largest single transaction in this range.</DialogDescription>
          </DialogHeader>
          {periodInsights?.largestTx && (
            <div className='space-y-4'>
              <div className='rounded-lg border p-3 space-y-2'>
                <p className='text-sm font-bold'>{periodInsights.largestTx.tx.merchantOrName || 'Unnamed transaction'}</p>
                <p className='text-xs text-muted-foreground'>{periodInsights.largestTx.tx.description || 'No description'}</p>
                <p className='text-xs text-muted-foreground'>Date: {periodInsights.largestTx.tx.bookingDate}</p>
                <p className={cn('text-lg font-black', periodInsights.largestTx.amount >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {periodInsights.largestTx.amount >= 0 ? '+' : '-'}$
                  {formatAmount(Math.abs(periodInsights.largestTx.amount), amountFormat)}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Category: {getCategoryName(periodInsights.largestTx.tx.categoryId)}
                </p>
              </div>
              {largestTxHref && (
                <Link href={largestTxHref} onClick={() => setIsLargestTxModalOpen(false)}>
                  <Button className='w-full' variant='outline'>
                    Open in Transactions
                  </Button>
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

'use client';

import { useMemo, useState } from 'react';
import {
  PATTERN_AMOUNT_OPERATORS,
  PATTERN_MATCH_FIELDS,
  PATTERN_MATCH_FIELD_LABELS,
  PATTERN_TEXT_OPERATORS,
  type PatternAmountOperator,
  type PatternItem,
  type PatternTextOperator,
} from '../types';
import { CategoryItem } from '../../categories/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Sparkles } from 'lucide-react';
import { useVault } from '@/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { deletePattern } from '@/server/actions/patterns';
import { loadTransactions } from '@/lib/vault/loaders';
import { encryptResourceItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';
import { matchesPattern } from '../utils/engine';
import { createSingleConditionPattern, describePatternCondition, getPrimaryCondition } from '../utils/model';

interface PatternManagerProps {
  patterns: PatternItem[];
  categories: CategoryItem[];
  onRefresh: () => void;
}

export function PatternManager({ patterns, categories, onRefresh }: PatternManagerProps) {
  const { dek } = useVault();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchString, setMatchString] = useState('');
  const [matchSecondaryValue, setMatchSecondaryValue] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [matchType, setMatchType] = useState<PatternTextOperator | PatternAmountOperator>('contains');
  const [matchField, setMatchField] = useState<(typeof PATTERN_MATCH_FIELDS)[number]>('descriptionOrName');
  const [categoryFilterId, setCategoryFilterId] = useState('');
  const isAmountField = matchField === 'amount';
  const amountOperatorRequiresSecondaryValue = matchType === 'between';

  const filteredPatterns = useMemo(() => {
    if (!categoryFilterId) return patterns;
    return patterns.filter((pattern) => pattern.categoryId === categoryFilterId);
  }, [patterns, categoryFilterId]);

  const patternCountByCategory = useMemo(
    () =>
      patterns.reduce<Record<string, number>>((acc, pattern) => {
        acc[pattern.categoryId] = (acc[pattern.categoryId] || 0) + 1;
        return acc;
      }, {}),
    [patterns],
  );

  const countAffectedTransactions = async (newRule: PatternItem): Promise<number> => {
    if (!dek) return 0;
    const txResult = await loadTransactions(dek);
    return txResult.items.filter((transaction) => matchesPattern(transaction, newRule)).length;
  };

  const handleAdd = async () => {
    if (!dek || !matchString.trim() || !categoryId) return;
    setIsSubmitting(true);

    try {
      const newItem = isAmountField
        ? createSingleConditionPattern({
            id: crypto.randomUUID(),
            categoryId,
            field: 'amount',
            operator: matchType as PatternAmountOperator,
            value: matchString.trim(),
            secondaryValue: matchSecondaryValue.trim(),
            priority: 0,
          })
        : createSingleConditionPattern({
            id: crypto.randomUUID(),
            categoryId,
            field: matchField,
            operator: matchType as PatternTextOperator,
            value: matchString.trim(),
            priority: 0,
          });

      const payload = await encryptResourceItem('pattern', newItem, dek, newItem.id);
      unwrap(await saveEncryptedItems('pattern', [payload]));

      const affectedCount = await countAffectedTransactions(newItem);
      toast({
        title: 'Pattern Added',
        description: `${affectedCount} TXs will now map to ${categories.find((c) => c.id === categoryId)?.name}.`,
      });
      setMatchString('');
      setMatchSecondaryValue('');
      onRefresh();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save pattern', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pattern? Future imports will not be auto-categorized by this rule.')) return;

    try {
      unwrap(await deletePattern(id));
      toast({ title: 'Deleted', description: 'Pattern removed.' });
      onRefresh();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const getCategoryName = (id: string) => categories.find((category) => category.id === id)?.name || 'Unknown';

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Sparkles className='w-5 h-5 text-primary' />
          Auto-Categorization Rules
        </CardTitle>
        <CardDescription>Define rules to automatically assign categories based on transaction fields.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid grid-cols-1 items-end gap-4 border-b pb-6 md:grid-cols-6'>
          <div className='space-y-2 md:col-span-1'>
            <Label>Field</Label>
            <select
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
              value={matchField}
              onChange={(e) => {
                const nextField = e.target.value as (typeof PATTERN_MATCH_FIELDS)[number];
                setMatchField(nextField);
                setMatchType(nextField === 'amount' ? 'eq' : 'contains');
                setMatchSecondaryValue('');
              }}
            >
              {PATTERN_MATCH_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {PATTERN_MATCH_FIELD_LABELS[field]}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2 md:col-span-1'>
            <Label>Operator</Label>
            <select
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
              value={matchType}
              onChange={(e) => {
                setMatchType(e.target.value as PatternTextOperator | PatternAmountOperator);
                if (e.target.value !== 'between') setMatchSecondaryValue('');
              }}
            >
              {(isAmountField ? PATTERN_AMOUNT_OPERATORS : PATTERN_TEXT_OPERATORS).map((operator) => (
                <option key={operator} value={operator}>
                  {operator === 'lt'
                    ? 'Less Than'
                    : operator === 'gt'
                      ? 'Greater Than'
                      : operator === 'eq'
                        ? 'Exactly'
                        : operator === 'between'
                          ? 'Between'
                          : operator.charAt(0).toUpperCase() + operator.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2 md:col-span-1'>
            <Label>{isAmountField ? 'Amount' : 'Match Text'}</Label>
            <Input
              placeholder={isAmountField ? 'e.g. 2500' : 'e.g. Netflix'}
              value={matchString}
              onChange={(e) => setMatchString(e.target.value)}
            />
          </div>
          <div className='space-y-2 md:col-span-1'>
            <Label>{amountOperatorRequiresSecondaryValue ? 'And Amount' : ' '}</Label>
            {amountOperatorRequiresSecondaryValue ? (
              <Input placeholder='e.g. 3500' value={matchSecondaryValue} onChange={(e) => setMatchSecondaryValue(e.target.value)} />
            ) : (
              <div className='h-10' />
            )}
          </div>
          <div className='space-y-2 md:col-span-1'>
            <Label>Assign Category</Label>
            <select
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value=''>-- Select Category --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleAdd}
            disabled={isSubmitting || !matchString.trim() || !categoryId || (amountOperatorRequiresSecondaryValue && !matchSecondaryValue.trim())}
          >
            <Plus className='mr-2 h-4 w-4' /> Add Rule
          </Button>
        </div>

        <div className='space-y-2'>
          <div className='mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end'>
            <div className='space-y-2 sm:w-80'>
              <Label>Filter By Category</Label>
              <select
                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                value={categoryFilterId}
                onChange={(e) => setCategoryFilterId(e.target.value)}
              >
                <option value=''>All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({patternCountByCategory[category.id] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredPatterns.map((pattern) => {
            const primaryCondition = getPrimaryCondition(pattern);
            const { fieldLabel, operatorLabel, valueLabel } = describePatternCondition(primaryCondition);

            return (
              <div
                key={pattern.id}
                className='group flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50'
              >
                <div className='flex items-center gap-4'>
                  <div className='rounded-md bg-muted p-2'>
                    <Search className='w-4 h-4 text-muted-foreground' />
                  </div>
                  <div className='flex flex-col'>
                    <div className='flex items-center gap-2'>
                      <span className='rounded bg-accent px-1 font-mono text-sm'>{operatorLabel}</span>
                      <span className='text-xs text-muted-foreground'>{fieldLabel}</span>
                      <span className='font-medium'>{primaryCondition?.type === 'amount' ? valueLabel : `"${valueLabel}"`}</span>
                      {pattern.conditions && pattern.conditions.length > 1 && (
                        <span className='text-[10px] uppercase text-muted-foreground'>
                          {pattern.conditionMode || 'all'} {pattern.conditions.length}
                        </span>
                      )}
                    </div>
                    <span className='text-xs text-muted-foreground'>
                      Maps to: <span className='font-semibold'>{getCategoryName(pattern.categoryId)}</span>
                    </span>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 text-destructive opacity-0 group-hover:opacity-100'
                  onClick={() => handleDelete(pattern.id)}
                >
                  <Trash2 className='w-4 h-4' />
                </Button>
              </div>
            );
          })}

          {patterns.length === 0 && (
            <div className='py-8 text-center text-sm italic text-muted-foreground'>No rules defined yet. Add your first rule above.</div>
          )}
          {patterns.length > 0 && filteredPatterns.length === 0 && (
            <div className='py-8 text-center text-sm italic text-muted-foreground'>No rules map to the selected category.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

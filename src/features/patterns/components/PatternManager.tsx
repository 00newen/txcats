'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PATTERN_AMOUNT_OPERATORS,
  PATTERN_MATCH_FIELD_LABELS,
  PATTERN_MATCH_FIELDS,
  type PatternCondition,
  type PatternConditionMode,
  PATTERN_TEXT_OPERATORS,
  type PatternAmountOperator,
  type PatternMatchField,
  type PatternItem,
  type PatternTextOperator,
} from '../types';
import { CategoryItem } from '../../categories/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Sparkles, Receipt, Pencil, X } from 'lucide-react';
import { useVault } from '@/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { deletePattern } from '@/server/actions/patterns';
import { loadTransactions } from '@/lib/vault/loaders';
import { encryptResourceItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';
import { matchesPattern } from '../utils/engine';
import { createPatternFromConditions, createSingleConditionPattern, describePatternCondition, getPrimaryCondition } from '../utils/model';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type TransactionRow } from '@/features/upload/types';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';

interface PatternManagerProps {
  patterns: PatternItem[];
  categories: CategoryItem[];
  onRefresh: () => void;
}

type PatternDraftCondition = {
  id: string;
  field: PatternMatchField;
  operator: PatternTextOperator | PatternAmountOperator;
  value: string;
  secondaryValue: string;
};

function patternToDraftState(pattern: PatternItem): {
  categoryId: string;
  matchField: PatternMatchField;
  matchType: PatternTextOperator | PatternAmountOperator;
  matchString: string;
  matchSecondaryValue: string;
  isAdvancedOpen: boolean;
  conditionMode: PatternConditionMode;
  additionalConditions: PatternDraftCondition[];
} {
  const [primary, ...rest] = pattern.conditions;
  const isDescriptionOrNamePattern =
    pattern.conditions.length === 2 &&
    pattern.conditionMode === 'any' &&
    pattern.conditions.every((condition) => condition.type === 'text') &&
    pattern.conditions.some((condition) => condition.type === 'text' && condition.field === 'description') &&
    pattern.conditions.some((condition) => condition.type === 'text' && condition.field === 'name') &&
    pattern.conditions[0]?.type === 'text' &&
    pattern.conditions[1]?.type === 'text' &&
    pattern.conditions[0].operator === pattern.conditions[1].operator &&
    pattern.conditions[0].value === pattern.conditions[1].value;

  if (!primary) {
    return {
      categoryId: pattern.categoryId,
      matchField: 'descriptionOrName',
      matchType: 'contains',
      matchString: '',
      matchSecondaryValue: '',
      isAdvancedOpen: false,
      conditionMode: 'all',
      additionalConditions: [],
    };
  }

  if (isDescriptionOrNamePattern && primary.type === 'text') {
    return {
      categoryId: pattern.categoryId,
      matchField: 'descriptionOrName',
      matchType: primary.operator,
      matchString: primary.value,
      matchSecondaryValue: '',
      isAdvancedOpen: false,
      conditionMode: 'all',
      additionalConditions: [],
    };
  }

  const toDraft = (condition: PatternCondition, index: number): PatternDraftCondition => ({
    id: `condition-${index}`,
    field: condition.type === 'amount' ? 'amount' : condition.field,
    operator: condition.operator,
    value: condition.value,
    secondaryValue: condition.type === 'amount' ? condition.secondaryValue || '' : '',
  });

  const primaryDraft = toDraft(primary, 0);

  return {
    categoryId: pattern.categoryId,
    matchField: primaryDraft.field,
    matchType: primaryDraft.operator,
    matchString: primaryDraft.value,
    matchSecondaryValue: primaryDraft.secondaryValue,
    isAdvancedOpen: rest.length > 0,
    conditionMode: pattern.conditionMode,
    additionalConditions: rest.map((condition, index) => toDraft(condition, index + 1)),
  };
}

export function PatternManager({ patterns, categories, onRefresh }: PatternManagerProps) {
  const { dek } = useVault();
  const { toast } = useToast();
  const { amountFormat } = useAmountFormat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchString, setMatchString] = useState('');
  const [matchSecondaryValue, setMatchSecondaryValue] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [matchType, setMatchType] = useState<PatternTextOperator | PatternAmountOperator>('contains');
  const [matchField, setMatchField] = useState<(typeof PATTERN_MATCH_FIELDS)[number]>('descriptionOrName');
  const [categoryFilterId, setCategoryFilterId] = useState('');
  const [editingPattern, setEditingPattern] = useState<PatternItem | null>(null);
  const [editMatchString, setEditMatchString] = useState('');
  const [editMatchSecondaryValue, setEditMatchSecondaryValue] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editMatchType, setEditMatchType] = useState<PatternTextOperator | PatternAmountOperator>('contains');
  const [editMatchField, setEditMatchField] = useState<PatternMatchField>('descriptionOrName');
  const [isEditAdvancedOpen, setIsEditAdvancedOpen] = useState(false);
  const [editConditionMode, setEditConditionMode] = useState<PatternConditionMode>('all');
  const [editAdditionalConditions, setEditAdditionalConditions] = useState<PatternDraftCondition[]>([]);
  const [transactions, setTransactions] = useState<(TransactionRow & { id: string; uniqueId: string })[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const isAmountField = matchField === 'amount';
  const amountOperatorRequiresSecondaryValue = matchType === 'between';
  const isEditAmountField = editMatchField === 'amount';
  const editAmountOperatorRequiresSecondaryValue = editMatchType === 'between';

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

  const buildDraftConditionPattern = useCallback(
    (draft: PatternDraftCondition, id: string, targetCategoryId: string, priority = 0) =>
      draft.field === 'amount'
        ? createSingleConditionPattern({
            id,
            categoryId: targetCategoryId,
            field: 'amount',
            operator: draft.operator as PatternAmountOperator,
            value: draft.value,
            secondaryValue: draft.secondaryValue,
            priority,
          })
        : createSingleConditionPattern({
            id,
            categoryId: targetCategoryId,
            field: draft.field,
            operator: draft.operator as PatternTextOperator,
            value: draft.value,
            priority,
          }),
    [],
  );

  const buildEditedPattern = useCallback((): PatternItem | null => {
    if (!editingPattern || !editCategoryId) return null;

    const primaryDraft: PatternDraftCondition = {
      id: 'primary',
      field: editMatchField,
      operator: editMatchType,
      value: editMatchString,
      secondaryValue: editMatchSecondaryValue,
    };

    if (!primaryDraft.value.trim()) return null;
    if (primaryDraft.field === 'amount' && primaryDraft.operator === 'between' && !primaryDraft.secondaryValue.trim()) return null;

    if (!isEditAdvancedOpen || editAdditionalConditions.length === 0) {
      return buildDraftConditionPattern(primaryDraft, editingPattern.id, editCategoryId, editingPattern.priority);
    }

    if (primaryDraft.field === 'descriptionOrName') return null;

    const drafts = [primaryDraft, ...editAdditionalConditions];
    const conditions: PatternCondition[] = [];

    for (const draft of drafts) {
      if (!draft.value.trim()) return null;
      if (draft.field === 'descriptionOrName') return null;
      if (draft.field === 'amount' && draft.operator === 'between' && !draft.secondaryValue.trim()) return null;
      const pattern = buildDraftConditionPattern(draft, `${editingPattern.id}-${draft.id}`, editCategoryId, editingPattern.priority);
      conditions.push(...pattern.conditions);
    }

    return createPatternFromConditions({
      id: editingPattern.id,
      categoryId: editCategoryId,
      conditionMode: editConditionMode,
      conditions,
      priority: editingPattern.priority,
    });
  }, [
    buildDraftConditionPattern,
    editAdditionalConditions,
    editCategoryId,
    editConditionMode,
    editMatchField,
    editMatchSecondaryValue,
    editMatchString,
    editMatchType,
    editingPattern,
    isEditAdvancedOpen,
  ]);

  const canUseAdvancedEditConditions = editMatchField !== 'descriptionOrName';
  const editedPatternPreview = useMemo(() => buildEditedPattern(), [buildEditedPattern]);
  const affectedTransactions = useMemo(() => {
    if (!editedPatternPreview) return [];
    return transactions.filter((transaction) => matchesPattern(transaction, editedPatternPreview));
  }, [editedPatternPreview, transactions]);

  useEffect(() => {
    if (!editingPattern || !dek) return;

    let cancelled = false;
    setIsLoadingTransactions(true);

    loadTransactions(dek)
      .then((result) => {
        if (!cancelled) {
          setTransactions(result.items);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          toast({ title: 'Error', description: 'Failed to load transactions for preview', variant: 'destructive' });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTransactions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dek, editingPattern, toast]);

  const openEdit = (pattern: PatternItem) => {
    const draft = patternToDraftState(pattern);
    setEditingPattern(pattern);
    setEditCategoryId(draft.categoryId);
    setEditMatchField(draft.matchField);
    setEditMatchType(draft.matchType);
    setEditMatchString(draft.matchString);
    setEditMatchSecondaryValue(draft.matchSecondaryValue);
    setIsEditAdvancedOpen(draft.isAdvancedOpen);
    setEditConditionMode(draft.conditionMode);
    setEditAdditionalConditions(draft.additionalConditions);
  };

  const closeEdit = () => {
    setEditingPattern(null);
    setTransactions([]);
    setEditAdditionalConditions([]);
    setIsEditAdvancedOpen(false);
    setEditConditionMode('all');
    setEditMatchField('descriptionOrName');
    setEditMatchType('contains');
    setEditMatchString('');
    setEditMatchSecondaryValue('');
    setEditCategoryId('');
  };

  const addEditAdvancedCondition = () => {
    setEditAdditionalConditions((prev) => [
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

  const updateEditAdvancedCondition = (id: string, updater: (condition: PatternDraftCondition) => PatternDraftCondition) => {
    setEditAdditionalConditions((prev) => prev.map((condition) => (condition.id === id ? updater(condition) : condition)));
  };

  const removeEditAdvancedCondition = (id: string) => {
    setEditAdditionalConditions((prev) => prev.filter((condition) => condition.id !== id));
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

  const handleUpdate = async () => {
    if (!dek || !editingPattern) return;

    const updatedPattern = buildEditedPattern();
    if (!updatedPattern) return;

    setIsSubmitting(true);
    try {
      const payload = await encryptResourceItem('pattern', updatedPattern, dek, updatedPattern.id);
      unwrap(await saveEncryptedItems('pattern', [payload], true));

      const affectedCount = await countAffectedTransactions(updatedPattern);
      toast({
        title: 'Pattern Updated',
        description: `${affectedCount} TXs currently match this rule.`,
      });
      closeEdit();
      onRefresh();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to update pattern', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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
            const transactionsHref = `/transactions?pattern=${encodeURIComponent(pattern.id)}`;

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
                <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                  <Button asChild variant='ghost' size='icon' className='h-8 w-8' title='View affected transactions'>
                    <Link href={transactionsHref}>
                      <Receipt className='w-4 h-4' />
                    </Link>
                  </Button>
                  <Button variant='ghost' size='icon' className='h-8 w-8' title='Edit rule' onClick={() => openEdit(pattern)}>
                    <Pencil className='w-4 h-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-destructive'
                    onClick={() => handleDelete(pattern.id)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
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
      <Dialog open={!!editingPattern} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className='flex max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Sparkles className='w-5 h-5 text-primary' /> Edit Rule
            </DialogTitle>
            <DialogDescription>Update the matching logic and category mapping for this rule.</DialogDescription>
          </DialogHeader>

          <div className='space-y-4 overflow-y-auto py-4 pr-1'>
            <div className='space-y-2'>
              <Label>{isEditAmountField ? 'Amount' : 'Match Text'}</Label>
              <Input
                value={editMatchString}
                onChange={(e) => setEditMatchString(e.target.value)}
                placeholder={isEditAmountField ? 'e.g. 2500' : 'Search term...'}
                className='font-mono text-sm'
              />
            </div>
            <div className='space-y-2'>
              <Label>Field</Label>
              <select
                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                value={editMatchField}
                onChange={(e) => {
                  const nextField = e.target.value as PatternMatchField;
                  setEditMatchField(nextField);
                  setEditMatchType(nextField === 'amount' ? 'eq' : 'contains');
                  setEditMatchSecondaryValue('');
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
              <div className='flex gap-1 rounded-xl bg-muted/80 p-1'>
                {(isEditAmountField ? PATTERN_AMOUNT_OPERATORS : PATTERN_TEXT_OPERATORS).map((operator) => (
                  <button
                    key={operator}
                    type='button'
                    onClick={() => {
                      setEditMatchType(operator);
                      if (operator !== 'between') setEditMatchSecondaryValue('');
                    }}
                    className={cn(
                      'flex-1 rounded-lg border border-transparent px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                      editMatchType === operator
                        ? 'border-primary/10 bg-background text-primary shadow-md'
                        : 'text-muted-foreground hover:bg-background/40 hover:text-foreground',
                    )}
                  >
                    {operator === 'lt' ? 'Less Than' : operator === 'gt' ? 'Greater Than' : operator === 'eq' ? 'Exactly' : operator}
                  </button>
                ))}
              </div>
            </div>
            {editAmountOperatorRequiresSecondaryValue && (
              <div className='space-y-2'>
                <Label>And Amount</Label>
                <Input
                  value={editMatchSecondaryValue}
                  onChange={(e) => setEditMatchSecondaryValue(e.target.value)}
                  placeholder='e.g. 3500'
                  className='font-mono text-sm'
                />
              </div>
            )}
            <div className='space-y-2'>
              <Label>Assign Category</Label>
              <select
                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
              >
                <option value=''>-- Select Category --</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-bold'>Advanced Rule</p>
                  <p className='text-xs text-muted-foreground'>Add extra conditions using the same rule model as categorization.</p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setIsEditAdvancedOpen((prev) => !prev);
                    if (isEditAdvancedOpen) {
                      setEditAdditionalConditions([]);
                      setEditConditionMode('all');
                    }
                  }}
                >
                  {isEditAdvancedOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
              {isEditAdvancedOpen && (
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <Label>Rule Logic</Label>
                    <select
                      className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
                      value={editConditionMode}
                      onChange={(e) => setEditConditionMode(e.target.value as PatternConditionMode)}
                      disabled={!canUseAdvancedEditConditions}
                    >
                      <option value='all'>Match all conditions</option>
                      <option value='any'>Match any condition</option>
                    </select>
                  </div>
                  {!canUseAdvancedEditConditions && (
                    <p className='text-xs text-muted-foreground'>
                      Change the primary field from "Description or Name" to a specific field before adding more conditions.
                    </p>
                  )}
                  {editAdditionalConditions.map((condition, index) => {
                    const isAmountCondition = condition.field === 'amount';
                    const needsSecondaryValue = condition.operator === 'between';

                    return (
                      <div key={condition.id} className='space-y-3 rounded-lg border bg-background p-3'>
                        <div className='flex items-center justify-between'>
                          <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Condition {index + 2}</p>
                          <Button type='button' variant='ghost' size='icon' onClick={() => removeEditAdvancedCondition(condition.id)}>
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
                                updateEditAdvancedCondition(condition.id, (current) => ({
                                  ...current,
                                  field: e.target.value as PatternMatchField,
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
                                updateEditAdvancedCondition(condition.id, (current) => ({
                                  ...current,
                                  operator: e.target.value as PatternTextOperator | PatternAmountOperator,
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
                                updateEditAdvancedCondition(condition.id, (current) => ({ ...current, value: e.target.value }))
                              }
                              placeholder={isAmountCondition ? 'e.g. 25' : 'Search term...'}
                              className='font-mono text-sm'
                            />
                          </div>
                        </div>
                        {needsSecondaryValue && (
                          <div className='space-y-2'>
                            <Label>And Amount</Label>
                            <Input
                              value={condition.secondaryValue}
                              onChange={(e) =>
                                updateEditAdvancedCondition(condition.id, (current) => ({
                                  ...current,
                                  secondaryValue: e.target.value,
                                }))
                              }
                              placeholder='e.g. 35'
                              className='font-mono text-sm'
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <Button type='button' variant='outline' onClick={addEditAdvancedCondition} disabled={!canUseAdvancedEditConditions}>
                    <Plus className='mr-2 h-4 w-4' /> Add Condition
                  </Button>
                </div>
              )}
            </div>
            <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-bold'>Matching Transactions</p>
                  <p className='text-xs text-muted-foreground'>Live preview of transactions affected by the edited rule.</p>
                </div>
                <div className='text-sm font-bold'>
                  {isLoadingTransactions ? 'Loading...' : `${affectedTransactions.length} match${affectedTransactions.length === 1 ? '' : 'es'}`}
                </div>
              </div>
              {!editedPatternPreview && (
                <p className='text-xs text-muted-foreground'>Complete the rule fields to preview matches.</p>
              )}
              {editedPatternPreview && !isLoadingTransactions && affectedTransactions.length === 0 && (
                <p className='text-xs text-muted-foreground'>No transactions match the current rule.</p>
              )}
              {affectedTransactions.length > 0 && (
                <div className='max-h-64 space-y-2 overflow-y-auto pr-1'>
                  {affectedTransactions.slice(0, 25).map((transaction) => {
                    const amount = parseAmount(transaction.amount);
                    return (
                      <div key={transaction.uniqueId} className='rounded-lg border bg-background p-3'>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold'>{transaction.merchantOrName || transaction.description}</p>
                            <p className='truncate text-xs text-muted-foreground'>{transaction.description}</p>
                            <p className='mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>
                              {transaction.bookingDate}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'shrink-0 font-mono text-sm font-bold',
                              amount < 0 ? 'text-red-500' : 'text-green-600',
                            )}
                          >
                            {isNaN(amount) ? transaction.amount : `${amount >= 0 ? '+' : '-'}$${formatAmount(Math.abs(amount), amountFormat)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {affectedTransactions.length > 25 && (
                    <p className='text-xs text-muted-foreground'>
                      Showing first 25 of {affectedTransactions.length} matching transactions.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className='flex items-center justify-end gap-2 border-t pt-4'>
            <Button type='button' variant='outline' onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              type='button'
              onClick={handleUpdate}
              disabled={
                isSubmitting ||
                !editCategoryId ||
                !editMatchString.trim() ||
                (editAmountOperatorRequiresSecondaryValue && !editMatchSecondaryValue.trim()) ||
                !buildEditedPattern()
              }
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { type PatternCondition, type PatternItem, type PatternTextField } from '../types';
import { TransactionRow } from '../../upload/types';
import { parseAmount } from '@/lib/amount';

function getTransactionTextValue(transaction: TransactionRow, field: PatternTextField): string {
  switch (field) {
    case 'description':
      return transaction.description;
    case 'name':
      return transaction.merchantOrName || '';
    case 'sender':
      return transaction.sender || '';
    case 'recipient':
      return transaction.recipient || '';
    case 'counterparty':
      return transaction.counterparty || '';
  }
}

function matchesTextCondition(transaction: TransactionRow, condition: PatternCondition): boolean {
  if (condition.type !== 'text') return false;
  const candidate = getTransactionTextValue(transaction, condition.field);
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedValue = condition.value.toLowerCase();

  if (condition.operator === 'contains') {
    return normalizedCandidate.includes(normalizedValue);
  }

  if (condition.operator === 'exact') {
    return normalizedCandidate === normalizedValue;
  }

  try {
    const regex = new RegExp(condition.value, 'i');
    return regex.test(candidate);
  } catch (e) {
    console.error('Invalid regex in pattern condition:', condition, e);
    return false;
  }
}

function matchesAmountCondition(transaction: TransactionRow, condition: PatternCondition): boolean {
  if (condition.type !== 'amount') return false;

  const transactionAmount = parseAmount(transaction.amount);
  const ruleAmount = parseAmount(condition.value);

  if (!isFinite(transactionAmount) || !isFinite(ruleAmount)) return false;

  if (condition.operator === 'lt') return transactionAmount < ruleAmount;
  if (condition.operator === 'gt') return transactionAmount > ruleAmount;
  if (condition.operator === 'eq') return transactionAmount === ruleAmount;

  const secondaryAmount = parseAmount(condition.secondaryValue || '');
  if (!isFinite(secondaryAmount)) return false;

  const min = Math.min(ruleAmount, secondaryAmount);
  const max = Math.max(ruleAmount, secondaryAmount);
  return transactionAmount >= min && transactionAmount <= max;
}

function matchesNormalizedPattern(transaction: TransactionRow, pattern: PatternItem): boolean {
  if (pattern.conditions.length === 0) return false;

  const results = pattern.conditions.map((condition) =>
    condition.type === 'text' ? matchesTextCondition(transaction, condition) : matchesAmountCondition(transaction, condition),
  );
  return pattern.conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function matchesPattern(transaction: TransactionRow, pattern: PatternItem): boolean {
  return matchesNormalizedPattern(transaction, pattern);
}

export function sortPatternsByPriority(patterns: PatternItem[]): PatternItem[] {
  return [...patterns].sort((a, b) => b.priority - a.priority);
}

function matchTransactionFromSorted(transaction: TransactionRow, patterns: PatternItem[]): string | undefined {
  for (const pattern of patterns) {
    if (matchesPattern(transaction, pattern)) {
      return pattern.categoryId;
    }
  }

  return undefined;
}

export function matchTransaction(transaction: TransactionRow, patterns: PatternItem[]): string | undefined {
  return matchTransactionFromSorted(transaction, sortPatternsByPriority(patterns));
}

export function findMatchingPattern(transaction: TransactionRow, patterns: PatternItem[]): PatternItem | undefined {
  const sortedPatterns = sortPatternsByPriority(patterns);

  for (const pattern of sortedPatterns) {
    if (matchesPattern(transaction, pattern)) {
      return pattern;
    }
  }
  return undefined;
}

export function applyPatterns(transactions: TransactionRow[], patterns: PatternItem[]): TransactionRow[] {
  const sortedPatterns = sortPatternsByPriority(patterns);

  return transactions.map((tx) => {
    if (!tx.categoryId) {
      const matchedCategoryId = matchTransactionFromSorted(tx, sortedPatterns);
      if (matchedCategoryId) {
        return { ...tx, categoryId: matchedCategoryId };
      }
    }
    return tx;
  });
}

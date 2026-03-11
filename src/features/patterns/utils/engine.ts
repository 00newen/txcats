import { PatternItem } from '../types';
import { TransactionRow } from '../../upload/types';

export function matchesPattern(transaction: TransactionRow, pattern: PatternItem): boolean {
    const description = transaction.description.toLowerCase();
    const merchant = (transaction.merchantOrName || '').toLowerCase();
    const matchStr = pattern.matchString.toLowerCase();

    if (pattern.matchType === 'contains') {
        return description.includes(matchStr) || merchant.includes(matchStr);
    }

    if (pattern.matchType === 'exact') {
        return description === matchStr || merchant === matchStr;
    }

    if (pattern.matchType === 'regex') {
        try {
            const regex = new RegExp(pattern.matchString, 'i');
            return regex.test(transaction.description) || (transaction.merchantOrName ? regex.test(transaction.merchantOrName) : false);
        } catch (e) {
            console.error("Invalid regex in pattern:", pattern.id, e);
            return false;
        }
    }

    return false;
}

/**
 * Matches a single transaction against a list of patterns.
 * Returns the matched categoryId or undefined.
 */
export function matchTransaction(
    transaction: TransactionRow, 
    patterns: PatternItem[]
): string | undefined {
    // Sort patterns by priority (highest first)
    const sortedPatterns = [...patterns].sort((a, b) => b.priority - a.priority);

    for (const pattern of sortedPatterns) {
        if (matchesPattern(transaction, pattern)) {
            return pattern.categoryId;
        }
    }

    return undefined;
}

/**
 * Similar to matchTransaction but returns the full pattern object.
 */
export function findMatchingPattern(
    transaction: TransactionRow,
    patterns: PatternItem[]
): PatternItem | undefined {
    const sortedPatterns = [...patterns].sort((a, b) => b.priority - a.priority);

    for (const pattern of sortedPatterns) {
        if (matchesPattern(transaction, pattern)) {
            return pattern;
        }
    }
    return undefined;
}

/**
 * Processes a list of transactions against patterns.
 * Returns updated transactions with categoryId assigned if matched.
 */
export function applyPatterns(
    transactions: TransactionRow[], 
    patterns: PatternItem[]
): TransactionRow[] {
    return transactions.map(tx => {
        // Only auto-categorize if not already categorized or if we want to overwrite
        // For now, let's only assign if empty
        if (!tx.categoryId) {
            const matchedCategoryId = matchTransaction(tx, patterns);
            if (matchedCategoryId) {
                return { ...tx, categoryId: matchedCategoryId };
            }
        }
        return tx;
    });
}

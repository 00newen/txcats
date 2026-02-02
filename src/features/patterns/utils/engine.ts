import { PatternItem } from '../types';
import { TransactionRow } from '../../upload/types';

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
    const description = transaction.description.toLowerCase();
    const merchant = (transaction.merchantOrName || '').toLowerCase();

    for (const pattern of sortedPatterns) {
        const matchStr = pattern.matchString.toLowerCase();
        
        if (pattern.matchType === 'contains') {
            if (description.includes(matchStr) || merchant.includes(matchStr)) {
                return pattern.categoryId;
            }
        } else if (pattern.matchType === 'exact') {
            if (description === matchStr || merchant === matchStr) {
                return pattern.categoryId;
            }
        } else if (pattern.matchType === 'regex') {
            try {
                const regex = new RegExp(pattern.matchString, 'i');
                if (regex.test(transaction.description) || (transaction.merchantOrName && regex.test(transaction.merchantOrName))) {
                    return pattern.categoryId;
                }
            } catch (e) {
                console.error("Invalid regex in pattern:", pattern.id, e);
            }
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

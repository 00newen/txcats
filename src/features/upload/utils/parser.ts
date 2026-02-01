import Papa from 'papaparse';
import { ParseResult, TransactionRow } from './types';

/**
 * Client-side CSV parser wrapper
 */
export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Basic normalization
        const data = (results.data as Record<string, string>[]).map(row => {
          // Heuristic to find common fields
          const date = findField(row, ['date', 'posted date', 'transaction date']);
          const amount = findField(row, ['amount', 'debit', 'transaction amount']);
          const description = findField(row, ['description', 'memo', 'payee', 'merchant']);
          const account = findField(row, ['account', 'account number']);

          return {
            date: date || '',
            amount: amount || '0',
            description: description || 'Unknown',
            account: account,
            raw: row
          };
        });

        resolve({
          data,
          errors: results.errors.map(e => e.message),
          meta: {
            fields: results.meta.fields || []
          }
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

// Helper to find case-insensitive field match
function findField(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(candidate));
    if (found) return row[found];
  }
  return undefined;
}

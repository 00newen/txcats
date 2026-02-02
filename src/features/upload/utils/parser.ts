import Papa from 'papaparse';
import { ParseResult, TransactionRow, CsvMapping } from '../types';
import { parse, isValid, format } from 'date-fns';

// Helper to find a column name in headers that matches one of the candidates
function findHeader(headers: string[], candidates: string[]): string | undefined {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex(h => h === candidate || h.includes(candidate));
    if (index !== -1) return headers[index];
  }
  return undefined;
}

// Generate a deterministic ID based on CSV headers to recognize file structure
export function getHeadersFingerprint(headers: string[]): string {
    const canonicalHeaders = [...headers].map(h => h.trim().toLowerCase()).sort();
    const data = JSON.stringify(canonicalHeaders);
    // Simple fast hash-like function for fingerprinting
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash |= 0;
    }
    return `v1-${Math.abs(hash).toString(16)}`;
}

// Basic Date Normalization
function normalizeDate(raw: string): string {
  if (!raw) return '';
  
  // Try keeping as is if already ISO-ish (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Try parsing common formats
  const formats = [
    'dd.MM.yyyy',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'yyyy-MM-dd',
    'd.M.yyyy' // 1.2.2023
  ];

  for (const fmt of formats) {
    const d = parse(raw, fmt, new Date());
    if (isValid(d)) {
      return format(d, 'yyyy-MM-dd'); 
    }
  }
  
  return raw; // Fallback to raw if unknown
}

// Generate initial mapping based on heuristics
export function generateHeuristicMapping(headers: string[]): CsvMapping {
  return {
    bookingDate: findHeader(headers, ['date', 'booking', 'datum', 'time']) || '',
    amount: findHeader(headers, ['amount', 'betrag', 'value', 'umsatz']) || '',
    description: findHeader(headers, ['description', 'memo', 'payee', 'text', 'usage', 'details']) || '',
    accountId: findHeader(headers, ['account', 'iban', 'auftraggeberkonto']) || undefined,
    counterparty: findHeader(headers, ['counterparty', 'recipient', 'sender', 'beguenstigter', 'empfaenger']) || undefined,
    merchantOrName: findHeader(headers, ['name', 'merchant', 'partner', 'company']) || undefined,
    bankTxId: findHeader(headers, ['id', 'reference', 'ref']) || undefined,
    extraColumns: []
  };
}

export function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        const headers = results.meta.fields || [];
        const mapping = generateHeuristicMapping(headers);
        const mappedData: TransactionRow[] = [];
        const errors: string[] = [];

        results.data.forEach((row, index) => {
           // Skip empty rows (sometimes papaparse leaves one)
           if (Object.keys(row).length === 0) return;
           
           mappedData.push({
             bookingDate: normalizeDate(row[mapping.bookingDate]),
             amount: row[mapping.amount] || '0',
             description: row[mapping.description] || 'Unknown',
             accountId: mapping.accountId ? row[mapping.accountId] : undefined,
             counterparty: mapping.counterparty ? row[mapping.counterparty] : undefined,
             merchantOrName: mapping.merchantOrName ? row[mapping.merchantOrName] : undefined,
             bankTxId: mapping.bankTxId ? row[mapping.bankTxId] : undefined,
             extraColumns: mapping.extraColumns?.reduce((acc, col) => {
               acc[col] = row[col];
               return acc;
             }, {} as Record<string, string>),
             rawRow: row
           });
        });

        resolve({
          data: mappedData,
          mapping, // Return the heuristic mapping
          rawHeaders: headers,
          rawData: results.data,
          errors: results.errors.map(e => e.message),
          meta: { fields: headers }
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

// Re-map raw data with a specific mapping configuration
export function mapRows(rawData: Record<string, string>[], mapping: CsvMapping): TransactionRow[] {
  return rawData.map(row => {
     return {
         bookingDate: normalizeDate(row[mapping.bookingDate]),
         amount: row[mapping.amount] || '0',
         description: row[mapping.description] || '',
         accountId: mapping.accountId ? row[mapping.accountId] : undefined,
         counterparty: mapping.counterparty ? row[mapping.counterparty] : undefined,
         merchantOrName: mapping.merchantOrName ? row[mapping.merchantOrName] : undefined,
         bankTxId: mapping.bankTxId ? row[mapping.bankTxId] : undefined,
         extraColumns: mapping.extraColumns?.reduce((acc, col) => {
           acc[col] = row[col];
           return acc;
         }, {} as Record<string, string>),
         rawRow: row
     };
  });
}


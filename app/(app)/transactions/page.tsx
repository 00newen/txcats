'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { decryptData } from '@/src/crypto/encryption';
import { TransactionRow } from '@/src/features/upload/types';
import { fetchTransactions } from '@/src/server/actions/transactions';

export default function TransactionsPage() {
  const { dek } = useVault();
  const [data, setData] = useState<TransactionRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination / Filter states in client for now
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    async function loadTransactions() {
      // Wait for DEK to be available (vault unlocked)
      if (!dek) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTransactions();

        if (!response.success || !response.items) {
          throw new Error(response.error || "Failed to fetch");
        }

        const items = response.items;
        const decryptedItems: TransactionRow[] = [];

        for (const item of items) {
          try {
            // AAD must match what was used during encryption ('transaction')
            // Note: Ideally AAD is stored in DB item.aadBase64, but we check consistency
            // If stored AAD differs from 'transaction', we should use stored AAD.
            // In our save action, we saved the AAD, so let's use it from the item if we decode it, 
            // or just re-construct if we trust the resourceType.
            // Using the item's stored AAD is safer if we allow rotation.
            // But `decryptData` expects Uint8Array or string key.

            // Let's decode the stored AAD Base64 back to Uint8Array
            const aadBytes = new Uint8Array(atob(item.aadBase64).split('').map(c => c.charCodeAt(0)));

            const plaintext = await decryptData(
              item.ciphertextBase64,
              item.ivBase64,
              dek,
              aadBytes
            );
            // Plaintext is the JSON object (TransactionRow)
            decryptedItems.push({ ...plaintext });
          } catch (err) {
            console.error(`Failed to decrypt item ${item.id}`, err);
            // Handle corruption?
          }
        }

        // Sort by date desc (if possible)
        decryptedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setData(decryptedItems);

      } catch (e) {
        setError("Could not load transactions");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }

    if (dek) {
      loadTransactions();
    } else {
      // If no dek, we are effectively loading or locked, VaultContent handles UI usually, 
      // but we might want to show loading if we are just waiting for the hook.
    }
  }, [dek]);

  // Client-side pagination
  const paginatedData = data ? data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) : [];
  const totalPages = data ? Math.ceil(data.length / ITEMS_PER_PAGE) : 1;

  if (isLoading && !data) {
    return (
      <ProtectedVaultContent>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Decrypting vault...</span>
        </div>
      </ProtectedVaultContent>
    );
  }

  return (
    <ProtectedVaultContent>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">{data ? data.length : 0} items found</p>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Your secure, end-to-end encrypted transaction history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Counterparty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="max-w-xs truncate" title={row.description}>{row.description}</TableCell>
                    <TableCell className={parseFloat(row.amount.replace(/[^0-9.-]/g, "")) < 0 ? 'text-red-500 font-mono' : 'text-green-600 font-mono'}>
                      {row.amount}
                    </TableCell>
                    <TableCell>
                      {row.account ? <Badge variant="outline">{row.account}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {row.counterpartyAccount || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Empty State */}
                {paginatedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No transactions found. Upload a CSV to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">Page {page} of {totalPages}</span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedVaultContent>
  );
}

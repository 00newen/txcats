'use client';

import { useState } from 'react';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { UploadArea } from '@/src/features/upload/components/UploadArea';
import { TransactionPreview } from '@/src/features/upload/components/TransactionPreview';
import { ParseResult, TransactionRow } from '@/src/features/upload/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVault } from '@/src/components/auth/VaultProvider';
import { encryptData } from '@/src/crypto/encryption';
import { saveEncryptedTransactions } from '@/src/server/actions/vaultItems';

export default function UploadPage() {
  const [parsedData, setParsedData] = useState<TransactionRow[] | null>(null);
  const { dek } = useVault();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  const handleParseComplete = (result: ParseResult, file: File) => {
    if (result.data.length === 0) {
      toast({ title: "No data found", description: "The CSV file appears to be empty.", variant: "destructive" });
      return;
    }
    setParsedData(result.data);
    toast({ title: "File Parsed", description: `Ready to import ${result.data.length} transactions.` });
  };

  const handleReset = () => {
    setParsedData(null);
  };

  const handleImport = async () => {
    if (!parsedData || !dek) return;

    setIsImporting(true);
    try {
      toast({ title: "Encrypting...", description: `Processing ${parsedData.length} transactions locally.` });

      // 1. Encrypt Data Client-Side
      const encryptedPayloads: {
        uniqueId: string;
        ciphertextBase64: string;
        ivBase64: string;
        aadBase64: string;
      }[] = [];

      for (const row of parsedData) {
        // Generate Deterministic ID
        // Fingerprint: date + amount + description (normalized) + account (if exists) + counterparty
        const fingerprint = [
          row.date,
          row.amount,
          row.description.trim().toLowerCase(),
          row.account || '',
          row.counterpartyAccount || ''
        ].join('|');

        const msgBuffer = new TextEncoder().encode(fingerprint);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const uniqueId = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

        // We accept the row as the confidential data
        // We use 'transaction' as the resource type for AAD or just empty for now
        // AAD helps bind the ciphertext to a context, preventing swapping
        const aad = new TextEncoder().encode('transaction');
        const aadBase64 = btoa(String.fromCharCode(...aad)); // Simple base64 for storage

        const { ciphertextBase64, ivBase64 } = await encryptData(row, dek, aad);

        encryptedPayloads.push({
          uniqueId,
          ciphertextBase64,
          ivBase64,
          aadBase64
        });
      }

      // 2. Send to Server
      toast({ title: "Uploading...", description: "Securely saving encrypted data to your vault." });
      const response = await saveEncryptedTransactions(encryptedPayloads);

      if (response && response.success) {
        toast({
          title: "Import Successful",
          description: `Saved ${response.count} transactions to your vault. Duplicates were ignored.`,
          variant: "default"
        });
        setParsedData(null); // Reset UI
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Import Failed", description: `Something went wrong: ${e instanceof Error ? e.message : 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ProtectedVaultContent>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Import Transactions</h1>
          <p className="text-muted-foreground">
            Upload your bank statements (CSV) to securely add them to your vault.
          </p>
        </div>

        {!parsedData ? (
          <UploadArea onParseComplete={handleParseComplete} />
        ) : (
          <TransactionPreview
            data={parsedData}
            onReset={handleReset}
            onConfirm={handleImport}
          />
        )}

        {/* Help / Instructions Section */}
        {!parsedData && (
          <Card>
            <CardHeader>
              <CardTitle>Supported Formats</CardTitle>
              <CardDescription>We try to auto-detect columns, but standard formats work best.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Date (e.g., "YYYY-MM-DD", "MM/DD/YYYY")</li>
                <li>Amount (positive for income, negative for expense, or split columns)</li>
                <li>Description (Payee, Merchant, Memo)</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedVaultContent>
  );
}

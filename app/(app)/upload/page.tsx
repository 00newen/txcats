'use client';

import { useState } from 'react';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { UploadArea } from '@/src/features/upload/components/UploadArea';
import { TransactionPreview } from '@/src/features/upload/components/TransactionPreview';
import { ColumnMapping } from '@/src/features/upload/components/ColumnMapping';
import { ParseResult, TransactionRow, CsvMapping } from '@/src/features/upload/types';
import { mapRows } from '@/src/features/upload/utils/parser';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVault } from '@/src/components/auth/VaultProvider';
import { encryptData } from '@/src/crypto/encryption';
import { saveEncryptedTransactions } from '@/src/server/actions/vaultItems';

export default function UploadPage() {
  // State for flow control
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

  // Data State
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedData, setParsedData] = useState<TransactionRow[] | null>(null);

  const { dek } = useVault();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  const handleParseComplete = (result: ParseResult, file: File) => {
    if (result.rawData.length === 0) {
      toast({ title: "No data found", description: "The CSV file appears to be empty.", variant: "destructive" });
      return;
    }
    setParseResult(result);
    // Go to mapping step
    setStep('mapping');
    toast({ title: "File Parsed", description: "Please verify column mapping." });
  };

  const handleMappingConfirm = (mapping: CsvMapping) => {
    if (!parseResult) return;

    // Apply mapping to raw data
    const mapped = mapRows(parseResult.rawData, mapping);
    setParsedData(mapped);
    setStep('preview');
  };

  const handleMappingCancel = () => {
    setParseResult(null);
    setParsedData(null);
    setStep('upload');
  };

  const handleReset = () => {
    setParseResult(null);
    setParsedData(null);
    setStep('upload');
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
          row.bookingDate,
          row.amount,
          row.description.trim().toLowerCase(),
          row.accountId || '',
          row.counterparty || '',
          row.bankTxId || ''
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
        handleReset();
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

        {step === 'upload' && (
          <UploadArea onParseComplete={handleParseComplete} />
        )}

        {step === 'mapping' && parseResult && (
          <ColumnMapping
            headers={parseResult.rawHeaders}
            initialMapping={parseResult.mapping}
            onConfirm={handleMappingConfirm}
            onCancel={handleMappingCancel}
          />
        )}

        {step === 'preview' && parsedData && (
          <TransactionPreview
            data={parsedData}
            onReset={handleReset}
            onConfirm={handleImport}
          />
        )}

        {/* Help / Instructions Section */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Supported Formats</CardTitle>
              <CardDescription>We support multi-bank CSV import using our smart mapper.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Automatic column detection</li>
                <li>Manual mapping verification</li>
                <li>Deduplication on re-import</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedVaultContent>
  );
}

'use client';

import { useState } from 'react';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';
import { UploadArea } from '@/src/features/upload/components/UploadArea';
import { TransactionPreview } from '@/src/features/upload/components/TransactionPreview';
import { ParseResult, TransactionRow } from '@/src/features/upload/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadPage() {
  const [parsedData, setParsedData] = useState<TransactionRow[] | null>(null);
  const { toast } = useToast();

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
    // Placeholder import logic
    toast({ title: "Importing...", description: "Feature coming in next step: Encrypting and saving to vault." });

    // TODO: 
    // 1. Get DEK from context
    // 2. Encrypt each row
    // 3. Send to Server Action
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

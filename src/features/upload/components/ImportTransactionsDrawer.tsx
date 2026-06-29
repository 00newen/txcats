'use client';

import { useState } from 'react';
import { ProtectedVaultContent } from '@/auth/ProtectedVaultContent';
import { UploadArea } from '@/features/upload/components/UploadArea';
import { TransactionPreview } from '@/features/upload/components/TransactionPreview';
import { ColumnMapping } from '@/features/upload/components/ColumnMapping';
import { ParseResult, TransactionRow, CsvMapping } from '@/features/upload/types';
import { mapRows } from '@/features/upload/utils/parser';
import { getAccountByIdentifier } from '@/features/accounts/utils/display';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Tag, Files, ArrowRight, RotateCcw, LayoutDashboard, Heart } from 'lucide-react';
import { useVault } from '@/auth/VaultProvider';
import { encryptData } from '@/crypto/encryption';
import { saveEncryptedTransactions } from '@/server/actions/vaultItems';
import { applyPatterns } from '@/features/patterns/utils/engine';
import { PatternItem } from '@/features/patterns/types';
import { CategoryItem } from '@/features/categories/types';
import { MappingProfile } from '@/features/upload/types';
import { getHeadersFingerprint } from '@/features/upload/utils/parser';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { useEffect, useCallback } from 'react';
import { loadAccounts, loadCategories, loadMappingProfiles, loadPatterns, loadTransactions } from '@/lib/vault/loaders';
import { encryptResourceItem, type AccountItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';

interface ImportTransactionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportTransactionsDrawer({ open, onOpenChange }: ImportTransactionsDrawerProps) {
  // State for flow control
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'success'>('upload');
  const [importStats, setImportStats] = useState<{
    new: number;
    duplicates: number;
    categorized: number;
  } | null>(null);

  // Data State
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedData, setParsedData] = useState<
    (TransactionRow & { uniqueId?: string; isDuplicate?: boolean })[] | null
  >(null);
  const [existingUniqueIds, setExistingUniqueIds] = useState<Set<string>>(new Set());

  const { dek } = useVault();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [mappingProfiles, setMappingProfiles] = useState<MappingProfile[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [accountLabelDrafts, setAccountLabelDrafts] = useState<Record<string, string>>({});

  const getUniqueAccountIds = (rows: TransactionRow[]) =>
    Array.from(new Set(rows.map((row) => row.accountId?.trim()).filter((accountId): accountId is string => !!accountId)));

  const buildAccountLabelDrafts = (
    rows: TransactionRow[],
    knownAccounts: AccountItem[],
    previousDrafts: Record<string, string> = {},
  ) =>
    getUniqueAccountIds(rows).reduce<Record<string, string>>((drafts, accountId) => {
      if (previousDrafts[accountId] !== undefined) {
        drafts[accountId] = previousDrafts[accountId];
        return drafts;
      }

      drafts[accountId] = getAccountByIdentifier(knownAccounts, accountId)?.name || '';
      return drafts;
    }, {});

  const loadMetaData = useCallback(async () => {
    if (!dek) return;
    try {
      const [accountResult, categoryResult, patternResult, mappingResult, transactionResult] = await Promise.all([
        loadAccounts(dek),
        loadCategories(dek),
        loadPatterns(dek),
        loadMappingProfiles(dek),
        loadTransactions(dek),
      ]);

      setAccounts(accountResult.items as AccountItem[]);
      setCategories(categoryResult.items as CategoryItem[]);
      setPatterns(patternResult.items as PatternItem[]);
      setMappingProfiles(mappingResult.items as MappingProfile[]);
      setExistingUniqueIds(new Set(transactionResult.items.map((item) => item.uniqueId).filter(Boolean)));
    } catch (e) {
      console.error('Failed to load metadata for auto-categorization', e);
    }
  }, [dek]);

  useEffect(() => {
    if (dek) {
      loadMetaData();
    }
  }, [dek, loadMetaData]);

  const handleParseComplete = (result: ParseResult, file: File) => {
    if (result.rawData.length === 0) {
      toast({ title: 'No data found', description: 'The CSV file appears to be empty.', variant: 'destructive' });
      return;
    }
    setParseResult(result);

    // Check if we have a saved mapping for this structure
    const fingerprint = getHeadersFingerprint(result.rawHeaders);
    const existingProfile = mappingProfiles.find((p) => p.id === fingerprint);

    if (existingProfile) {
      // Auto-apply mapping and go to preview
      handleMappingConfirm(existingProfile.mapping, result);
    } else {
      // Go to mapping step
      setStep('mapping');
      toast({ title: 'File Parsed', description: 'Please map your CSV columns.' });
    }
  };

  const calculateUniqueId = async (row: TransactionRow): Promise<string> => {
    const fingerprint = [
      row.bookingDate,
      row.amount,
      row.description.trim().toLowerCase(),
      row.accountId || '',
      row.counterparty || '',
      row.bankTxId || '',
    ].join('|');

    const msgBuffer = new TextEncoder().encode(fingerprint);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  };

  const enrichWithMetadata = async (rows: TransactionRow[]) => {
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const uniqueId = await calculateUniqueId(row);
        return {
          ...row,
          uniqueId,
          isDuplicate: existingUniqueIds.has(uniqueId),
        };
      }),
    );
    return enriched;
  };

  const saveMappingProfile = async (mapping: CsvMapping, currentResult?: ParseResult) => {
    const activeResult = currentResult || parseResult;
    if (!dek || !activeResult) return;

    const fingerprint = getHeadersFingerprint(activeResult.rawHeaders);
    const profile: MappingProfile = {
      id: fingerprint,
      mapping: mapping,
      updatedAt: new Date().toISOString(),
    };

    try {
      const aad = new TextEncoder().encode('mapping_profile');
      const { ciphertextBase64, ivBase64 } = await encryptData(profile, dek, aad);
      const aadBase64 = btoa(String.fromCharCode(...aad));

      unwrap(await saveEncryptedItems(
        'mapping_profile',
        [
          {
            uniqueId: fingerprint,
            ciphertextBase64,
            ivBase64,
            aadBase64,
          },
        ],
        true,
      )); // Upsert

      // Update local state
      setMappingProfiles((prev) => {
        const index = prev.findIndex((p) => p.id === fingerprint);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = profile;
          return updated;
        }
        return [...prev, profile];
      });
    } catch (e) {
      console.error('Failed to save mapping profile', e);
    }
  };

  const handleMappingConfirm = async (mapping: CsvMapping, currentResult?: ParseResult) => {
    const activeResult = currentResult || parseResult;
    if (!activeResult) return;

    // Save mapping to vault for future use
    await saveMappingProfile(mapping, activeResult);

    // Apply mapping to raw data
    const mapped = mapRows(activeResult.rawData, mapping);

    // Apply auto-categorization patterns
    const categorized = applyPatterns(mapped, patterns);

    // Add uniqueId and duplicate status
    const enriched = await enrichWithMetadata(categorized);

    setParsedData(enriched);
    setAccountLabelDrafts((prev) => buildAccountLabelDrafts(enriched, accounts, prev));
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
    setAccountLabelDrafts({});
    setStep('upload');
  };

  const handleImport = async () => {
    if (!parsedData || !dek) return;

    setIsImporting(true);
    try {
      const uniqueAccountIds = getUniqueAccountIds(parsedData);
      const accountPayloads = [];

      for (const accountId of uniqueAccountIds) {
        const label = accountLabelDrafts[accountId]?.trim();
        if (!label) continue;

        const existingAccount = getAccountByIdentifier(accounts, accountId);
        const firstMatch = parsedData.find((row) => row.accountId === accountId);
        accountPayloads.push(
          await encryptResourceItem(
            'account',
            {
              name: label,
              identifier: accountId,
              type: existingAccount?.type || 'other',
              currency: existingAccount?.currency || firstMatch?.currency || 'EUR',
            },
            dek,
            accountId,
          ),
        );
      }

      if (accountPayloads.length > 0) {
        unwrap(await saveEncryptedItems('account', accountPayloads, true));
        setAccounts((prev) => {
          const next = [...prev];

          for (const accountId of uniqueAccountIds) {
            const label = accountLabelDrafts[accountId]?.trim();
            if (!label) continue;

            const existingIndex = next.findIndex((account) => account.identifier === accountId);
            const row = parsedData.find((item) => item.accountId === accountId);
            const nextItem: AccountItem = {
              id: existingIndex >= 0 ? next[existingIndex].id : accountId,
              uniqueId: accountId,
              identifier: accountId,
              name: label,
              type: existingIndex >= 0 ? next[existingIndex].type : 'other',
              currency: existingIndex >= 0 ? next[existingIndex].currency : row?.currency || 'EUR',
            };

            if (existingIndex >= 0) next[existingIndex] = nextItem;
            else next.push(nextItem);
          }

          return next;
        });
      }

      toast({ title: 'Encrypting...', description: `Processing ${parsedData.length} transactions locally.` });

      // 1. Encrypt Data Client-Side
      const encryptedPayloads: {
        uniqueId: string;
        ciphertextBase64: string;
        ivBase64: string;
        aadBase64: string;
      }[] = [];

      for (const row of parsedData) {
        const uniqueId = row.uniqueId || (await calculateUniqueId(row));

        const aad = new TextEncoder().encode('transaction');
        const aadBase64 = btoa(String.fromCharCode(...aad));

        const { ciphertextBase64, ivBase64 } = await encryptData(row, dek, aad);

        encryptedPayloads.push({
          uniqueId,
          ciphertextBase64,
          ivBase64,
          aadBase64,
        });
      }

      // 2. Send to Server
      toast({ title: 'Uploading...', description: 'Securely saving encrypted data to your vault.' });
      const response = unwrap(await saveEncryptedTransactions(encryptedPayloads));

      // Calculate detailed stats for the success screen
      const duplicates = parsedData.filter((d) => d.isDuplicate).length;
      const categorized = parsedData.filter((d) => !d.isDuplicate && d.categoryId).length;

      setImportStats({
        new: response.count,
        duplicates,
        categorized,
      });

      // Notify sidebar to refresh count
      window.dispatchEvent(new CustomEvent('tx-count-changed'));

      setStep('success');
    } catch (e) {
      console.error(e);
      toast({
        title: 'Import Failed',
        description: `Something went wrong: ${e instanceof Error ? e.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='max-w-[min(760px,100vw)]'>
        <SheetHeader className='border-b'>
          <SheetTitle>Import Transactions</SheetTitle>
          <SheetDescription>Upload your bank statements (CSV) to securely add them to your vault.</SheetDescription>
        </SheetHeader>
        <div className='flex-1 overflow-y-auto px-6 py-6'>
          <ProtectedVaultContent>
            <div className='space-y-6'>

              {step === 'upload' && <UploadArea onParseComplete={handleParseComplete} />}

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
                  categories={categories}
                  existingAccounts={accounts}
                  accountLabelDrafts={accountLabelDrafts}
                  onAccountLabelChange={(accountId, label) =>
                    setAccountLabelDrafts((prev) => ({
                      ...prev,
                      [accountId]: label,
                    }))
                  }
                  onBack={() => setStep('mapping')}
                  onReset={handleReset}
                  onConfirm={handleImport}
                />
              )}

              {step === 'success' && importStats && (
                <div className='max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500'>
                  <Card className='border-none shadow-2xl relative overflow-hidden'>
                    {/* Decorative Background */}
                    <div className='absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full -mr-32 -mt-32 blur-3xl' />
                    <div className='absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full -ml-32 -mb-32 blur-3xl' />

                    <CardHeader className='text-center pb-2'>
                      <div className='mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 scale-110 shadow-inner'>
                        <CheckCircle2 className='w-10 h-10 text-green-600' />
                      </div>
                      <CardTitle className='text-3xl font-black'>Import Complete!</CardTitle>
                      <CardDescription className='text-base'>Your vault has been updated successfully.</CardDescription>
                    </CardHeader>

                    <CardContent className='space-y-8 pt-6'>
                      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div className='bg-muted/40 p-4 rounded-2xl text-center space-y-1'>
                          <Files className='w-5 h-5 mx-auto text-primary opacity-60' />
                          <p className='text-2xl font-black'>{importStats.new}</p>
                          <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>New Items</p>
                        </div>
                        <div className='bg-muted/40 p-4 rounded-2xl text-center space-y-1'>
                          <AlertCircle className='w-5 h-5 mx-auto text-amber-500 opacity-60' />
                          <p className='text-2xl font-black'>{importStats.duplicates}</p>
                          <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>Duplicates</p>
                        </div>
                        <div className='bg-muted/40 p-4 rounded-2xl text-center space-y-1'>
                          <Tag className='w-5 h-5 mx-auto text-green-500 opacity-60' />
                          <p className='text-2xl font-black'>{importStats.categorized}</p>
                          <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>Categorized</p>
                        </div>
                      </div>

                      <div className='space-y-3'>
                        <Link href='/categorize' className='block'>
                          <Button className='w-full h-14 rounded-2xl text-base font-black shadow-xl group' size='lg'>
                            Start Categorizing
                            <ArrowRight className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
                          </Button>
                        </Link>
                        <div className='grid grid-cols-2 gap-3'>
                          <Button variant='outline' className='h-12 rounded-2xl font-bold gap-2' onClick={handleReset}>
                            <RotateCcw className='w-4 h-4' />
                            Import More
                          </Button>
                          <Button
                            variant='outline'
                            className='w-full h-12 rounded-2xl font-bold gap-2'
                            onClick={() => onOpenChange(false)}
                          >
                            <LayoutDashboard className='w-4 h-4' />
                            Dashboard
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <p className='text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5 opacity-60'>
                    Securely encrypted and saved to your local vault. <Heart className='w-3 h-3 text-red-400 fill-red-400' />
                  </p>
                </div>
              )}

              {/* Help / Instructions Section */}
              {step === 'upload' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Supported Formats</CardTitle>
                    <CardDescription>We support multi-bank CSV import using our smart mapper.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className='list-disc list-inside text-sm text-muted-foreground space-y-1'>
                      <li>Automatic column detection</li>
                      <li>Manual mapping verification</li>
                      <li>Deduplication on re-import</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </ProtectedVaultContent>
        </div>
      </SheetContent>
    </Sheet>
  );
}

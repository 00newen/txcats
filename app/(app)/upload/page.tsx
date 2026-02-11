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
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Tag, Files, ArrowRight, RotateCcw, LayoutDashboard, Heart } from 'lucide-react';
import { useVault } from '@/src/components/auth/VaultProvider';
import { encryptData } from '@/src/crypto/encryption';
import { saveEncryptedTransactions } from '@/src/server/actions/vaultItems';
import { fetchPatterns } from '@/src/server/actions/patterns';
import { fetchCategories } from '@/src/server/actions/categories';
import { fetchMappingProfiles } from '@/src/server/actions/mappings';
import { applyPatterns } from '@/src/features/patterns/utils/engine';
import { fetchTransactions } from '@/src/server/actions/transactions';
import { decryptData } from '@/src/crypto/encryption';
import { PatternItem } from '@/src/features/patterns/types';
import { CategoryItem } from '@/src/features/categories/types';
import { MappingProfile } from '@/src/features/upload/types';
import { getHeadersFingerprint } from '@/src/features/upload/utils/parser';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { useEffect, useCallback } from 'react';

export default function UploadPage() {
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

  const loadMetaData = useCallback(async () => {
    if (!dek) return;
    try {
      // Fetch Categories
      const catRes = await fetchCategories();
      if (catRes.success && catRes.items) {
        const decCats: CategoryItem[] = [];
        for (const item of catRes.items) {
          try {
            const aad = new TextEncoder().encode('category');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decCats.push(plain as CategoryItem);
          } catch {}
        }
        setCategories(decCats);
      }

      // Fetch Patterns
      const patRes = await fetchPatterns();
      if (patRes.success && patRes.items) {
        const decPatterns: PatternItem[] = [];
        for (const item of patRes.items) {
          try {
            const aad = new TextEncoder().encode('pattern');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decPatterns.push(plain as PatternItem);
          } catch {}
        }
        setPatterns(decPatterns);
      }

      // Fetch Mapping Profiles
      const mapRes = await fetchMappingProfiles();
      if (mapRes.success && mapRes.items) {
        const decProfiles: MappingProfile[] = [];
        for (const item of mapRes.items) {
          try {
            const aad = new TextEncoder().encode('mapping_profile');
            const plain = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aad);
            decProfiles.push(plain as MappingProfile);
          } catch {}
        }
        setMappingProfiles(decProfiles);
      }

      // Fetch Existing Transactions to identify duplicates
      const txRes = await fetchTransactions();
      if (txRes.success && txRes.items) {
        const ids = new Set(txRes.items.map((item) => item.uniqueId).filter(Boolean) as string[]);
        setExistingUniqueIds(ids);
      }
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

      await saveEncryptedItems(
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
      ); // Upsert

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
      const response = await saveEncryptedTransactions(encryptedPayloads);

      if (response && response.success) {
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
      }
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
    <ProtectedVaultContent>
      <div className='container mx-auto p-6 space-y-6'>
        <div className='flex flex-col space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>Import Transactions</h1>
          <p className='text-muted-foreground'>Upload your bank statements (CSV) to securely add them to your vault.</p>
        </div>

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
                    <Link href='/dashboard'>
                      <Button variant='outline' className='w-full h-12 rounded-2xl font-bold gap-2'>
                        <LayoutDashboard className='w-4 h-4' />
                        Dashboard
                      </Button>
                    </Link>
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
  );
}

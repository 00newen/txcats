'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CsvMapping } from '@/features/upload/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ColumnMappingProps {
    headers: string[];
    initialMapping: CsvMapping;
    onConfirm: (mapping: CsvMapping) => void;
    onCancel: () => void;
}

export function ColumnMapping({ headers, initialMapping, onConfirm, onCancel }: ColumnMappingProps) {
    const [mapping, setMapping] = useState<CsvMapping>(initialMapping);

    const handleChange = (field: keyof CsvMapping, value: any) => {
        setMapping(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const toggleExtraColumn = (col: string) => {
        const currentExtras = mapping.extraColumns || [];
        if (currentExtras.includes(col)) {
            handleChange('extraColumns', currentExtras.filter(c => c !== col));
        } else {
            handleChange('extraColumns', [...currentExtras, col]);
        }
    };

    const fields: { key: keyof CsvMapping; label: string; required: boolean; description?: string }[] = [
        { key: 'bookingDate', label: 'Booking Date', required: true },
        { key: 'amount', label: 'Amount', required: true },
        { key: 'merchantOrName', label: 'Merchant / Payee Name', required: false, description: "Display name for the transaction" },
        { key: 'description', label: 'Memo / Description', required: true, description: "Detailed transaction text" },
        { key: 'sender', label: 'Sender', required: false, description: 'Originator or payer name/account' },
        { key: 'recipient', label: 'Recipient', required: false, description: 'Beneficiary or receiving party' },
        { key: 'accountId', label: 'Account ID / IBAN', required: false },
        { key: 'counterparty', label: 'Counterparty (Legacy)', required: false, description: 'Fallback generic counterparty field' },
        { key: 'bankTxId', label: 'Bank Transaction ID', required: false },
    ];

    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = async () => {
        setIsSaving(true);
        try {
            await onConfirm(mapping);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto shadow-xl">
            <CardHeader className="border-b bg-muted/30 pb-8">
                <CardTitle className="text-2xl">Map Your Statement</CardTitle>
                <CardDescription>
                    Tell us which CSV columns represent the core transaction details. Unmapped columns are still saved securely in your vault.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm uppercase tracking-wider">
                        Standard Mapping
                    </div>
                    <div className="grid gap-6">
                        {fields.map((field) => (
                            <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 items-start gap-4 group">
                                <div className="md:pt-2">
                                    <Label className="md:text-right block font-bold text-sm">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </Label>
                                    {field.description && (
                                        <p className="text-[10px] text-muted-foreground md:text-right leading-tight mt-0.5">
                                            {field.description}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <select
                                        className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                                        value={(mapping[field.key] as string) || ''}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                    >
                                        <option value="">-- Ignore --</option>
                                        {headers.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                        Custom Visibility
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Select any additional columns you want to be directly visible in the transaction lists:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {headers.map(h => {
                            // Don't show already mapped headers in "Extras" to avoid noise
                            const isMapped = Object.values(mapping).includes(h);
                            const isSelected = mapping.extraColumns?.includes(h);

                            return (
                                <button
                                    key={h}
                                    onClick={() => toggleExtraColumn(h)}
                                    disabled={isMapped && !isSelected}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                                            : "bg-background hover:border-primary text-muted-foreground",
                                        isMapped && !isSelected && "opacity-30 cursor-not-allowed border-dashed"
                                    )}
                                >
                                    {isSelected && <span className="text-lg leading-none">×</span>}
                                    {h}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t">
                    <Button variant="ghost" onClick={onCancel} className="h-11 px-8 rounded-xl" disabled={isSaving}>Cancel</Button>
                    <Button
                        onClick={handleConfirm}
                        className="h-11 px-10 rounded-xl shadow-lg hover:translate-y-[-1px] transition-all"
                        disabled={isSaving || !mapping.bookingDate || !mapping.amount || !mapping.description}
                    >
                        {isSaving ? "Saving Structure..." : "Preview Transactions"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

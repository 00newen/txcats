'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CsvMapping } from '@/src/features/upload/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ColumnMappingProps {
    headers: string[];
    initialMapping: CsvMapping;
    onConfirm: (mapping: CsvMapping) => void;
    onCancel: () => void;
}

export function ColumnMapping({ headers, initialMapping, onConfirm, onCancel }: ColumnMappingProps) {
    const [mapping, setMapping] = useState<CsvMapping>(initialMapping);

    const handleChange = (field: keyof CsvMapping, value: string) => {
        setMapping(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const fields: { key: keyof CsvMapping; label: string; required: boolean }[] = [
        { key: 'bookingDate', label: 'Booking Date', required: true },
        { key: 'amount', label: 'Amount', required: true },
        { key: 'description', label: 'Description', required: true },
        { key: 'accountId', label: 'Account ID / IBAN', required: false },
        { key: 'counterparty', label: 'Counterparty / Payee', required: false },
        { key: 'bankTxId', label: 'Bank Transaction ID', required: false },
    ];

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>
                    Match the columns from your CSV to the required transaction fields.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4">
                    {fields.map((field) => (
                        <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                            <Label className="md:text-right font-medium">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </Label>
                            <div className="md:col-span-2">
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={mapping[field.key] || ''}
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

                <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onConfirm(mapping)}>Continue to Preview</Button>
                </div>
            </CardContent>
        </Card>
    );
}

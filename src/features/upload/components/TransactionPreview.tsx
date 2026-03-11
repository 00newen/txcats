'use client';

import { TransactionRow } from '@/features/upload/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatAmount, parseAmount } from '@/lib/amount';
import { useAmountFormat } from '@/hooks/use-amount-format';

import { CategoryItem } from '../../categories/types';

import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useState, useMemo } from 'react';

interface TransactionPreviewProps {
    data: (TransactionRow & { isDuplicate?: boolean })[];
    categories?: CategoryItem[];
    onBack: () => void;
    onReset: () => void;
    onConfirm: () => void;
}

export function TransactionPreview({ data, categories, onBack, onReset, onConfirm }: TransactionPreviewProps) {
    const [showDuplicates, setShowDuplicates] = useState(false);
    const { amountFormat } = useAmountFormat();

    // Filtered data based on toggle
    const filteredData = useMemo(() => {
        if (showDuplicates) return data;
        return data.filter(row => !row.isDuplicate);
    }, [data, showDuplicates]);

    const duplicateCount = useMemo(() => data.filter(r => r.isDuplicate).length, [data]);

    // Show only first 50 rows for preview performance
    const previewData = filteredData.slice(0, 50);

    // Calculate totals ONLY for non-duplicates (what will actually be imported)
    const { totalIncoming, totalOutgoing, importCount } = data.reduce((acc, row) => {
        if (row.isDuplicate) return acc;

        const amount = parseAmount(row.amount);
        if (isNaN(amount)) return acc;

        if (amount > 0) {
            acc.totalIncoming += amount;
        } else {
            acc.totalOutgoing += Math.abs(amount);
        }
        acc.importCount++;
        return acc;
    }, { totalIncoming: 0, totalOutgoing: 0, importCount: 0 });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-green-50/50 border-green-100 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="text-2xl font-black text-green-700">+${formatAmount(totalIncoming, amountFormat)}</div>
                        <p className="text-[10px] text-green-600/80 uppercase font-black tracking-widest">Net Incoming (New Items)</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="text-2xl font-black text-red-700">-${formatAmount(totalOutgoing, amountFormat)}</div>
                        <p className="text-[10px] text-red-600/80 uppercase font-black tracking-widest">Net Outgoing (New Items)</p>
                    </CardContent>
                </Card>
            </div>

            {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-full">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">{duplicateCount} Duplicates Detected</p>
                            <p className="text-xs text-amber-700">These transactions already exist in your vault and will be skipped.</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDuplicates(!showDuplicates)}
                        className="bg-white hover:bg-amber-100 border-amber-200 text-amber-800 font-bold gap-2"
                    >
                        {showDuplicates ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showDuplicates ? "Hide Duplicates" : "Show All"}
                    </Button>
                </div>
            )}

            <Card className="shadow-2xl border-none">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-black">Review Import</CardTitle>
                        <CardDescription>
                            {importCount} new transactions to import.
                            {duplicateCount > 0 && ` ${duplicateCount} already saved items ignored.`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button variant="ghost" onClick={onBack} size="sm" className="rounded-xl font-bold uppercase text-[10px] tracking-widest">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={importCount === 0}
                            className="flex-1 md:flex-none rounded-xl shadow-lg px-8 font-black bg-primary uppercase tracking-wider h-11"
                        >
                            {importCount === 0 ? "Nothing to Import" : `Confirm ${importCount} New TXs`}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Description</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Amount</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Type</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Category</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((row, i) => {
                                    const category = categories?.find(c => c.id === row.categoryId);
                                    const amount = parseAmount(row.amount);

                                    // Inference check (simplified as we don't have full context in this slice)
                                    const isTransfer = row.counterparty && data.some(d => d.accountId === row.counterparty);
                                    const type = isTransfer ? 'transfer' : (amount > 0 ? 'income' : 'expense');

                                    return (
                                        <TableRow key={i} className={cn(
                                            "transition-colors",
                                            row.isDuplicate ? "bg-muted/30 opacity-60" : "hover:bg-muted/20"
                                        )}>
                                            <TableCell className="font-mono text-xs whitespace-nowrap">
                                                {row.bookingDate}
                                            </TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm truncate">{row.merchantOrName}</span>
                                                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                        {row.description}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-right font-black font-mono text-sm",
                                                amount < 0 ? 'text-red-500' : 'text-green-600'
                                            )}>
                                                {isNaN(amount) ? row.amount : `${amount >= 0 ? '+' : '-'}$${formatAmount(Math.abs(amount), amountFormat)}`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "capitalize text-[9px] font-black px-2 py-0 h-5",
                                                        type === 'income' && "bg-green-50 text-green-700 border-green-200",
                                                        type === 'expense' && "bg-red-50 text-red-700 border-red-200",
                                                        type === 'transfer' && "bg-blue-50 text-blue-700 border-blue-200"
                                                    )}
                                                >
                                                    {type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {category ? (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full shadow-sm"
                                                            style={{ backgroundColor: category.color }}
                                                        />
                                                        <span className="text-[11px] font-bold">{category.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px] italic">Uncategorized</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {row.isDuplicate ? (
                                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black uppercase">
                                                        Already Saved
                                                    </Badge>
                                                ) : (
                                                    <div className="flex justify-center">
                                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {previewData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No new transactions to display.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {filteredData.length > 50 && (
                        <p className="text-[10px] text-center mt-4 text-muted-foreground font-bold uppercase tracking-widest">
                            Showing first 50 of {filteredData.length} items
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

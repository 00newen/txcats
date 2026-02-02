'use client';

import { TransactionRow } from '@/src/features/upload/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { CategoryItem } from '../../categories/types';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface TransactionPreviewProps {
    data: TransactionRow[];
    categories?: CategoryItem[];
    onBack: () => void;
    onReset: () => void;
    onConfirm: () => void;
}

export function TransactionPreview({ data, categories, onBack, onReset, onConfirm }: TransactionPreviewProps) {
    // Show only first 50 rows for preview performance
    const previewData = data.slice(0, 50);

    // Calculate totals
    const { totalIncoming, totalOutgoing } = data.reduce((acc, row) => {
        // Basic cleanup incase of currency symbols ($, €, etc)
        // Heuristic: If it has ( ) parentheses, it's negative.
        let amountStr = row.amount.replace(/[^0-9.-]/g, "");

        // Check for "100.00-" format (sometimes in ancient banks) or "(100.00)"
        if (row.amount.includes("(") || row.amount.endsWith("-")) {
            amountStr = "-" + amountStr.replace("-", "");
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount)) return acc;

        if (amount > 0) {
            acc.totalIncoming += amount;
        } else {
            acc.totalOutgoing += Math.abs(amount);
        }
        return acc;
    }, { totalIncoming: 0, totalOutgoing: 0 });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">+{totalIncoming.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Total Incoming</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-600">-{totalOutgoing.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Total Outgoing</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Preview Transactions</CardTitle>
                        <CardDescription>Found {data.length} transactions. Showing the first 50.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onBack} size="sm" className="rounded-xl">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Mapping
                        </Button>
                        <Button onClick={onConfirm} className="rounded-xl shadow-lg px-6 font-bold">
                            Import {data.length} Transactions
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>My Account</TableHead>
                                    <TableHead>Counterparty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((row, i) => {
                                    const category = categories?.find(c => c.id === row.categoryId);

                                    // Collect all account IDs for transfer inference
                                    const allAccountIds = new Set(data.map(d => d.accountId).filter(Boolean));

                                    const amount = parseFloat(row.amount.replace(/[^0-9.-]/g, ""));
                                    const isTransfer = row.counterparty && allAccountIds.has(row.counterparty);
                                    const type = isTransfer ? 'transfer' : (amount > 0 ? 'income' : 'expense');

                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {row.bookingDate ? row.bookingDate : <span className="text-red-400">Missing</span>}
                                            </TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <div className="flex flex-col">
                                                    {row.merchantOrName && <span className="font-bold text-sm">{row.merchantOrName}</span>}
                                                    <span className={cn("text-xs line-clamp-1", row.merchantOrName ? "text-muted-foreground" : "font-medium text-foreground")}>
                                                        {row.description}
                                                    </span>

                                                    {row.extraColumns && Object.keys(row.extraColumns).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {Object.entries(row.extraColumns).map(([k, v]) => (
                                                                <span key={k} className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-muted-foreground/10 text-muted-foreground whitespace-nowrap">
                                                                    <span className="font-bold opacity-60 uppercase mr-1">{k}:</span>
                                                                    {v || '-'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className={amount < 0 ? 'text-red-500 font-mono' : 'text-green-600 font-mono'}>
                                                {row.amount}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={type === 'transfer' ? 'outline' : (type === 'income' ? 'default' : 'secondary')}
                                                    className={cn(
                                                        "capitalize",
                                                        type === 'income' && "bg-green-100 text-green-800 hover:bg-green-100",
                                                        type === 'expense' && "bg-red-100 text-red-800 hover:bg-red-100",
                                                        type === 'transfer' && "bg-blue-100 text-blue-800 border-blue-200"
                                                    )}
                                                >
                                                    {type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {category ? (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: category.color }}
                                                        />
                                                        <span className="text-xs font-semibold">{category.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">Uncategorized</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {row.accountId ? <Badge variant="outline">{row.accountId}</Badge> : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {row.counterparty ? <span className="text-xs font-mono">{row.counterparty}</span> : <span className="text-muted-foreground text-xs">-</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

'use client';

import { TransactionRow } from '@/src/features/upload/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface TransactionPreviewProps {
    data: TransactionRow[];
    onReset: () => void;
    onConfirm: () => void;
}

export function TransactionPreview({ data, onReset, onConfirm }: TransactionPreviewProps) {
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
                    <div className="space-x-2">
                        <button onClick={onReset} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm">
                            Import {data.length} Transactions
                        </button>
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
                                    <TableHead>My Account</TableHead>
                                    <TableHead>Counterparty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">
                                            {row.date ? row.date : <span className="text-red-400">Missing</span>}
                                        </TableCell>
                                        <TableCell>{row.description}</TableCell>
                                        <TableCell className={parseFloat(row.amount.replace(/[^0-9.-]/g, "")) < 0 ? 'text-red-500' : 'text-green-600'}>
                                            {row.amount}
                                        </TableCell>
                                        <TableCell>
                                            {row.account ? <Badge variant="outline">{row.account}</Badge> : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {row.counterpartyAccount ? <span className="text-xs font-mono">{row.counterpartyAccount}</span> : <span className="text-muted-foreground text-xs">-</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

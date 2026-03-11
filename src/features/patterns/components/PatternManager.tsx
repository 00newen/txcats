'use client';

import { useMemo, useState } from 'react';
import { PatternItem } from '../types';
import { CategoryItem } from '../../categories/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Sparkles } from 'lucide-react';
import { useVault } from '@/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { deletePattern } from '@/server/actions/patterns';
import { loadTransactions } from '@/lib/vault/loaders';
import { encryptResourceItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';
import { matchesPattern } from '../utils/engine';

interface PatternManagerProps {
    patterns: PatternItem[];
    categories: CategoryItem[];
    onRefresh: () => void;
}

export function PatternManager({ patterns, categories, onRefresh }: PatternManagerProps) {
    const { dek } = useVault();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Pattern State
    const [matchString, setMatchString] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [matchType, setMatchType] = useState<PatternItem['matchType']>('contains');
    const [categoryFilterId, setCategoryFilterId] = useState('');

    const filteredPatterns = useMemo(() => {
        if (!categoryFilterId) return patterns;
        return patterns.filter((p) => p.categoryId === categoryFilterId);
    }, [patterns, categoryFilterId]);
    const patternCountByCategory = useMemo(() => {
        return patterns.reduce<Record<string, number>>((acc, pattern) => {
            acc[pattern.categoryId] = (acc[pattern.categoryId] || 0) + 1;
            return acc;
        }, {});
    }, [patterns]);

    const countAffectedTransactions = async (newRule: PatternItem): Promise<number> => {
        if (!dek) return 0;
        const txResult = await loadTransactions(dek);
        return txResult.items.filter((transaction) => matchesPattern(transaction, newRule)).length;
    };

    const handleAdd = async () => {
        if (!dek || !matchString.trim() || !categoryId) return;
        setIsSubmitting(true);

        try {
            const newItem: PatternItem = {
                id: crypto.randomUUID(),
                matchString: matchString.trim(),
                categoryId,
                matchType,
                priority: 0
            };

            const payload = await encryptResourceItem('pattern', newItem, dek, newItem.id);
            unwrap(await saveEncryptedItems('pattern', [payload]));

            const affectedCount = await countAffectedTransactions(newItem);
            toast({
                title: "Pattern Added",
                description: `"${matchString}" will now map to ${categories.find(c => c.id === categoryId)?.name}. ${affectedCount} TXs match this rule.`
            });
            setMatchString('');
            onRefresh();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to save pattern", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this pattern? Future imports will not be auto-categorized by this rule.")) return;

        try {
            unwrap(await deletePattern(id));
            toast({ title: "Deleted", description: "Pattern removed." });
            onRefresh();
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
        }
    };

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Auto-Categorization Rules
                </CardTitle>
                <CardDescription>
                    Define rules to automatically assign categories based on transaction descriptions.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Add Form */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b pb-6">
                    <div className="space-y-2 md:col-span-1">
                        <Label>Type</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={matchType}
                            onChange={(e) => setMatchType(e.target.value as any)}
                        >
                            <option value="contains">Contains</option>
                            <option value="exact">Exact</option>
                            <option value="regex">Regex</option>
                        </select>
                    </div>
                    <div className="space-y-2 md:col-span-1">
                        <Label>Match Text</Label>
                        <Input
                            placeholder="e.g. Netflix"
                            value={matchString}
                            onChange={e => setMatchString(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                        <Label>Assign Category</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                        >
                            <option value="">-- Select Category --</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={handleAdd} disabled={isSubmitting || !matchString || !categoryId}>
                        <Plus className="w-4 h-4 mr-2" /> Add Rule
                    </Button>
                </div>

                {/* List */}
                <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 border-b pb-4 mb-4">
                        <div className="space-y-2 sm:w-80">
                            <Label>Filter By Category</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={categoryFilterId}
                                onChange={(e) => setCategoryFilterId(e.target.value)}
                            >
                                <option value="">All categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({patternCountByCategory[c.id] || 0})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {filteredPatterns.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="bg-muted p-2 rounded-md">
                                    <Search className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm bg-accent px-1 rounded">{p.matchType}</span>
                                        <span className="font-medium">"{p.matchString}"</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        Maps to: <span className="font-semibold">{getCategoryName(p.categoryId)}</span>
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"
                                onClick={() => handleDelete(p.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    {patterns.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">
                            No rules defined yet. Add your first rule above.
                        </div>
                    )}
                    {patterns.length > 0 && filteredPatterns.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">
                            No rules map to the selected category.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

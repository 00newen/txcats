'use client';

import { useState } from 'react';
import { CategoryItem } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Tag } from 'lucide-react';
import { useVault } from '@/src/components/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { encryptData } from '@/src/crypto/encryption';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { deleteCategory } from '@/src/server/actions/categories';

interface CategoryManagerProps {
    categories: CategoryItem[];
    onRefresh: () => void;
}

export function CategoryManager({ categories, onRefresh }: CategoryManagerProps) {
    const { dek, vaultId } = useVault();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Category State
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<CategoryItem['type']>('expense');

    const handleAdd = async () => {
        if (!dek || !newName.trim()) return;
        setIsSubmitting(true);

        try {
            const newItem: CategoryItem = {
                id: crypto.randomUUID(),
                name: newName.trim(),
                type: newType,
                color: '#64748b' // Default slate-500
            };

            // Encrypt
            const aad = new TextEncoder().encode('category');
            const { ciphertextBase64, ivBase64 } = await encryptData(newItem, dek, aad);
            const aadBase64 = btoa(String.fromCharCode(...aad));

            // Save
            await saveEncryptedItems('category', [{
                uniqueId: newItem.id,
                ciphertextBase64,
                ivBase64,
                aadBase64
            }]);

            toast({ title: "Category Added", description: newItem.name });
            setNewName('');
            onRefresh();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this category? Transactions will lose this tag.")) return;

        try {
            await deleteCategory(id);
            toast({ title: "Deleted", description: "Category removed." });
            onRefresh();
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
        }
    };

    const handleSeedDefaults = async () => {
        if (!dek || !vaultId) return;
        if (!confirm("Add default categories (Housing, Utilities, etc)?")) return;

        setIsSubmitting(true);
        try {
            const { prepareDefaultCategories } = await import('../utils/defaults');
            const defaultCategories = await prepareDefaultCategories(vaultId);

            const payloads = [];
            for (const item of defaultCategories) {
                // Encrypt
                const aad = new TextEncoder().encode('category');
                const { ciphertextBase64, ivBase64 } = await encryptData(item, dek, aad);
                const aadBase64 = btoa(String.fromCharCode(...aad));

                payloads.push({
                    uniqueId: item.id,
                    ciphertextBase64,
                    ivBase64,
                    aadBase64
                });
            }

            await saveEncryptedItems('category', payloads);
            toast({ title: "Defaults Added", description: `${payloads.length} categories created.` });
            onRefresh();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Manage your income and expense categories.</CardDescription>
                </div>
                {categories.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={isSubmitting}>
                        Seed Defaults
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Add Form */}
                <div className="flex gap-4 items-end border-b pb-6">
                    <div className="space-y-2 flex-1">
                        <Label>New Category Name</Label>
                        <Input
                            placeholder="e.g. Groceries"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <div className="space-y-2 w-32">
                        <Label>Type</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as any)}
                        >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <Button onClick={handleAdd} disabled={isSubmitting || !newName}>
                        <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: cat.color }}
                                >
                                    {cat.name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{cat.name}</span>
                                    <span className="text-[10px] uppercase text-muted-foreground">{cat.type}</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"
                                onClick={() => handleDelete(cat.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    {categories.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground text-sm italic">
                            No categories yet. Add one above.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

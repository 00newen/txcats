'use client';

import { useState } from 'react';
import { CategoryItem } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus, Trash2, Pencil, Home, Plug, Utensils, Car, HeartPulse, User, Film,
    ShoppingBag, Repeat, Plane, Wallet, ArrowLeftRight, Layers,
    Briefcase, Coffee, Gift, Shirt, Hammer, Book, Smartphone, PiggyBank,
    LucideIcon, ChevronDown
} from 'lucide-react';
import { useVault } from '@/src/components/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { encryptData } from '@/src/crypto/encryption';
import { saveEncryptedItems } from '@/src/server/actions/vaultItems';
import { deleteCategory } from '@/src/server/actions/categories';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface CategoryManagerProps {
    categories: CategoryItem[];
    onRefresh: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
    'home': Home,
    'plug': Plug,
    'utensils': Utensils,
    'car': Car,
    'heart-pulse': HeartPulse,
    'user': User,
    'film': Film,
    'shopping-bag': ShoppingBag,
    'repeat': Repeat,
    'plane': Plane,
    'wallet': Wallet,
    'arrow-left-right': ArrowLeftRight,
    'layers': Layers,
    'briefcase': Briefcase,
    'coffee': Coffee,
    'gift': Gift,
    'shirt': Shirt,
    'hammer': Hammer,
    'book': Book,
    'smartphone': Smartphone,
    'piggy-bank': PiggyBank,
};

const PRESET_COLORS = [
    '#2563EB', '#0EA5E9', '#16A34A', '#F97316', '#DC2626', '#9333EA', '#DB2777',
    '#F59E0B', '#64748B', '#15803D', '#475569', '#6B7280'
];

export function CategoryManager({ categories, onRefresh }: CategoryManagerProps) {
    const { dek, vaultId } = useVault();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Category State
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
    const [newIcon, setNewIcon] = useState('layers');
    const [newParentId, setNewParentId] = useState<string>('');
    const [isIconSelectOpen, setIsIconSelectOpen] = useState(false);

    // Edit State
    const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [editParentId, setEditParentId] = useState<string>('');
    const [isEditIconSelectOpen, setIsEditIconSelectOpen] = useState(false);

    const handleAdd = async () => {
        if (!dek || !newName.trim()) return;
        setIsSubmitting(true);

        try {
            const newItem: CategoryItem = {
                id: crypto.randomUUID(),
                name: newName.trim(),
                color: newColor,
                icon: newIcon,
                parentId: newParentId || undefined
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

    const handleUpdate = async () => {
        if (!dek || !editingCategory || !editName.trim()) return;
        setIsSubmitting(true);

        try {
            const updatedItem: CategoryItem = {
                ...editingCategory,
                name: editName.trim(),
                color: editColor,
                icon: editIcon,
                parentId: editParentId || undefined
            };

            // Encrypt
            const aad = new TextEncoder().encode('category');
            const { ciphertextBase64, ivBase64 } = await encryptData(updatedItem, dek, aad);
            const aadBase64 = btoa(String.fromCharCode(...aad));

            // Save with upsertMode=true
            await saveEncryptedItems('category', [{
                uniqueId: updatedItem.id,
                ciphertextBase64,
                ivBase64,
                aadBase64
            }], true);

            toast({ title: "Category Updated", description: updatedItem.name });
            setEditingCategory(null);
            onRefresh();
        } catch (e) {
            console.error(e);
            toast({ title: "Update Failed", variant: "destructive" });
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

    const openEdit = (cat: CategoryItem) => {
        setEditingCategory(cat);
        setEditName(cat.name);
        setEditColor(cat.color);
        setEditIcon(cat.icon);
        setEditParentId(cat.parentId || '');
        setIsEditIconSelectOpen(false);
    };

    const SelectedIcon = ICON_MAP[newIcon] || Layers;
    const EditSelectedIcon = ICON_MAP[editIcon] || Layers;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Manage your transaction categories.</CardDescription>
                </div>
                {categories.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={isSubmitting}>
                        Seed Defaults
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Add Form - Limited width row */}
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-end border-b pb-8">
                    <div className="space-y-2 w-full md:w-64">
                        <Label>Category Name</Label>
                        <Input
                            placeholder="e.g. Groceries"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="h-10"
                        />
                    </div>

                    <div className="space-y-2 w-full md:w-56 relative">
                        <Label>Icon</Label>
                        <button
                            type="button"
                            onClick={() => setIsIconSelectOpen(!isIconSelectOpen)}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <div className="flex items-center gap-2">
                                <SelectedIcon className="w-4 h-4" />
                                <span className="capitalize">{newIcon.replace(/-/g, ' ')}</span>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isIconSelectOpen && "rotate-180 text-muted-foreground")} />
                        </button>

                        {isIconSelectOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsIconSelectOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-1 w-full max-h-60 bg-white dark:bg-black overflow-auto rounded-md border p-1 text-popover-foreground shadow-md z-20">
                                    {Object.entries(ICON_MAP).map(([name, Icon]) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => {
                                                setNewIcon(name);
                                                setIsIconSelectOpen(false);
                                            }}
                                            className={cn(
                                                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                newIcon === name && "bg-accent text-accent-foreground"
                                            )}
                                        >
                                            <Icon className="mr-2 h-4 w-4" />
                                            <span className="capitalize">{name.replace(/-/g, ' ')}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2 w-full md:w-48">
                        <Label>Parent Category</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={newParentId}
                            onChange={(e) => setNewParentId(e.target.value)}
                        >
                            <option value="">None</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewColor(color)}
                                    className={cn(
                                        "w-8 h-8 rounded-full border-2 transition-all",
                                        newColor === color ? "border-primary scale-110" : "border-transparent"
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleAdd} disabled={isSubmitting || !newName} className="h-10 px-6">
                        <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map(cat => {
                        const Icon = ICON_MAP[cat.icon] || Layers;
                        return (
                            <div key={cat.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-all group shadow-sm hover:shadow-md">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                                        style={{ backgroundColor: cat.color }}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{cat.name}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                                        onClick={() => openEdit(cat)}
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                                        onClick={() => handleDelete(cat.id)}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    {categories.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground text-sm italic border-2 border-dashed rounded-xl">
                            No categories yet. Use "Seed Defaults" or add one above.
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Edit Modal */}
            <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent className="sm:max-w-[500px] bg-white">
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>
                            Update the name, icon, and color for this category.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder="Category Name"
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <Label>Icon</Label>
                            <button
                                type="button"
                                onClick={() => setIsEditIconSelectOpen(!isEditIconSelectOpen)}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <div className="flex items-center gap-2">
                                    <EditSelectedIcon className="w-4 h-4" />
                                    <span className="capitalize">{editIcon.replace(/-/g, ' ')}</span>
                                </div>
                                <ChevronDown className={cn("w-4 h-4 transition-transform", isEditIconSelectOpen && "rotate-180 text-muted-foreground")} />
                            </button>

                            {isEditIconSelectOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-auto rounded-md border p-1 text-popover-foreground shadow-md z-[60]">
                                    {Object.entries(ICON_MAP).map(([name, Icon]) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => {
                                                setEditIcon(name);
                                                setIsEditIconSelectOpen(false);
                                            }}
                                            className={cn(
                                                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                editIcon === name && "bg-accent text-accent-foreground"
                                            )}
                                        >
                                            <Icon className="mr-2 h-4 w-4" />
                                            <span className="capitalize">{name.replace(/-/g, ' ')}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Parent Category</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                                value={editParentId}
                                onChange={(e) => setEditParentId(e.target.value)}
                            >
                                <option value="">None</option>
                                {categories
                                    .filter(c => c.id !== editingCategory?.id)
                                    .map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setEditColor(color)}
                                        className={cn(
                                            "w-8 h-8 rounded-full border-2 transition-all",
                                            editColor === color ? "border-primary scale-110" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCategory(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdate} disabled={isSubmitting || !editName.trim()}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

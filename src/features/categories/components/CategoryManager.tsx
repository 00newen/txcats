'use client';

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { CategoryItem } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus, Trash2, Pencil, Layers, ChevronDown, GripVertical, Receipt
} from 'lucide-react';
import { useVault } from '@/auth/VaultProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEncryptedItems } from '@/server/actions/vaultItems';
import { deleteCategory } from '@/server/actions/categories';
import { cn } from '@/lib/utils';
import { encryptResourceItem } from '@/lib/vault/resources';
import { unwrap } from '@/lib/actions/result';
import { CATEGORY_ICON_MAP } from '@/features/categories/utils/icons';
import { buildCategoryTree, isDescendantCategory } from '@/features/categories/utils/tree';
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
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
    const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
    const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
    const [isOverRootDropZone, setIsOverRootDropZone] = useState(false);

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

            const payload = await encryptResourceItem('category', newItem, dek, newItem.id);
            unwrap(await saveEncryptedItems('category', [payload]));

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

            const payload = await encryptResourceItem('category', updatedItem, dek, updatedItem.id);
            unwrap(await saveEncryptedItems('category', [payload], true));

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
            unwrap(await deleteCategory(id));
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
                payloads.push(await encryptResourceItem('category', item, dek, item.id));
            }

            unwrap(await saveEncryptedItems('category', payloads));
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

    const { categoriesById, rootCategories, childrenByParentId } = useMemo(
        () => buildCategoryTree(categories),
        [categories],
    );

    useEffect(() => {
        const validIds = new Set(categories.map((c) => c.id));
        setExpandedCategoryIds((prev) => {
            const next = new Set<string>();
            prev.forEach((id) => {
                if (validIds.has(id)) next.add(id);
            });
            return next;
        });
    }, [categories]);

    const renderCategoryNode = (cat: CategoryItem, depth: number, path: Set<string>): ReactNode => {
        if (path.has(cat.id)) return null;

        const Icon = CATEGORY_ICON_MAP[cat.icon] || Layers;
        const children = childrenByParentId.get(cat.id) || [];
        const hasChildren = children.length > 0;
        const isExpanded = hasChildren && expandedCategoryIds.has(cat.id);
        const nextPath = new Set(path);
        nextPath.add(cat.id);
        const parentName = cat.parentId ? categoriesById.get(cat.parentId)?.name : null;
        const transactionsHref = `/transactions?category=${encodeURIComponent(cat.id)}`;

        const isDropTarget = dragOverCategoryId === cat.id && draggingCategoryId !== cat.id;

        return (
            <div key={cat.id} className="space-y-2">
                <div
                    className={cn(
                        "flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-all group shadow-sm hover:shadow-md",
                        isDropTarget && "ring-2 ring-primary/60 border-primary/50 bg-primary/5"
                    )}
                    style={{ marginLeft: `${depth * 18}px` }}
                    onDragOver={(e) => handleDragOverCategory(e, cat.id)}
                    onDragEnter={(e) => handleDragOverCategory(e, cat.id)}
                    onDragLeave={() => setDragOverCategoryId((prev) => (prev === cat.id ? null : prev))}
                    onDrop={(e) => handleDropOnCategory(e, cat.id)}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            type="button"
                            draggable
                            onDragStart={(e) => handleDragStart(e, cat.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-grab active:cursor-grabbing shrink-0",
                                isSubmitting && "pointer-events-none opacity-40"
                            )}
                            title="Drag to re-parent"
                            disabled={isSubmitting}
                        >
                            <GripVertical className="w-4 h-4" />
                        </button>
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0"
                            style={{ backgroundColor: cat.color }}
                        >
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-sm truncate">{cat.name}</span>
                                {hasChildren && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                        {children.length}
                                    </span>
                                )}
                            </div>
                            {parentName && (
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                                    Child of {parentName}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        {hasChildren && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                                onClick={() =>
                                    setExpandedCategoryIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(cat.id)) next.delete(cat.id);
                                        else next.add(cat.id);
                                        return next;
                                    })
                                }
                                title={isExpanded ? "Collapse children" : "Expand children"}
                            >
                                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                            </Button>
                        )}
                        <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                            title={`View transactions for ${cat.name}`}
                        >
                            <Link href={transactionsHref}>
                                <Receipt className="w-4 h-4" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                            onClick={() => openEdit(cat)}
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                            onClick={() => handleDelete(cat.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="border-l border-dashed border-border/70 ml-4 pl-1">
                        {children.map((child) => renderCategoryNode(child, depth + 1, nextPath))}
                    </div>
                )}
            </div>
        );
    };

    const SelectedIcon = CATEGORY_ICON_MAP[newIcon] || Layers;
    const EditSelectedIcon = CATEGORY_ICON_MAP[editIcon] || Layers;

    const updateCategoryParent = async (categoryId: string, nextParentId?: string) => {
        if (!dek) return;
        const existing = categoriesById.get(categoryId);
        if (!existing) return;

        const currentParent = existing.parentId || undefined;
        if (currentParent === nextParentId) return;

        setIsSubmitting(true);
        try {
            const updatedItem: CategoryItem = { ...existing, parentId: nextParentId };
            const payload = await encryptResourceItem('category', updatedItem, dek, updatedItem.id);
            unwrap(await saveEncryptedItems('category', [payload], true));

            onRefresh();
        } catch (e) {
            console.error(e);
            toast({ title: "Update Failed", description: "Could not update parent relationship.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDraggingCategoryId = (e: DragEvent<HTMLElement>): string | null => {
        const fromEvent = e.dataTransfer.getData('application/x-txcats-category-id');
        return fromEvent || draggingCategoryId;
    };

    const handleDragStart = (e: DragEvent<HTMLElement>, categoryId: string) => {
        if (isSubmitting) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-txcats-category-id', categoryId);
        setDraggingCategoryId(categoryId);
    };

    const handleDragEnd = () => {
        setDraggingCategoryId(null);
        setDragOverCategoryId(null);
        setIsOverRootDropZone(false);
    };

    const handleDragOverCategory = (e: DragEvent<HTMLElement>, categoryId: string) => {
        if (!draggingCategoryId || categoryId === draggingCategoryId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsOverRootDropZone(false);
        setDragOverCategoryId(categoryId);
    };

    const handleDropOnCategory = async (e: DragEvent<HTMLElement>, targetCategoryId: string) => {
        e.preventDefault();
        const draggedId = getDraggingCategoryId(e);
        handleDragEnd();
        if (!draggedId || draggedId === targetCategoryId) return;

        if (isDescendantCategory(categoriesById, targetCategoryId, draggedId)) {
            toast({
                title: "Invalid Move",
                description: "A category cannot be moved under itself or one of its descendants.",
                variant: "destructive"
            });
            return;
        }

        await updateCategoryParent(draggedId, targetCategoryId);
        setExpandedCategoryIds((prev) => {
            const next = new Set(prev);
            next.add(targetCategoryId);
            return next;
        });
    };

    const handleDragOverRoot = (e: DragEvent<HTMLElement>) => {
        if (!draggingCategoryId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCategoryId(null);
        setIsOverRootDropZone(true);
    };

    const handleDropOnRoot = async (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const draggedId = getDraggingCategoryId(e);
        handleDragEnd();
        if (!draggedId) return;
        await updateCategoryParent(draggedId, undefined);
    };

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
                                    {Object.entries(CATEGORY_ICON_MAP).map(([name, Icon]) => (
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

                {/* Tree List */}
                <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                    <div
                        className={cn(
                            "rounded-lg border border-dashed px-3 py-2 text-[11px] font-semibold text-muted-foreground",
                            draggingCategoryId ? "transition-colors" : "",
                            isOverRootDropZone && "border-primary bg-primary/5 text-primary"
                        )}
                        onDragOver={handleDragOverRoot}
                        onDragEnter={handleDragOverRoot}
                        onDragLeave={() => setIsOverRootDropZone(false)}
                        onDrop={handleDropOnRoot}
                    >
                        Drop here to move category to top level
                    </div>
                    {rootCategories.map((cat) => renderCategoryNode(cat, 0, new Set<string>()))}
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
                                <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-[60]">
                                    {Object.entries(CATEGORY_ICON_MAP).map(([name, Icon]) => (
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

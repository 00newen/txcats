export type CategoryItem = {
  id: string; // Deterministic or UUID
  name: string;
  type: 'income' | 'expense' | 'other';
  color: string;
  icon?: string;
  parentId?: string;
  isDefault?: boolean;
};

export interface DefaultCategoryDefinition {
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'other';
}

export const DEFAULT_CATEGORY_SET: DefaultCategoryDefinition[] = [
  { name: 'Housing', icon: 'home', color: '#2563EB', type: 'expense' },
  { name: 'Utilities', icon: 'plug', color: '#0EA5E9', type: 'expense' },
  { name: 'Food & Dining', icon: 'utensils', color: '#16A34A', type: 'expense' },
  { name: 'Transportation', icon: 'car', color: '#F97316', type: 'expense' },
  { name: 'Health', icon: 'heart-pulse', color: '#DC2626', type: 'expense' },
  { name: 'Personal', icon: 'user', color: '#9333EA', type: 'expense' },
  { name: 'Entertainment', icon: 'film', color: '#DB2777', type: 'expense' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#F59E0B', type: 'expense' },
  { name: 'Subscriptions', icon: 'repeat', color: '#64748B', type: 'expense' },
  { name: 'Travel', icon: 'plane', color: '#0284C7', type: 'expense' },
  { name: 'Income', icon: 'wallet', color: '#15803D', type: 'income' },
  { name: 'Transfers', icon: 'arrow-left-right', color: '#475569', type: 'other' },
  { name: 'Other', icon: 'layers', color: '#6B7280', type: 'other' },
];

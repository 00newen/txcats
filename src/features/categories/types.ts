export type CategoryItem = {
  id: string; // Deterministic or UUID
  name: string;
  color: string;
  icon: string;
  parentId?: string;
  isDefault?: boolean;
};

export interface DefaultCategoryDefinition {
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORY_SET: DefaultCategoryDefinition[] = [
  { name: 'Housing', icon: 'home', color: '#2563EB' },
  { name: 'Utilities', icon: 'plug', color: '#0EA5E9' },
  { name: 'Food & Dining', icon: 'utensils', color: '#16A34A' },
  { name: 'Transportation', icon: 'car', color: '#F97316' },
  { name: 'Health', icon: 'heart-pulse', color: '#DC2626' },
  { name: 'Personal', icon: 'user', color: '#9333EA' },
  { name: 'Entertainment', icon: 'film', color: '#DB2777' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#F59E0B' },
  { name: 'Subscriptions', icon: 'repeat', color: '#64748B' },
  { name: 'Travel', icon: 'plane', color: '#0284C7' },
  { name: 'Income', icon: 'wallet', color: '#15803D' },
  { name: 'Transfers', icon: 'arrow-left-right', color: '#475569' },
  { name: 'Other', icon: 'layers', color: '#6B7280' },
];

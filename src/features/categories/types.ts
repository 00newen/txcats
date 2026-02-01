export type CategoryItem = {
  id: string; // UUID (Client generated)
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon?: string;
  parentId?: string;
};

export const DEFAULT_CATEGORIES: Omit<CategoryItem, 'id'>[] = [
    { name: 'Groceries', type: 'expense', color: '#16a34a', icon: 'shopping-cart' }, // green-600
    { name: 'Rent', type: 'expense', color: '#ea580c', icon: 'home' }, // orange-600
    { name: 'Utilities', type: 'expense', color: '#ca8a04', icon: 'zap' }, // yellow-600
    { name: 'Salary', type: 'income', color: '#2563eb', icon: 'briefcase' }, // blue-600
    { name: 'Dining Out', type: 'expense', color: '#db2777', icon: 'utensils' }, // pink-600
    { name: 'Transport', type: 'expense', color: '#7c3aed', icon: 'car' }, // violet-600
];

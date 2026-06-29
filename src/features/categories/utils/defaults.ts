import { CategoryItem, DEFAULT_CATEGORY_SET } from '../types';

/**
 * Generates a deterministic ID for a category based on the vault ID and normalized category name.
 */
export async function generateCategoryId(vaultId: string, name: string): Promise<string> {
  const normalizedName = name.trim().toLowerCase();
  const input = `${vaultId}:${normalizedName}`;
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  // Convert to hex string for cleaner IDs
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Prepares the default category items for a specific vault.
 */
export async function prepareDefaultCategories(vaultId: string): Promise<CategoryItem[]> {
  return Promise.all(
    DEFAULT_CATEGORY_SET.map(async (def) => ({
      id: await generateCategoryId(vaultId, def.name),
      name: def.name,
      color: def.color,
      icon: def.icon,
      isDefault: true,
    }))
  );
}

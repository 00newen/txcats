import type { AccountItem } from '@/lib/vault/resources';

export function maskAccountIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(/\s+/g, '');
  const visiblePart = compact.slice(-4) || compact;

  return compact.length <= 4 ? compact : `••••${visiblePart}`;
}

export function getAccountByIdentifier(accounts: AccountItem[], identifier?: string): AccountItem | undefined {
  if (!identifier) return undefined;
  return accounts.find((account) => account.identifier === identifier);
}

export function getAccountDisplay(accounts: AccountItem[], identifier?: string): {
  label: string;
  secondary: string;
  hasCustomLabel: boolean;
} {
  if (!identifier) {
    return {
      label: '',
      secondary: '',
      hasCustomLabel: false,
    };
  }

  const account = getAccountByIdentifier(accounts, identifier);
  const maskedIdentifier = maskAccountIdentifier(identifier);

  if (account?.name?.trim()) {
    return {
      label: account.name.trim(),
      secondary: maskedIdentifier,
      hasCustomLabel: true,
    };
  }

  return {
    label: maskedIdentifier,
    secondary: 'No label yet',
    hasCustomLabel: false,
  };
}

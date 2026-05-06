export const PRIVACY_MODE_STORAGE_KEY = 'txcats-privacy-mode';
export const PRIVACY_MODE_CHANGED_EVENT = 'txcats-privacy-mode-changed';

export function resolvePrivacyMode(value: string | null | undefined): boolean {
  return value === 'true';
}

export function maskAmountText(value: string): string {
  if (!value) return value;

  const sign = value.trim().startsWith('-') ? '-' : value.trim().startsWith('+') ? '+' : '';
  const hasDollar = value.includes('$');
  const hasEuro = value.includes('€');
  const currency = hasDollar ? '$' : hasEuro ? '€' : '';

  return `${sign}${currency}•••••`;
}

export function maskSensitiveText(value: string | null | undefined): string {
  if (!value) return '';
  return '•••••';
}

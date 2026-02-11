export type AmountDisplayFormat = 'us' | 'eu' | 'space';

export const AMOUNT_FORMAT_STORAGE_KEY = 'txcats-amount-display-format';
export const DEFAULT_AMOUNT_DISPLAY_FORMAT: AmountDisplayFormat = 'us';

export function isAmountDisplayFormat(value: string | null | undefined): value is AmountDisplayFormat {
  return value === 'us' || value === 'eu' || value === 'space';
}

export function resolveAmountDisplayFormat(value: string | null | undefined): AmountDisplayFormat {
  return isAmountDisplayFormat(value) ? value : DEFAULT_AMOUNT_DISPLAY_FORMAT;
}

export function parseAmount(rawAmount: string): number {
  if (!rawAmount) return NaN;

  let normalized = rawAmount.trim();
  if (!normalized) return NaN;

  let isNegative = false;
  if (normalized.startsWith('-')) {
    isNegative = true;
    normalized = normalized.slice(1);
  }
  if (normalized.endsWith('-')) {
    isNegative = true;
    normalized = normalized.slice(0, -1);
  }
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    isNegative = true;
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\s+/g, '').replace(/[^\d.,]/g, '');
  if (!normalized) return NaN;

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const hasDot = lastDot !== -1;
  const hasComma = lastComma !== -1;

  if (hasDot && hasComma) {
    if (lastDot > lastComma) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    const decimals = normalized.length - lastComma - 1;
    if (decimals >= 1 && decimals <= 2) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasDot) {
    const decimals = normalized.length - lastDot - 1;
    if (!(decimals >= 1 && decimals <= 2)) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return NaN;
  return isNegative ? -Math.abs(parsed) : parsed;
}

export function formatAmount(value: number, format: AmountDisplayFormat): string {
  const locale =
    format === 'eu' ? 'de-DE' :
    format === 'space' ? 'fr-FR' :
    'en-US';

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getFormatLabel(format: AmountDisplayFormat): string {
  if (format === 'eu') return '1.234,56';
  if (format === 'space') return '1 234,56';
  return '1,234.56';
}

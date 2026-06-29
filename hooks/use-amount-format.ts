'use client';

import { useEffect, useState } from 'react';
import {
  AMOUNT_FORMAT_STORAGE_KEY,
  AmountDisplayFormat,
  DEFAULT_AMOUNT_DISPLAY_FORMAT,
  resolveAmountDisplayFormat,
} from '@/lib/amount';

export function useAmountFormat() {
  const [amountFormat, setAmountFormat] = useState<AmountDisplayFormat>(DEFAULT_AMOUNT_DISPLAY_FORMAT);

  useEffect(() => {
    const saved = localStorage.getItem(AMOUNT_FORMAT_STORAGE_KEY);
    setAmountFormat(resolveAmountDisplayFormat(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(AMOUNT_FORMAT_STORAGE_KEY, amountFormat);
  }, [amountFormat]);

  return { amountFormat, setAmountFormat };
}

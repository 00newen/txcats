'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  PRIVACY_MODE_CHANGED_EVENT,
  PRIVACY_MODE_STORAGE_KEY,
  resolvePrivacyMode,
} from '@/lib/privacy';

export function usePrivacyMode() {
  const [privacyMode, setPrivacyModeState] = useState(false);

  useEffect(() => {
    const load = () => setPrivacyModeState(resolvePrivacyMode(localStorage.getItem(PRIVACY_MODE_STORAGE_KEY)));

    load();
    window.addEventListener('storage', load);
    window.addEventListener(PRIVACY_MODE_CHANGED_EVENT, load);

    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(PRIVACY_MODE_CHANGED_EVENT, load);
    };
  }, []);

  const setPrivacyMode = useCallback((enabled: boolean) => {
    localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    setPrivacyModeState(enabled);
    window.dispatchEvent(new CustomEvent(PRIVACY_MODE_CHANGED_EVENT));
  }, []);

  return { privacyMode, setPrivacyMode };
}

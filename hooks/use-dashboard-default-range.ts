'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  DASHBOARD_DEFAULT_RANGE_CHANGED_EVENT,
  DASHBOARD_DEFAULT_RANGE_STORAGE_KEY,
  DEFAULT_DASHBOARD_DEFAULT_RANGE,
  resolveDashboardDefaultRange,
  type DashboardDefaultRange,
} from '@/lib/dashboard-range';

export function useDashboardDefaultRange() {
  const [dashboardDefaultRange, setDashboardDefaultRangeState] = useState<DashboardDefaultRange>(DEFAULT_DASHBOARD_DEFAULT_RANGE);

  useEffect(() => {
    const load = () => setDashboardDefaultRangeState(resolveDashboardDefaultRange(localStorage.getItem(DASHBOARD_DEFAULT_RANGE_STORAGE_KEY)));

    load();
    window.addEventListener('storage', load);
    window.addEventListener(DASHBOARD_DEFAULT_RANGE_CHANGED_EVENT, load);

    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(DASHBOARD_DEFAULT_RANGE_CHANGED_EVENT, load);
    };
  }, []);

  const setDashboardDefaultRange = useCallback((range: DashboardDefaultRange) => {
    localStorage.setItem(DASHBOARD_DEFAULT_RANGE_STORAGE_KEY, range);
    setDashboardDefaultRangeState(range);
    window.dispatchEvent(new CustomEvent(DASHBOARD_DEFAULT_RANGE_CHANGED_EVENT));
  }, []);

  return { dashboardDefaultRange, setDashboardDefaultRange };
}

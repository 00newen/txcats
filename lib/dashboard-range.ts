import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays } from 'date-fns';

export type DashboardDefaultRange = 'currentMonth' | 'last30Days' | 'currentYear' | 'allTime';

export const DASHBOARD_DEFAULT_RANGE_STORAGE_KEY = 'txcats-dashboard-default-range';
export const DASHBOARD_DEFAULT_RANGE_CHANGED_EVENT = 'txcats-dashboard-default-range-changed';
export const DEFAULT_DASHBOARD_DEFAULT_RANGE: DashboardDefaultRange = 'currentMonth';

export function resolveDashboardDefaultRange(value: string | null | undefined): DashboardDefaultRange {
  if (value === 'last30Days') return 'last30Days';
  if (value === 'currentYear') return 'currentYear';
  if (value === 'allTime') return 'allTime';
  return DEFAULT_DASHBOARD_DEFAULT_RANGE;
}

export function getDashboardDefaultDateRange(
  range: DashboardDefaultRange,
  bounds?: { min: string; max: string } | null,
  now = new Date(),
) {
  if (range === 'allTime' && bounds) {
    return { startDate: bounds.min, endDate: bounds.max };
  }

  if (range === 'last30Days') {
    const endDate = bounds?.max || format(now, 'yyyy-MM-dd');
    return {
      startDate: format(subDays(new Date(`${endDate}T00:00:00`), 29), 'yyyy-MM-dd'),
      endDate,
    };
  }

  if (range === 'currentYear') {
    return {
      startDate: format(startOfYear(now), 'yyyy-MM-dd'),
      endDate: format(endOfYear(now), 'yyyy-MM-dd'),
    };
  }

  return {
    startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}

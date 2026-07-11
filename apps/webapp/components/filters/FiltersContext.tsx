'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DASHBOARD_FILTER_QUERY_KEYS,
  DashboardFilters,
  defaultFilters,
  parseDashboardFilters,
  serializeDashboardFilters,
} from './DashboardFilters';

interface FiltersContextInterface {
  filters: DashboardFilters;
  updateFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  applyFilters: (nextFilters: DashboardFilters) => void;
  resetFilters: () => void;
}

const FiltersContext = createContext<FiltersContextInterface | undefined>(undefined);

function areDashboardFiltersEqual(left: DashboardFilters, right: DashboardFilters): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
}

function applyBrowserTimezone(filters: DashboardFilters): DashboardFilters {
  const browserTimezone = getBrowserTimezone();
  if (!browserTimezone || filters.timezone === browserTimezone) {
    return filters;
  }

  return { ...filters, timezone: browserTimezone };
}

export const useFilters = () => {
  const context = useContext(FiltersContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FiltersProvider');
  }
  return context;
};

export const FiltersProvider = ({
  initialFilters,
  children,
}: {
  initialFilters?: DashboardFilters;
  children?: ReactNode | undefined;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const urlSyncKey = useMemo(
    () => JSON.stringify({ initialFilters, searchParams: searchParamsString }),
    [initialFilters, searchParamsString],
  );

  const initialUrlFilters = useMemo(
    () => applyBrowserTimezone(parseDashboardFilters(Object.fromEntries(searchParams.entries()), initialFilters)),
    [initialFilters, searchParams],
  );

  const [filters, setFilters] = useState<DashboardFilters>(initialUrlFilters);
  const shouldSyncToUrl = useRef(false);
  const lastUrlSyncKey = useRef(urlSyncKey);

  useEffect(() => {
    if (shouldSyncToUrl.current) return;
    if (lastUrlSyncKey.current === urlSyncKey) return;
    lastUrlSyncKey.current = urlSyncKey;

    const urlFilters = applyBrowserTimezone(parseDashboardFilters(Object.fromEntries(searchParams.entries()), initialFilters));

    queueMicrotask(() => {
      setFilters((currentFilters) =>
        areDashboardFiltersEqual(currentFilters, urlFilters) ? currentFilters : urlFilters,
      );
    });
  }, [initialFilters, searchParams, urlSyncKey]);

  useEffect(() => {
    if (!shouldSyncToUrl.current) return;

    shouldSyncToUrl.current = false;
    const nextParams = serializeDashboardFilters(filters);
    const mergedParams = new URLSearchParams(searchParamsString);

    for (const key of DASHBOARD_FILTER_QUERY_KEYS) {
      mergedParams.delete(key);
    }

    for (const [key, value] of nextParams.entries()) {
      mergedParams.append(key, value);
    }

    const queryString = mergedParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [filters, pathname, router, searchParamsString]);

  const updateFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    shouldSyncToUrl.current = true;
  }, []);

  const applyFilters = useCallback((nextFilters: DashboardFilters) => {
    setFilters(applyBrowserTimezone({ ...nextFilters }));
    shouldSyncToUrl.current = true;
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...defaultFilters, timezone: getBrowserTimezone() });
    shouldSyncToUrl.current = true;
  }, []);

  const contextValue = useMemo(
    () => ({ filters, updateFilter, applyFilters, resetFilters }),
    [applyFilters, filters, resetFilters, updateFilter],
  );

  return (
    <FiltersContext.Provider value={contextValue}>
      {children}
    </FiltersContext.Provider>
  );
};

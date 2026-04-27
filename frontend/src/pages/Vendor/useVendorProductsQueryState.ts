import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizePositiveInteger } from './vendorHelpers';
import { normalizeProductTab } from './vendorProducts.constants';

interface UseVendorProductsQueryStateOptions {
  onScopeChange?: () => void;
}

export const useVendorProductsQueryState = ({ onScopeChange }: UseVendorProductsQueryStateOptions = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeProductTab(searchParams.get('status'));
  const page = normalizePositiveInteger(searchParams.get('page'));
  const keyword = (searchParams.get('q') || '').trim();

  const updateQuery = useCallback(
    (mutate: (query: URLSearchParams) => void, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const handleTabChange = useCallback((key: string) => {
    const nextTab = normalizeProductTab(key);
    onScopeChange?.();
    updateQuery((query) => {
      if (nextTab === 'all') {
        query.delete('status');
      } else {
        query.set('status', nextTab);
      }
      query.set('page', '1');
    });
  }, [onScopeChange, updateQuery]);

  const setPage = useCallback((nextPage: number) => {
    updateQuery((query) => {
      query.set('page', String(Math.max(1, nextPage)));
    });
  }, [updateQuery]);

  const resetCurrentView = useCallback(() => {
    onScopeChange?.();
    setSearchParams(new URLSearchParams());
  }, [onScopeChange, setSearchParams]);

  return {
    activeTab,
    page,
    keyword,
    updateQuery,
    handleTabChange,
    setPage,
    resetCurrentView,
  };
};

import { useState, useCallback } from "react";

export interface SortOption<V extends string = string> {
  label: string;
  value: V;
}

export function useListState<V extends string = string>(defaultSort: V) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sortType, setSortType] = useState<V>(defaultSort);
  const [isSorting, setIsSorting] = useState(false);
  const [sortIndex, setSortIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  const handleFilterChange = useCallback((val: string) => {
    const sanitized = val.replace(/^\/+/, "");
    setFilterQuery(sanitized);
  }, []);

  const activateFilter = useCallback(() => {
    setIsFiltering(true);
    setFilterQuery("");
    setSelectedIndex(0);
  }, []);

  const exitFilter = useCallback(() => {
    setIsFiltering(false);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterQuery("");
  }, []);

  const activateSort = useCallback(() => {
    setIsSorting(true);
    setSortIndex(0);
  }, []);

  const exitSort = useCallback(() => {
    setIsSorting(false);
  }, []);

  const navigateUp = useCallback((maxIndex: number) => {
    setSelectedIndex(p => Math.max(0, p - 1));
  }, []);

  const navigateDown = useCallback((maxIndex: number) => {
    setSelectedIndex(p => Math.min(maxIndex, p + 1));
  }, []);

  return {
    selectedIndex,
    setSelectedIndex,
    sortType,
    setSortType,
    isSorting,
    setIsSorting,
    sortIndex,
    setSortIndex,
    filterQuery,
    setFilterQuery,
    isFiltering,
    setIsFiltering,
    handleFilterChange,
    activateFilter,
    exitFilter,
    clearFilter,
    activateSort,
    exitSort,
    navigateUp,
    navigateDown,
  };
}
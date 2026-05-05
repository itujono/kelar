import { useMemo } from "react";

interface WindowedSliceResult<T> {
  visibleItems: T[];
  startIndex: number;
}

export function useWindowedSlice<T>(
  items: T[],
  selectedIndex: number,
  windowSize: number
): WindowedSliceResult<T> {
  return useMemo(() => {
    const total = items.length;
    const startIndex = Math.max(
      0,
      Math.min(
        selectedIndex - Math.floor(windowSize / 2),
        Math.max(0, total - windowSize)
      )
    );
    const visibleItems = items.slice(startIndex, startIndex + windowSize);
    return { visibleItems, startIndex };
  }, [items, selectedIndex, windowSize]);
}

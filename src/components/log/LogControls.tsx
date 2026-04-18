import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { SortType, PeriodType } from "../../hooks/useLogView";
import { SelectionMenu, type MenuOption } from "../SelectionMenu";

interface LogControlsProps {
  isSorting: boolean;
  sortOptions: Array<MenuOption<SortType>>;
  sortIndex: number;
  sortType: SortType;
  isSelectingPeriod: boolean;
  periodOptions: Array<MenuOption<PeriodType>>;
  periodIndex: number;
  currentPeriod: PeriodType;
  isFiltering: boolean;
  filterQuery: string;
  onFilterChange: (val: string) => void;
  onFilterSubmit: () => void;
  filteredLogsCount: number;
  showControls: boolean;
}

export const LogControls: React.FC<LogControlsProps> = ({
  isSorting,
  sortOptions,
  sortIndex,
  sortType,
  isSelectingPeriod,
  periodOptions,
  periodIndex,
  currentPeriod,
  isFiltering,
  filterQuery,
  onFilterChange,
  onFilterSubmit,
  filteredLogsCount,
  showControls
}) => {
  if (!showControls) return null;

  return (
    <Box marginTop={1} flexDirection="column">
      {isSorting ? (
        <SelectionMenu
          title="Sort By"
          options={sortOptions}
          selectedIndex={sortIndex}
          currentValue={sortType}
          borderColor="cyan"
        />
      ) : isSelectingPeriod ? (
        <SelectionMenu
          title="Period"
          options={periodOptions}
          selectedIndex={periodIndex}
          currentValue={currentPeriod}
          borderColor="magenta"
        />
      ) : isFiltering ? (
        <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1} flexDirection="column">
          <Box>
            <Box backgroundColor="yellow" paddingX={1} marginRight={1}>
              <Text bold color="black"> FILTER </Text>
            </Box>
            <TextInput
              value={filterQuery}
              onChange={onFilterChange}
              onSubmit={onFilterSubmit}
              placeholder="Start typing to filter..."
            />
          </Box>
          <Box marginTop={1}>
            <Text color="yellow"> {filteredLogsCount} matches | </Text>
            <Text bold color="cyan">Enter</Text>
            <Text color="dim"> to keep | </Text>
            <Text bold color="cyan">Esc</Text>
            <Text color="dim"> to reset</Text>
          </Box>
        </Box>
      ) : (
        <Box>
          <Text color="dim">Keys: </Text>
          <Text bold color="white">↑/↓</Text><Text color="dim"> navigate | </Text>
          <Text bold color="white">o</Text><Text color="dim"> open | </Text>
          <Text bold color="white">s</Text><Text color="dim"> sort | </Text>
          <Text bold color="white">p</Text><Text color="dim"> switch period | </Text>
          <Text bold color="white">g</Text><Text color="dim"> generate | </Text>
          <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
          <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
          <Text bold color="white">q</Text><Text color="dim"> quit</Text>
        </Box>
      )}
    </Box>
  );
};

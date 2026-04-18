import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { type SortType } from "../../commands/LogView";

interface LogControlsProps {
  isSorting: boolean;
  sortOptions: Array<{ label: string; value: SortType }>;
  sortIndex: number;
  sortType: SortType;
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
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
          <Box backgroundColor="cyan" paddingX={1} marginRight={1} marginBottom={1} width={12}>
            <Text bold color="black"> SORT BY </Text>
          </Box>
          {sortOptions.map((opt, i) => (
            <Box key={opt.value}>
              <Text color={i === sortIndex ? "cyan" : "dim"}>
                {i === sortIndex ? "❯" : " "} {opt.label}
                {sortType === opt.value ? " (active)" : ""}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text bold color="cyan">Enter</Text>
            <Text color="dim"> to apply | </Text>
            <Text bold color="cyan">Esc</Text>
            <Text color="dim"> to close</Text>
          </Box>
        </Box>
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
          <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
          <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
          <Text bold color="white">q</Text><Text color="dim"> quit</Text>
        </Box>
      )}
    </Box>
  );
};

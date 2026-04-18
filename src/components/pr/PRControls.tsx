import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { type BitbucketPR } from "../../bitbucket";

interface PRControlsProps {
  isSorting: boolean;
  sortOptions: Array<{ label: string; value: string }>;
  sortIndex: number;
  sortBy: string;
  isFiltering: boolean;
  filterQuery: string;
  onFilterChange: (val: string) => void;
  onFilterSubmit: () => void;
  filteredPrsCount: number;
  activePR?: BitbucketPR;
}

export const PRControls: React.FC<PRControlsProps> = ({
  isSorting,
  sortOptions,
  sortIndex,
  sortBy,
  isFiltering,
  filterQuery,
  onFilterChange,
  onFilterSubmit,
  filteredPrsCount,
  activePR
}) => {
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
                {sortBy === opt.value ? " (active)" : ""}
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
              placeholder="Search title, branch, or ID..."
            />
          </Box>
          <Box marginTop={1}>
            <Text color="yellow"> {filteredPrsCount} matches | </Text>
            <Text bold color="cyan">Enter</Text>
            <Text color="dim"> to keep | </Text>
            <Text bold color="cyan">Esc</Text>
            <Text color="dim"> to reset</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box>
            <Text color="dim">Keys: </Text>
            <Text bold color="white">↑/↓</Text><Text color="dim"> navigate | </Text>
            <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
            <Text bold color="white">s</Text><Text color="dim"> sort | </Text>
            <Text bold color="white">o</Text><Text color="dim"> open | </Text>
            <Text bold color="white">c</Text><Text color="dim"> copy branch | </Text>
            <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
            <Text bold color="white">q</Text><Text color="dim"> quit</Text>
          </Box>
          {activePR && (
            <Box marginTop={1}>
              <Text color="dim">Selected: </Text>
              <Text color="yellow">#{activePR.id} - {activePR.title}</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

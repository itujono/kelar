import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTixContext } from "../../contexts/TixContext";
import { SelectionMenu } from "../SelectionMenu";

export function TixControls() {
  const {
    isSorting,
    sortOptions,
    sortIndex,
    sortType,
    isFiltering,
    filterQuery,
    setFilterQuery,
    setIsFiltering,
    sortedTickets
  } = useTixContext();

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
      ) : isFiltering ? (
        <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1} flexDirection="column">
          <Box>
            <Box backgroundColor="yellow" paddingX={1} marginRight={1}>
              <Text bold color="black"> FILTER </Text>
            </Box>
            <TextInput value={filterQuery} onChange={setFilterQuery} onSubmit={() => setIsFiltering(false)} />
          </Box>
          <Box marginTop={1}>
            <Text color="yellow"> {sortedTickets.length} matches | </Text>
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
          <Text bold color="white">l</Text><Text color="dim"> log | </Text>
          <Text bold color="white">m</Text><Text color="dim"> move | </Text>
          <Text bold color="white">e</Text><Text color="dim"> estimate | </Text>
          <Text bold color="white">v</Text><Text color="dim"> view | </Text>
          <Text bold color="white">c</Text><Text color="dim"> copy | </Text>
          <Text bold color="white">o</Text><Text color="dim"> open | </Text>
          <Text bold color="white">s</Text><Text color="dim"> sort | </Text>
          <Text bold color="white">p</Text><Text color="dim"> switch peer | </Text>
          <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
          <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
          <Text bold color="white">q</Text><Text color="dim"> quit</Text>
        </Box>
      )}
    </Box>
  );
}

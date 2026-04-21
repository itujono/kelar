import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { PRTable } from "../components/pr/PRTable";
import { PRDetailPane } from "../components/pr/PRDetailPane";
import { PRControls } from "../components/pr/PRControls";
import { isBitbucketConfigValid } from "../config";
import { usePRView, type PRSortType } from "../hooks/usePRView";

export { type PRSortType };

interface PRViewProps {
  showAll?: boolean;
  sortBy?: PRSortType;
}

export function PRView({ showAll = false, sortBy = "updated" as PRSortType }: PRViewProps) {
  const {
    setIsFiltering,
    handleFilterChange,
    isAllMode,
    ...data
  } = usePRView(showAll, sortBy);

  if (!isBitbucketConfigValid().valid) {
    const missing = isBitbucketConfigValid().missing;
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red" bold>Bitbucket configuration incomplete.</Text>
        <Text color="dim">Missing: {missing.join(", ")}</Text>
        <Box marginTop={1}>
          <Text>Use `kelar pr config set` to configure.</Text>
        </Box>
      </Box>
    );
  }

  if (data.isLoading) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text italic>Loading pull requests...</Text>
      </Box>
    );
  }

  if (data.isError) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error fetching PRs:</Text>
        <Text>{(data.error as Error).message}</Text>
      </Box>
    );
  }

  if (!data.prs || data.prs.length === 0) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="dim">No active pull requests found.</Text>
        <Box marginTop={1}>
          <Text color="dim">Press 'r' to refetch or 'q' to quit.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Bitbucket PR Observability {isAllMode ? "(ALL)" : "(MINE)"}</Text>
        <Text color="dim"> | sorted by: </Text>
        <Text color="yellow">{data.sortBy}</Text>
      </Box>
      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <PRTable
            prs={data.sortedPrs}
            selectedIndex={data.selectedIndex}
            showMeColumn={isAllMode}
            metrics={data.prMetrics}
          />
        </Box>
        {data.activePR && <PRDetailPane pr={data.activePR} />}
      </Box>
      {data.summary && (
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1} flexDirection="column">
          <Box>
            <Text bold>Summary: </Text>
            <Text color="yellow">{data.summary.authoredCount}</Text>
            <Text color="dim"> Authored | </Text>
            <Text color="cyan">{data.summary.reviewerCount}</Text>
            <Text color="dim"> Reviewing (</Text>
            <Text color="red" bold>{data.summary.pendingReviewCount}</Text>
            <Text color="dim"> pending) | </Text>
            <Text color="magenta" bold>{data.summary.nrCount}</Text>
            <Text color="dim"> NR Feedbacks</Text>
          </Box>
        </Box>
      )}
      <PRControls
        isSorting={data.isSorting}
        sortOptions={data.sortOptions}
        sortIndex={data.sortIndex}
        sortBy={data.sortBy}
        isFiltering={data.isFiltering}
        filterQuery={data.filterQuery}
        onFilterChange={handleFilterChange}
        onFilterSubmit={() => setIsFiltering(false)}
        filteredPrsCount={data.sortedPrs.length}
        activePR={data.activePR}
      />
    </Box>
  );
}
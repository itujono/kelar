import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import Spinner from "ink-spinner";
import { PRTable } from "../components/PRTable";
import { PRDetailPane } from "../components/PRDetailPane";
import { fetchPRs, queryClient } from "../bitbucket";
import { isBitbucketConfigValid } from "../config";

interface PRViewProps {
  showAll?: boolean;
}

const PRViewContent: React.FC<PRViewProps> = ({ showAll = false }) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  const { data: prs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["prs", showAll],
    queryFn: () => fetchPRs(showAll),
  });

  const filteredPrs = prs?.filter(pr => {
    if (!filterQuery) return true;
    const search = filterQuery.toLowerCase();
    return (
      pr.title.toLowerCase().includes(search) ||
      pr.source.branch.name.toLowerCase().includes(search) ||
      pr.id.toString().includes(search)
    );
  }) || [];

  const activePR = filteredPrs[selectedIndex];

  useInput((input, key) => {
    if (input === "/" && !isFiltering) {
      setIsFiltering(true);
      setFilterQuery("");
      setSelectedIndex(0);
      return;
    }

    if (key.escape) {
      setIsFiltering(false);
      setFilterQuery("");
      setSelectedIndex(0);
      return;
    }

    if (isFiltering) return; // Let TextInput handle it

    if (input === "q") {
      exit();
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filteredPrs.length - 1, prev + 1));
    }

    if (input === "r") {
      refetch();
    }

    if (input === "o" && activePR) {
      const url = activePR.links.html.href;
      // @ts-ignore - Bun global
      Bun.spawn(["open", url]);
    }

    if (input === "c" && activePR) {
      const branch = activePR.source.branch.name;
      // @ts-ignore - Bun global
      const proc = Bun.spawn(["pbcopy"], {
        stdin: Buffer.from(branch),
      });
    }
  });

  const handleFilterChange = (val: string) => {
    const sanitized = val.replace(/^\/+/, "");
    setFilterQuery(sanitized);
    setSelectedIndex(0);
  };


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

  if (isLoading) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text italic> Loading pull requests...</Text>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error fetching PRs:</Text>
        <Text>{(error as Error).message}</Text>
      </Box>
    );
  }

  if (!prs || prs.length === 0) {
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
        <Text bold color="cyan">Bitbucket PR Observability {showAll ? "(ALL)" : "(MINE)"}</Text>
      </Box>

      <Box flexDirection="row">
        <Box flexGrow={1} marginRight={2}>
          <PRTable prs={filteredPrs} selectedIndex={selectedIndex} />
        </Box>
        {activePR && <PRDetailPane pr={activePR} />}
      </Box>

      <Box marginTop={1} flexDirection="column">
        {isFiltering ? (
          <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1} flexDirection="column">
            <Box>
              <Box backgroundColor="yellow" paddingX={1} marginRight={1}>
                <Text bold color="black"> FILTER </Text>
              </Box>
              <TextInput
                value={filterQuery}
                onChange={handleFilterChange}
                onSubmit={() => setIsFiltering(false)}
                placeholder="Search title, branch, or ID..."
              />
            </Box>
            <Box marginTop={1}>
              <Text color="yellow"> {filteredPrs.length} matches | </Text>
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
    </Box>
  );
};


export const PRView: React.FC<PRViewProps> = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      <PRViewContent {...props} />
    </QueryClientProvider>
  );
};

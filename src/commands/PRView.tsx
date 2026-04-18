import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { QueryClientProvider, useQuery, useQueries } from "@tanstack/react-query";
import Spinner from "ink-spinner";
import { PRTable } from "../components/pr/PRTable";
import { PRDetailPane } from "../components/pr/PRDetailPane";
import { fetchPRs, fetchPRActivity, fetchPRComments, fetchMe, calculateVelocity, queryClient, type BitbucketUser } from "../bitbucket";
import { isBitbucketConfigValid, getBitbucketConfig } from "../config";

interface PRViewProps {
  showAll?: boolean;
}

type PRSortType = "newest" | "oldest" | "longest" | "shortest";

const PRViewContent: React.FC<PRViewProps> = ({ showAll = false }) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [sortBy, setSortBy] = useState<PRSortType>("newest");
  const [isSorting, setIsSorting] = useState(false);
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions: { label: string; value: PRSortType }[] = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Longest Lead Time", value: "longest" },
    { label: "Shortest Pickup Latency", value: "shortest" },
  ];

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

  // Parallel activity fetching for velocity-based sorting
  useQueries({
    queries: filteredPrs.map(pr => ({
      queryKey: ["pr", pr.id, "activity"],
      queryFn: () => fetchPRActivity(pr.id),
      enabled: sortBy === "shortest" || isSorting, // Prefetch when in sort mode
      staleTime: 1000 * 60 * 10,
    }))
  });

  const commentsQueries = useQueries({
    queries: filteredPrs.map(pr => ({
      queryKey: ["pr", pr.id, "comments"],
      queryFn: () => fetchPRComments(pr.id),
      staleTime: 1000 * 60 * 5,
    }))
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 1000 * 60 * 60, // Cache for an hour
  });

  const prMetrics = Object.fromEntries(
    commentsQueries
      .map((query, index): [number, { fb: number; nr: number | null }] | null => {
        const pr = filteredPrs[index];
        if (!pr) return null;

        const comments = query.data;
        if (!comments) return [pr.id, { fb: 0, nr: null }];

        const myAccountId = me?.account_id?.toLowerCase();
        const myNickname = me?.nickname?.toLowerCase();

        const isMe = (u: BitbucketUser) => {
          if (myAccountId && u.account_id?.toLowerCase() === myAccountId) return true;
          if (myNickname && u.nickname?.toLowerCase() === myNickname) return true;

          // Fallback logic
          const config = getBitbucketConfig();
          const myUsername = config.BITBUCKET_USERNAME?.toLowerCase().trim();
          const myHandle = myUsername?.includes("@") ? myUsername.split("@")[0] : myUsername;
          const nick = u.nickname?.toLowerCase().trim();
          const display = u.display_name?.toLowerCase().trim();
          const account = u.account_id?.toLowerCase().trim();

          return (
            nick === myUsername ||
            nick === myHandle ||
            display === myUsername ||
            display === myHandle ||
            (myUsername && display?.includes(myUsername)) ||
            (myHandle && display?.includes(myHandle)) ||
            account === myUsername ||
            account === myHandle
          );
        };

        // Feedbacks: Comments NOT by me
        const peerComments = comments.filter(c => !isMe(c.user));

        // Not Replied: Peer comments that are unresolved AND have no reply from me
        const nrCount = peerComments.filter(peerComment => {
          if (peerComment.is_resolved) return false;

          // Check if I have replied to this specific comment
          const hasMyReply = comments.some(c => {
            return isMe(c.user) && c.parent?.id === peerComment.id;
          });

          // Also check if any child of this comment is by me? 
          // (Bitbucket threading can be multiple levels but standard is parent/child)
          return !hasMyReply;
        }).length;

        return [pr.id, { fb: peerComments.length, nr: nrCount }];
      })
      .filter((entry): entry is [number, { fb: number; nr: number | null }] => entry !== null)
  ) as Record<number, { fb: number; nr: number | null }>;

  const sortedPrs = [...filteredPrs].sort((a, b) => {
    const timeA = new Date(a.created_on).getTime();
    const timeB = new Date(b.created_on).getTime();

    if (sortBy === "newest") return timeB - timeA;
    if (sortBy === "oldest" || sortBy === "longest") return timeA - timeB;

    if (sortBy === "shortest") {
      const actA = queryClient.getQueryData(["pr", a.id, "activity"]) as any[];
      const actB = queryClient.getQueryData(["pr", b.id, "activity"]) as any[];
      const velA = actA ? calculateVelocity(a, actA).pickupLatency : Infinity;
      const velB = actB ? calculateVelocity(b, actB).pickupLatency : Infinity;
      return (velA ?? Infinity) - (velB ?? Infinity);
    }

    return 0;
  });

  const activePR = sortedPrs[selectedIndex];

  useInput((input, key) => {
    if (isSorting) {
      if (key.upArrow) {
        setSortIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setSortIndex(prev => Math.min(sortOptions.length - 1, prev + 1));
        return;
      }
      if (key.return) {
        const option = sortOptions[sortIndex];
        if (option) {
          setSortBy(option.value);
        }
        setIsSorting(false);
        setSelectedIndex(0);
        return;
      }

      if (key.escape) {
        setIsSorting(false);
        return;
      }
      return;
    }

    if (input === "/" && !isFiltering) {
      setIsFiltering(true);
      setFilterQuery("");
      setSelectedIndex(0);
      return;
    }

    if (input === "s" && !isFiltering) {
      setIsSorting(true);
      return;
    }

    if (key.escape) {
      if (isFiltering) {
        setIsFiltering(false);
        setFilterQuery("");
        setSelectedIndex(0);
      }
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
      setSelectedIndex((prev) => Math.min(sortedPrs.length - 1, prev + 1));
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
        <Text color="dim"> | sorted by: </Text>
        <Text color="yellow">{sortBy}</Text>
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <PRTable
            prs={sortedPrs}
            selectedIndex={selectedIndex}
            showMeColumn={showAll}
            metrics={prMetrics}
          />
        </Box>

        {activePR && <PRDetailPane pr={activePR} />}
      </Box>


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
                onChange={handleFilterChange}
                onSubmit={() => setIsFiltering(false)}
                placeholder="Search title, branch, or ID..."
              />
            </Box>
            <Box marginTop={1}>
              <Text color="yellow"> {sortedPrs.length} matches | </Text>
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

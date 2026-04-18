import { useState, useMemo, useCallback } from "react";
import { useInput, useApp } from "ink";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchPRs, fetchPRActivity, fetchPRComments, fetchMe, calculateVelocity, type BitbucketUser } from "../bitbucket";
import { queryClient } from "../queryClient";
import { getBitbucketConfig } from "../config";

export type PRSortType = "newest" | "oldest" | "longest" | "shortest";

export function usePRView(initialShowAll: boolean, initialSortBy: PRSortType = "newest") {
  const { exit } = useApp();
  const [isAllMode, setIsAllMode] = useState(initialShowAll);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [sortBy, setSortBy] = useState<PRSortType>(initialSortBy);
  const [isSorting, setIsSorting] = useState(false);
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions: { label: string; value: PRSortType }[] = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Longest Lead Time", value: "longest" },
    { label: "Shortest Pickup Latency", value: "shortest" },
  ];

  const { data: prs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["prs", isAllMode],
    queryFn: () => fetchPRs(isAllMode),
  });

  const filteredPrs = useMemo(() => {
    return prs?.filter(pr => {
      if (!filterQuery) return true;
      const search = filterQuery.toLowerCase();
      return (
        pr.title.toLowerCase().includes(search) ||
        pr.source.branch.name.toLowerCase().includes(search) ||
        pr.id.toString().includes(search)
      );
    }) || [];
  }, [prs, filterQuery]);

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

  const prMetrics = useMemo(() => {
    return Object.fromEntries(
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

            return !hasMyReply;
          }).length;

          return [pr.id, { fb: peerComments.length, nr: nrCount }];
        })
        .filter((entry): entry is [number, { fb: number; nr: number | null }] => entry !== null)
    ) as Record<number, { fb: number; nr: number | null }>;
  }, [commentsQueries, filteredPrs, me]);

  const sortedPrs = useMemo(() => {
    return [...filteredPrs].sort((a, b) => {
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
  }, [filteredPrs, sortBy]);

  const activePR = sortedPrs[selectedIndex];

  const handleFilterChange = useCallback((val: string) => {
    const sanitized = val.replace(/^\/+/, "");
    setFilterQuery(sanitized);
    setSelectedIndex(0);
  }, []);

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
      Bun.spawn(["open", url]);
    }

    if (input === "c" && activePR) {
      const branch = activePR.source.branch.name;
      Bun.spawn(["pbcopy"], {
        stdin: Buffer.from(branch),
      });
    }

    if (input === "m" && !isFiltering) {
      setIsAllMode(prev => !prev);
      setSelectedIndex(0);
    }
  });

  return {
    selectedIndex,
    setSelectedIndex,
    isAllMode,
    setIsAllMode,
    filterQuery,
    isFiltering,
    setIsFiltering,
    sortBy,
    isSorting,
    sortIndex,
    sortOptions,
    prs,
    isLoading,
    isError,
    error,
    sortedPrs,
    prMetrics,
    activePR,
    handleFilterChange,
    refetch,
  };
}

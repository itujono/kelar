import { useState, useMemo, useCallback } from "react";
import { useInput, useApp } from "ink";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchPRs, fetchPRActivity, fetchPRComments, calculateVelocity, type BitbucketUser, type BitbucketActivity } from "../bitbucket";
import { queryClient } from "../queryClient";

export type PRSortType = "newest" | "oldest" | "updated" | "oldest_updated";

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
    { label: "Newest Created", value: "newest" },
    { label: "Oldest Created", value: "oldest" },
    { label: "Newest Updated", value: "updated" },
    { label: "Oldest Updated", value: "oldest_updated" },
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


  const commentsQueries = useQueries({
    queries: filteredPrs.map(pr => ({
      queryKey: ["pr", pr.id, "comments"],
      queryFn: () => fetchPRComments(pr.id),
      staleTime: 1000 * 60 * 5,
    }))
  });


  const prMetrics = useMemo(() => {
    return Object.fromEntries(
      commentsQueries
        .map((query, index): [number, { fb: number; nr: number | null }] | null => {
          const pr = filteredPrs[index];
          if (!pr) return null;

          const comments = query.data;
          if (!comments) return [pr.id, { fb: 0, nr: null }];


          const isAuthor = (u: BitbucketUser) => {
            return u.account_id === pr.author.account_id || (!!u.uuid && u.uuid === pr.author.uuid);
          };

          // Feedbacks: Comments NOT by the PR author
          const peerComments = comments.filter(c => !isAuthor(c.user));

          // Not Replied: Peer comments that are unresolved AND have no reply from the PR author
          const nrCount = peerComments.filter(peerComment => {
            if (peerComment.is_resolved) return false;

            const hasAuthorReply = comments.some(c => {
              return isAuthor(c.user) && c.parent?.id === peerComment.id;
            });

            return !hasAuthorReply;
          }).length;

          return [pr.id, { fb: peerComments.length, nr: nrCount }];
        })
        .filter((entry): entry is [number, { fb: number; nr: number | null }] => entry !== null)
    ) as Record<number, { fb: number; nr: number | null }>;
  }, [commentsQueries, filteredPrs]);

  const sortedPrs = useMemo(() => {
    return [...filteredPrs].sort((a, b) => {
      const timeA = new Date(a.created_on).getTime();
      const timeB = new Date(b.created_on).getTime();
      const updateA = new Date(a.updated_on).getTime();
      const updateB = new Date(b.updated_on).getTime();

      if (sortBy === "newest") return timeB - timeA;
      if (sortBy === "oldest") return timeA - timeB;
      if (sortBy === "updated") return updateB - updateA;
      if (sortBy === "oldest_updated") return updateA - updateB;

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
        if (filterQuery.length > 0) {
          setFilterQuery("");
        } else {
          setIsFiltering(false);
        }
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
      queryClient.invalidateQueries({ queryKey: ["prs"] });
      queryClient.invalidateQueries({ queryKey: ["pr"] });
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
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["prs"] });
      queryClient.invalidateQueries({ queryKey: ["pr"] });
    },
  };
}

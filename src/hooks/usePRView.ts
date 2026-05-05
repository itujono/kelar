import { useState, useMemo } from "react";
import { useInput, useApp } from "ink";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchPRs, fetchPRComments, fetchMe, type BitbucketUser, type BitbucketPR } from "../bitbucket";
import { queryClient } from "../queryClient";
import { useListState } from "./useListState";

export type PRSortType = "newest" | "oldest" | "updated" | "oldest_updated";

export function usePRView(initialShowAll: boolean, initialSortBy: PRSortType = "updated") {
  const { exit } = useApp();
  const [isAllMode, setIsAllMode] = useState(initialShowAll);
  const nav = useListState<PRSortType>(initialSortBy);

  const sortOptions: { label: string; value: PRSortType }[] = [
    { label: "Newest Updated", value: "updated" },
    { label: "Oldest Updated", value: "oldest_updated" },
    { label: "Newest Created", value: "newest" },
    { label: "Oldest Created", value: "oldest" },
  ];

  const { data: me } = useQuery({
    queryKey: ["bitbucket", "me"],
    queryFn: fetchMe,
    staleTime: Infinity,
  });

  const { data: prs, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["prs", isAllMode],
    queryFn: () => fetchPRs(isAllMode),
  });

  const filteredPrs = useMemo(() => {
    return prs?.filter(pr => {
      if (!nav.filterQuery) return true;
      const search = nav.filterQuery.toLowerCase();
      return (
        pr.title.toLowerCase().includes(search) ||
        pr.source.branch.name.toLowerCase().includes(search) ||
        pr.id.toString().includes(search)
      );
    }) || [];
  }, [prs, nav.filterQuery]);

  const sortedPrs = useMemo(() => {
    return [...filteredPrs].sort((a, b) => {
      const timeA = new Date(a.created_on).getTime();
      const timeB = new Date(b.created_on).getTime();
      const updateA = new Date(a.updated_on).getTime();
      const updateB = new Date(b.updated_on).getTime();

      if (nav.sortType === "newest") return timeB - timeA;
      if (nav.sortType === "oldest") return timeA - timeB;
      if (nav.sortType === "updated") return updateB - updateA;
      if (nav.sortType === "oldest_updated") return updateA - updateB;

      return 0;
    });
  }, [filteredPrs, nav.sortType]);

  const WINDOW_SIZE = 18;
  const startIndex = Math.max(0, Math.min(nav.selectedIndex - Math.floor(WINDOW_SIZE / 2), Math.max(0, sortedPrs.length - WINDOW_SIZE)));
  const visiblePrs = sortedPrs.slice(startIndex, startIndex + WINDOW_SIZE);

  const commentsQueries = useQueries({
    queries: visiblePrs.map(pr => ({
      queryKey: ["pr", pr.id, "comments"],
      queryFn: () => fetchPRComments(pr.id),
      staleTime: 1000 * 60 * 5,
    }))
  });

  const prMetrics = useMemo(() => {
    return Object.fromEntries(
      commentsQueries
        .map((query, index): [number, { fb: number; nr: number | null }] | null => {
          const pr = visiblePrs[index];
          if (!pr) return null;

          const comments = query.data;
          if (!comments) return [pr.id, { fb: 0, nr: null }];

          const isAuthor = (u: BitbucketUser) => {
            return u.account_id === pr.author.account_id || (!!u.uuid && u.uuid === pr.author.uuid);
          };

          const peerComments = comments.filter(c => !isAuthor(c.user));

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
  }, [commentsQueries, visiblePrs]);

  const summary = useMemo(() => {
    if (!prs || !me) return null;

    const authored = prs.filter(pr => pr.author.account_id === me.account_id || pr.author.uuid === me.uuid);

    const reviewerPrs = prs.filter(pr =>
      pr.participants?.some(p =>
        p.role === "REVIEWER" && (p.user.account_id === me.account_id || p.user.uuid === me.uuid)
      )
    );

    const pendingReview = reviewerPrs.filter(pr =>
      pr.participants?.some(p =>
        (p.user.account_id === me.account_id || p.user.uuid === me.uuid) &&
        p.role === "REVIEWER" &&
        !p.approved &&
        p.state !== "changes_requested"
      )
    );

    let totalNR = 0;
    authored.forEach(pr => {
      const metric = prMetrics[pr.id];
      if (metric && metric.nr) {
        totalNR += metric.nr;
      }
    });

    return {
      authoredCount: authored.length,
      reviewerCount: reviewerPrs.length,
      pendingReviewCount: pendingReview.length,
      nrCount: totalNR
    };
  }, [prs, me, prMetrics]);

  const activePR = sortedPrs[nav.selectedIndex];

  useInput((input, key) => {
    if (nav.isSorting) {
      if (key.escape) nav.exitSort();
      if (key.upArrow) nav.navigateUp(sortOptions.length);
      if (key.downArrow) nav.navigateDown(sortOptions.length);
      if (key.return) {
        const option = sortOptions[nav.sortIndex];
        if (option) nav.setSortType(option.value);
        nav.exitSort();
        nav.setSelectedIndex(0);
      }
      return;
    }

    if (input === "/" && !nav.isFiltering) {
      nav.activateFilter();
      nav.setSelectedIndex(0);
      return;
    }

    if (input === "s" && !nav.isFiltering) {
      nav.activateSort();
      return;
    }

    if (key.escape) {
      if (nav.isFiltering) {
        if (nav.filterQuery.length > 0) {
          nav.clearFilter();
        } else {
          nav.exitFilter();
        }
        nav.setSelectedIndex(0);
      }
      return;
    }

    if (nav.isFiltering) return;

    if (input === "q") exit();

    if (key.upArrow) nav.navigateUp(sortedPrs.length);
    if (key.downArrow) nav.navigateDown(sortedPrs.length);

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

    if (input === "m" && !nav.isFiltering) {
      setIsAllMode(prev => !prev);
      nav.setSelectedIndex(0);
    }
  });

  return {
    selectedIndex: nav.selectedIndex,
    setSelectedIndex: nav.setSelectedIndex,
    isAllMode,
    setIsAllMode,
    filterQuery: nav.filterQuery,
    isFiltering: nav.isFiltering,
    setIsFiltering: nav.setIsFiltering,
    sortBy: nav.sortType,
    isSorting: nav.isSorting,
    sortIndex: nav.sortIndex,
    sortOptions,
    prs,
    isLoading,
    isError,
    error,
    sortedPrs,
    prMetrics,
    summary,
    activePR,
    handleFilterChange: nav.handleFilterChange,
    startIndex,
    WINDOW_SIZE,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["prs"] });
      queryClient.invalidateQueries({ queryKey: ["pr"] });
    },
  };
}
import { useState, useMemo, useCallback } from "react";
import { useInput, useApp } from "ink";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, differenceInCalendarDays, setDate, addMonths } from "date-fns";
import {
  searchIssues,
  fetchUsers,
  fetchTransitions,
  transitionIssue,
  postWorklog,
  updateIssueEstimate,
  fetchActivityCountToday,
  fetchUserWorklogs,
  clearTixCache
} from "../jira";
import { getAppConfig, DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS } from "../config";
import { parseJiraTime, getNowWithOffset } from "../utils";

export function useTixView(isPeerMode: boolean) {
  const { exit } = useApp();
  const config = getAppConfig();
  const [accountId, setAccountId] = useState<string | null>(isPeerMode ? null : config.JIRA_ACCOUNT_ID);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(isPeerMode ? null : "Me");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserSelecting, setIsUserSelecting] = useState(isPeerMode && !accountId);

  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<"newest" | "oldest" | "priority" | "updated">("newest");
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions = [
    { label: "Newest Created", value: "newest" as const },
    { label: "Oldest Created", value: "oldest" as const },
    { label: "Newest Updated", value: "updated" as const },
    { label: "High Priority", value: "priority" as const },
  ];

  // Modals state
  const [activeModal, setActiveModal] = useState<"log" | "move" | "estimate" | "view" | null>(null);
  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [logFocus, setLogFocus] = useState<"time" | "comment">("time");
  const [estimateValue, setEstimateValue] = useState("");
  const [transitionIndex, setTransitionIndex] = useState(0);
  const [isConfirmingMove, setIsConfirmingMove] = useState(false);

  // Queries
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", userSearchQuery],
    queryFn: () => fetchUsers(userSearchQuery),
    enabled: isUserSelecting
  });

  const jqlDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const { data: tickets, isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", accountId],
    queryFn: () => searchIssues(`assignee = ${accountId} AND updated >= "${jqlDate}"`),
    enabled: !!accountId && !isUserSelecting
  });

  const { data: contextScore } = useQuery({
    queryKey: ["contextScore"],
    queryFn: () => fetchActivityCountToday(),
    enabled: !!accountId && !isUserSelecting
  });

  const targetHours = parseInt(config.MONTHLY_TARGET_HOURS, 10) || DEFAULT_MONTHLY_TARGET_HOURS;
  const calculationDay = parseInt(config.LAST_CALCULATION_DAY, 10) || DEFAULT_CALCULATION_DAY;

  const { data: monthlyLogs } = useQuery({
    queryKey: ["monthlyLogs", accountId],
    queryFn: () => fetchUserWorklogs(accountId!, startOfMonth(new Date()).toISOString()),
    enabled: !!accountId && !isUserSelecting
  });

  const totalMinutesAll = useMemo(() => 
    monthlyLogs?.reduce((sum, log) => sum + Math.round(log.timeSpentSeconds / 60), 0) || 0,
    [monthlyLogs]
  );

  const daysRemaining = useMemo(() => {
    const now = new Date();
    let targetDate = setDate(now, calculationDay);
    if (now.getDate() > calculationDay) {
      targetDate = addMonths(targetDate, 1);
    }
    return differenceInCalendarDays(targetDate, now);
  }, [calculationDay]);

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter(t => {
      if (!filterQuery) return true;
      const s = filterQuery.toLowerCase();
      return t.key.toLowerCase().includes(s) || t.fields.summary.toLowerCase().includes(s);
    });
  }, [tickets, filterQuery]);

  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      if (sortType === "newest") return new Date(b.fields.created).getTime() - new Date(a.fields.created).getTime();
      if (sortType === "oldest") return new Date(a.fields.created).getTime() - new Date(b.fields.created).getTime();
      if (sortType === "updated") return new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime();
      if (sortType === "priority") {
        const prioMap: Record<string, number> = { "Highest": 0, "High": 1, "Medium": 2, "Low": 3, "Lowest": 4 };
        const valA = prioMap[a.fields.priority?.name || "Medium"] ?? 2;
        const valB = prioMap[b.fields.priority?.name || "Medium"] ?? 2;
        return valA - valB;
      }
      return 0;
    });
  }, [filteredTickets, sortType]);

  const activeTicket = sortedTickets[selectedIndex];

  const { data: transitions, isLoading: isLoadingTransitions } = useQuery({
    queryKey: ["transitions", activeTicket?.key],
    queryFn: () => fetchTransitions(activeTicket!.key),
    enabled: activeModal === "move" && !!activeTicket
  });

  // Mutations
  const queryCache = useQueryClient();
  const logMutation = useMutation({
    mutationFn: (data: { key: string, minutes: number, comment: string }) =>
      postWorklog(data.key, data.minutes, data.comment, getNowWithOffset()),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
      setLogTime("");
      setLogComment("");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data: { key: string, id: string }) => transitionIssue(data.key, data.id),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
    }
  });

  const estimateMutation = useMutation({
    mutationFn: (data: { key: string, seconds: number }) => updateIssueEstimate(data.key, data.seconds),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
    }
  });

  const handleLogSubmit = useCallback(() => {
    if (!activeTicket || !logTime) return;
    const mins = parseJiraTime(logTime);
    if (mins > 0) {
      logMutation.mutate({ key: activeTicket.key, minutes: mins, comment: logComment || "" });
    }
  }, [activeTicket, logTime, logComment, logMutation]);

  const handleEstimateSubmit = useCallback(() => {
    if (!activeTicket || !estimateValue) return;
    const mins = parseJiraTime(estimateValue);
    if (mins > 0) {
      estimateMutation.mutate({ key: activeTicket.key, seconds: mins * 60 });
    }
  }, [activeTicket, estimateValue, estimateMutation]);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      if (!userSearchQuery) return true;
      const q = userSearchQuery.toLowerCase();
      return u.displayName.toLowerCase().includes(q) || (u.emailAddress?.toLowerCase().includes(q));
    });
  }, [users, userSearchQuery]);

  const handleUserSearchChange = useCallback((val: string) => {
    setUserSearchQuery(val);
    setSelectedIndex(0);
  }, []);

  useInput((input, key) => {
    if (activeModal) {
      if (key.escape) setActiveModal(null);

      if (activeModal === "log") {
        if (key.tab) {
          setLogFocus(f => f === "time" ? "comment" : "time");
          return;
        }
      }

      if (activeModal === "move" && transitions) {
        if (isConfirmingMove) {
          if (key.return) {
            const t = transitions[transitionIndex];
            if (t && activeTicket) {
              transitionMutation.mutate({ key: activeTicket.key, id: t.id });
            }
            setIsConfirmingMove(false);
          }
          if (key.escape || key.backspace) {
            setIsConfirmingMove(false);
          }
          return;
        }

        if (key.upArrow) setTransitionIndex(p => Math.max(0, p - 1));
        if (key.downArrow) setTransitionIndex(p => Math.min(transitions.length - 1, p + 1));
        if (key.return) {
          setIsConfirmingMove(true);
        }
      }
      return;
    }

    if (isSorting) {
      if (key.escape) setIsSorting(false);
      if (key.upArrow) setSortIndex(prev => Math.max(0, prev - 1));
      if (key.downArrow) setSortIndex(prev => Math.min(sortOptions.length - 1, prev + 1));
      if (key.return) {
        const option = sortOptions[sortIndex];
        if (option) {
          setSortType(option.value);
        }
        setIsSorting(false);
      }
      return;
    }

    if (isUserSelecting) {
      if (key.escape && !isPeerMode) setIsUserSelecting(false);
      if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
      if (key.downArrow) setSelectedIndex(p => Math.min(filteredUsers.length - 1, p + 1));
      if (key.return) {
        const user = filteredUsers[selectedIndex];
        if (user) {
          setAccountId(user.accountId);
          setSelectedUserName(user.displayName);
          setIsUserSelecting(false);
          setSelectedIndex(0);
        }
      }
      return;
    }

    if (isFiltering) {
      if (key.escape) {
        setIsFiltering(false);
        setFilterQuery("");
      }
      if (key.return) setIsFiltering(false);
      return;
    }

    if (input === "q") exit();
    if (input === "/") { setIsFiltering(true); setFilterQuery(""); }
    if (input === "s") { setIsSorting(true); setSortIndex(0); }
    if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
    if (key.downArrow) setSelectedIndex(p => Math.min(sortedTickets.length - 1, p + 1));

    if (activeTicket) {
      if (input === "l") setActiveModal("log");
      if (input === "m") { setActiveModal("move"); setTransitionIndex(0); }
      if (input === "e") setActiveModal("estimate");
      if (input === "v") setActiveModal("view");
      if (input === "c") {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeTicket.key}`;
        // @ts-ignore
        Bun.spawn(["pbcopy"], { stdin: Buffer.from(url) });
      }
      if (input === "o") {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeTicket.key}`;
        // @ts-ignore
        Bun.spawn(["open", url]);
      }
    }

    if (input === "r") {
      clearTixCache();
      refetchTickets();
    }
  });

  return {
    accountId,
    selectedUserName,
    selectedIndex,
    setSelectedIndex,
    filterQuery,
    setFilterQuery,
    isFiltering,
    setIsFiltering,
    userSearchQuery,
    handleUserSearchChange,
    isUserSelecting,
    setIsUserSelecting,
    isSorting,
    setIsSorting,
    sortType,
    sortIndex,
    sortOptions,
    activeModal,
    setActiveModal,
    logTime,
    setLogTime,
    logComment,
    setLogComment,
    logFocus,
    setLogFocus,
    estimateValue,
    setEstimateValue,
    transitionIndex,
    setTransitionIndex,
    isConfirmingMove,
    setIsConfirmingMove,
    isLoadingUsers,
    isLoadingTickets,
    users,
    tickets,
    sortedTickets,
    filteredUsers,
    contextScore,
    totalMinutesAll,
    daysRemaining,
    targetHours,
    monthlyLogs,
    activeTicket,
    transitions,
    isLoadingTransitions,
    handleLogSubmit,
    handleEstimateSubmit,
    logMutation,
    refetchTickets
  };
}

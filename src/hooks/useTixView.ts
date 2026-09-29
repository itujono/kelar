import { useState, useMemo, useCallback } from "react";
import { useTixShortcuts } from "./useTixShortcuts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchIssues,
  fetchUsers,
  fetchTransitions,
  transitionIssue,
  postWorklog,
  updateIssueEstimate,
  fetchActivityCountToday,
  fetchUserWorklogs,
  getCachedJiraTimeZone,
  refreshJiraTimeZone
} from "../jira";
import { getAppConfig, DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS } from "../config";
import { parseJiraTime, getNowWithOffset } from "../utils";
import { getPeriodRange, toJqlDate, getDaysUntilCalculationDay } from "../period";

export function useTixView(initialPeerMode: boolean) {
  // Config is read once on mount. Changes made while the TUI is running
  // require a restart to take effect. This is intentional — config is stable
  // for the lifetime of a CLI session.
  const config = useMemo(() => getAppConfig(), []);
  const [currentPeerMode, setCurrentPeerMode] = useState(initialPeerMode);
  const [accountId, setAccountId] = useState<string | null>(initialPeerMode ? null : config.JIRA_ACCOUNT_ID);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(initialPeerMode ? null : "Me");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserSelecting, setIsUserSelecting] = useState(initialPeerMode && !accountId);

  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<"newest" | "oldest" | "priority" | "updated">("updated");
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions = [
    { label: "Newest Created", value: "newest" as const },
    { label: "Oldest Created", value: "oldest" as const },
    { label: "Newest Updated", value: "updated" as const },
    { label: "High Priority", value: "priority" as const },
  ];

  const [activeModal, setActiveModal] = useState<"log" | "move" | "estimate" | "view" | null>(null);
  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [logFocus, setLogFocus] = useState<"time" | "comment">("time");
  const [estimateValue, setEstimateValue] = useState("");
  const [transitionIndex, setTransitionIndex] = useState(0);
  const [isConfirmingMove, setIsConfirmingMove] = useState(false);

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", userSearchQuery],
    queryFn: () => fetchUsers(userSearchQuery),
    enabled: isUserSelecting
  });

  // Start from the cached timezone so queries fire immediately; they re-run if the lookup changes it
  const { data: timeZone = getCachedJiraTimeZone() } = useQuery({
    queryKey: ["jiraTimeZone"],
    queryFn: refreshJiraTimeZone,
    staleTime: Infinity,
  });
  const monthStart = getPeriodRange("month", timeZone).since;
  const jqlDate = toJqlDate(monthStart, timeZone);

  const { data: tickets, isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", accountId, jqlDate],
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

  const { data: monthlyLogsResult } = useQuery({
    queryKey: ["monthlyLogs", accountId, jqlDate, timeZone],
    queryFn: () => fetchUserWorklogs(accountId!, monthStart, timeZone),
    enabled: !!accountId && !isUserSelecting
  });

  const monthlyLogs = monthlyLogsResult?.worklogs;
  const worklogWarnings = monthlyLogsResult?.warnings ?? [];

  const totalMinutesAll = useMemo(() =>
    monthlyLogs?.reduce((sum, log) => sum + Math.round(log.timeSpentSeconds / 60), 0) || 0,
    [monthlyLogs]
  );

  const daysRemaining = useMemo(
    () => getDaysUntilCalculationDay(calculationDay, timeZone),
    [calculationDay, timeZone]
  );

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter(t => {
      if (!filterQuery) return true;
      const s = filterQuery.toLowerCase();
      return (
        t.key.toLowerCase().includes(s) ||
        t.fields.summary.toLowerCase().includes(s) ||
        t.fields.status.name.toLowerCase().includes(s)
      );
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

  useTixShortcuts({
    activeModal,
    setActiveModal,
    setLogFocus,
    transitions,
    isConfirmingMove,
    setIsConfirmingMove,
    transitionIndex,
    setTransitionIndex,
    activeTicket,
    transitionMutation,
    isSorting,
    setIsSorting,
    sortIndex,
    setSortIndex,
    sortOptions,
    setSortType,
    isUserSelecting,
    setIsUserSelecting,
    isPeerMode: currentPeerMode,
    setCurrentPeerMode,
    filteredUsers,
    selectedIndex,
    setSelectedIndex,
    setAccountId,
    setSelectedUserName,
    setUserSearchQuery,
    isFiltering,
    setIsFiltering,
    setFilterQuery,
    filterQuery,
    refetchTickets,
    accountId,
    sortedTickets
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
    currentPeerMode,
    setCurrentPeerMode,
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
    monthlyLogs: monthlyLogsResult,
    worklogWarnings,
    activeTicket,
    transitions,
    isLoadingTransitions,
    handleLogSubmit,
    handleEstimateSubmit,
    logMutation,
    refetchTickets
  };
}

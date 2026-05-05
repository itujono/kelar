import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useInput, useApp } from "ink";
import { startOfDay, startOfWeek, startOfMonth, format, differenceInCalendarDays, addMonths, setDate } from "date-fns";
import { dbOps, type LogDbRow } from "../db";
import { searchIssues, fetchIssueWorklogs } from "../jira";
import { getAppConfig, isConfigValid, DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS } from "../config";
import { useListState } from "./useListState";

export type SortType = "longest" | "shortest" | "newest" | "oldest";
export type PeriodType = "day" | "week" | "month";
export type ViewStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";

const CACHE_THRESHOLD_MINUTES = 5;

export function useLogView(period: PeriodType, sortBy: SortType) {
  const { exit } = useApp();
  // Config is read once on mount. Changes made while the TUI is running
  // require a restart to take effect. This is intentional — config is stable
  // for the lifetime of a CLI session.
  const config = useMemo(() => getAppConfig(), []);
  const nav = useListState<SortType>(sortBy);

  const targetHours = parseInt(config.MONTHLY_TARGET_HOURS, 10) || DEFAULT_MONTHLY_TARGET_HOURS;
  const calculationDay = parseInt(config.LAST_CALCULATION_DAY, 10) || DEFAULT_CALCULATION_DAY;

  const [status, setStatus] = useState<ViewStatus>("IDLE");
  const [logs, setLogs] = useState<LogDbRow[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isSelectingPeriod, setIsSelectingPeriod] = useState(false);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodType>(period);
  const [isGenerating, setIsGenerating] = useState(false);

  const sortOptions = useMemo(() => [
    { label: "Newest", value: "newest" as const },
    { label: "Oldest", value: "oldest" as const },
    { label: "Longest", value: "longest" as const },
    { label: "Shortest", value: "shortest" as const },
  ], []);

  const periodOptions = useMemo(() => [
    { label: "Today", value: "day" as const },
    { label: "This Week", value: "week" as const },
    { label: "This Month", value: "month" as const },
  ], []);

  const getSinceDate = useCallback((p: PeriodType) => {
    const now = new Date();
    switch (p) {
      case "week": return startOfWeek(now, { weekStartsOn: 1 });
      case "month": return startOfMonth(now);
      default: return startOfDay(now);
    }
  }, []);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const sync = useCallback(async () => {
    if (statusRef.current === "SYNCING") return;

    const { valid, missing } = isConfigValid();
    if (!valid) {
      setError(new Error(`Configuration incomplete. Missing: ${missing.join(", ")}`));
      setStatus("ERROR");
      return;
    }

    const sinceDate = getSinceDate(currentPeriod);
    const lastSyncKey = `LAST_SYNC_${currentPeriod.toUpperCase()}`;

    try {
      const lastSyncStr = dbOps.getConfig(lastSyncKey);
      if (lastSyncStr) {
        const lastSync = new Date(lastSyncStr);
        const ageInMinutes = (new Date().getTime() - lastSync.getTime()) / (1000 * 60);

        if (ageInMinutes < CACHE_THRESHOLD_MINUTES) {
          const cachedLogs = dbOps.getLogs(sinceDate.toISOString());
          setLogs(cachedLogs);
          setStatus("SUCCESS");
          return;
        }
      }

      setStatus("SYNCING");
      const jqlDate = format(sinceDate, "yyyy-MM-dd");
      const jql = `worklogAuthor = currentUser() AND worklogDate >= "${jqlDate}"`;

      const issues = await searchIssues(jql, 500);

      const myAccountId = config.JIRA_ACCOUNT_ID;
      const remoteLogs = [];

      for (const issue of issues) {
        let worklogs = issue.fields.worklog?.worklogs || [];
        const totalWorklogs = issue.fields.worklog?.total || worklogs.length;
        const maxResultsWorklogs = issue.fields.worklog?.maxResults || 20;

        if (totalWorklogs > maxResultsWorklogs || worklogs.length === 0) {
          try {
            worklogs = await fetchIssueWorklogs(issue.key);
          } catch (e) {
            console.error(`Failed to fetch worklogs for ${issue.key}:`, e);
          }
        }

        for (const wl of worklogs) {
          const wlDate = new Date(wl.started);
          if (wl.author.accountId === myAccountId && wlDate >= sinceDate) {
            const isPersonal = issue.key === config.PERSONAL_TICKET_ID;
            let commentText = "";
            if (wl.comment?.content?.[0]?.content?.[0]?.text) {
              commentText = wl.comment.content[0].content[0].text;
            }

            remoteLogs.push({
              identifier: isPersonal ? (commentText || "Personal Log") : issue.key,
              label: isPersonal ? (commentText || "") : issue.fields.summary,
              minutes: Math.round(wl.timeSpentSeconds / 60),
              jira_worklog_id: wl.id,
              is_jira: !isPersonal,
              created_at: wl.started,
            });
          }
        }
      }

      dbOps.clearAllLogsInRange(sinceDate.toISOString());
      for (const rl of remoteLogs) {
        dbOps.addLog(rl);
      }
      dbOps.setConfig(lastSyncKey, new Date().toISOString());

      const updatedLogs = dbOps.getLogs(sinceDate.toISOString());
      setLogs(updatedLogs);
      setStatus("SUCCESS");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("ERROR");
    }
  }, [currentPeriod, config, getSinceDate]);

  useEffect(() => {
    sync();
  }, [currentPeriod, sync]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!nav.filterQuery) return true;
      const search = nav.filterQuery.toLowerCase();
      const logType = log.is_jira ? "jira" : "personal";
      return (
        log.identifier.toLowerCase().includes(search) ||
        (log.label || "").toLowerCase().includes(search) ||
        logType.includes(search)
      );
    });
  }, [logs, nav.filterQuery]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();

      switch (nav.sortType) {
        case "newest": return timeB - timeA;
        case "longest": return b.minutes - a.minutes;
        case "shortest": return a.minutes - b.minutes;
        case "oldest":
        default:
          return timeA - timeB;
      }
    });
  }, [filteredLogs, nav.sortType]);

  const totalMinutesAll = useMemo(() => {
    return filteredLogs.reduce((sum, log) => sum + log.minutes, 0);
  }, [filteredLogs]);

  const personalCount = useMemo(() => {
    return filteredLogs.filter(log => !log.is_jira).length;
  }, [filteredLogs]);

  const daysRemaining = useMemo(() => {
    const now = new Date();
    let targetDate = setDate(now, calculationDay);
    if (now.getDate() > calculationDay) {
      targetDate = addMonths(targetDate, 1);
    }
    return differenceInCalendarDays(targetDate, now);
  }, [calculationDay]);

  const activeLog = useMemo(() => sortedLogs[nav.selectedIndex], [sortedLogs, nav.selectedIndex]);

  useInput((input, key) => {
    if (nav.isSorting) {
      if (key.escape) nav.exitSort();
      if (key.upArrow) nav.navigateUp(sortOptions.length);
      if (key.downArrow) nav.navigateDown(sortOptions.length);
      if (key.return) {
        const option = sortOptions[nav.sortIndex];
        if (option) nav.setSortType(option.value);
        nav.exitSort();
      }
      return;
    }
    if (isSelectingPeriod) {
      if (key.escape) setIsSelectingPeriod(false);
      if (key.upArrow) setPeriodIndex(prev => Math.max(0, prev - 1));
      if (key.downArrow) setPeriodIndex(prev => Math.min(periodOptions.length - 1, prev + 1));
      if (key.return) {
        const option = periodOptions[periodIndex];
        if (option && option.value !== currentPeriod) {
          setCurrentPeriod(option.value);
        }
        setIsSelectingPeriod(false);
      }
      return;
    }

    if (nav.isFiltering) {
      if (key.return) nav.exitFilter();
      if (key.escape) {
        if (nav.filterQuery.length > 0) nav.clearFilter();
        else nav.exitFilter();
      }
      if (key.ctrl && input === "u") nav.clearFilter();
      return;
    }

    if (input === "q") exit();
    if (input === "/") { nav.activateFilter(); return; }
    if (input === "s") { nav.activateSort(); return; }
    if (input === "g") { setIsGenerating(true); return; }
    if (input === "p") {
      setIsSelectingPeriod(true);
      const currentIndex = periodOptions.findIndex(o => o.value === currentPeriod);
      setPeriodIndex(currentIndex !== -1 ? currentIndex : 0);
      return;
    }
    if (input === "r") { sync(); return; }

    if (key.upArrow) nav.navigateUp(sortedLogs.length);
    if (key.downArrow) nav.navigateDown(sortedLogs.length);

    if (input === "o") {
      if (activeLog) {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const ticketId = activeLog.is_jira ? activeLog.identifier : config.PERSONAL_TICKET_ID;
        if (ticketId) {
          const url = `https://${domain}/browse/${ticketId}`;
          Bun.spawn(["open", url]);
        }
      }
    }
  });

  return {
    status,
    logs,
    error,
    filterQuery: nav.filterQuery,
    isFiltering: nav.isFiltering,
    setIsFiltering: nav.setIsFiltering,
    selectedIndex: nav.selectedIndex,
    setSelectedIndex: nav.setSelectedIndex,
    isSorting: nav.isSorting,
    setIsSorting: nav.setIsSorting,
    sortType: nav.sortType,
    setSortType: nav.setSortType,
    sortIndex: nav.sortIndex,
    setSortIndex: nav.setSortIndex,
    sortOptions,
    periodOptions,
    currentPeriod,
    setCurrentPeriod,
    isSelectingPeriod,
    setIsSelectingPeriod,
    periodIndex,
    setPeriodIndex,
    isGenerating,
    setIsGenerating,
    sortedLogs,
    filteredLogs,
    totalMinutesAll,
    personalCount,
    daysRemaining,
    handleFilterChange: nav.handleFilterChange,
    sync,
    targetHours,
    calculationDay,
    activeLog
  };
}
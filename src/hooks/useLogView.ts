import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useInput, useApp } from "ink";
import { startOfDay, startOfWeek, startOfMonth, format, differenceInCalendarDays, addMonths, setDate } from "date-fns";
import { dbOps, type LogDbRow } from "../db";
import { searchIssues, fetchIssueWorklogs } from "../jira";
import { getAppConfig, isConfigValid, DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS } from "../config";

export type SortType = "longest" | "shortest" | "newest" | "oldest";
export type PeriodType = "day" | "week" | "month";
export type ViewStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";

const CACHE_THRESHOLD_MINUTES = 5;

export function useLogView(period: PeriodType, sortBy: SortType) {
  const { exit } = useApp();
  const config = useMemo(() => getAppConfig(), []);

  const targetHours = parseInt(config.MONTHLY_TARGET_HOURS, 10) || DEFAULT_MONTHLY_TARGET_HOURS;
  const calculationDay = parseInt(config.LAST_CALCULATION_DAY, 10) || DEFAULT_CALCULATION_DAY;

  const [status, setStatus] = useState<ViewStatus>("IDLE");
  const [logs, setLogs] = useState<LogDbRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<SortType>(sortBy);
  const [sortIndex, setSortIndex] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodType>(period);
  const [isSelectingPeriod, setIsSelectingPeriod] = useState(false);
  const [periodIndex, setPeriodIndex] = useState(0);

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
      setError(`Configuration incomplete. Missing: ${missing.join(", ")}`);
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
      const issues = await searchIssues(jql);

      const myAccountId = config.JIRA_ACCOUNT_ID;
      const remoteLogs = [];

      for (const issue of issues) {
        const worklogs = await fetchIssueWorklogs(issue.key);
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
    } catch (err: any) {
      setError(err.message);
      setStatus("ERROR");
    }
  }, [currentPeriod, config, getSinceDate]);

  useEffect(() => {
    sync();
  }, [currentPeriod, sync]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!filterQuery) return true;
      const search = filterQuery.toLowerCase();
      const logType = log.is_jira ? "jira" : "personal";
      return (
        log.identifier.toLowerCase().includes(search) ||
        (log.label || "").toLowerCase().includes(search) ||
        logType.includes(search)
      );
    });
  }, [logs, filterQuery]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();

      switch (sortType) {
        case "newest": return timeB - timeA;
        case "longest": return b.minutes - a.minutes;
        case "shortest": return a.minutes - b.minutes;
        case "oldest":
        default:
          return timeA - timeB;
      }
    });
  }, [filteredLogs, sortType]);

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

  const handleFilterChange = useCallback((val: string) => {
    const sanitized = val.replace(/^\/+/, "");
    setFilterQuery(sanitized);
  }, []);

  useInput((input, key) => {
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

    if (isFiltering) {
      if (key.escape) {
        setIsFiltering(false);
        setFilterQuery("");
      }
      if (key.return) setIsFiltering(false);
      return;
    }

    if (input === "q") exit();
    if (input === "/") {
      setIsFiltering(true);
      setFilterQuery("");
      setSelectedIndex(0);
      return;
    }
    if (input === "s") {
      setIsSorting(true);
      setSortIndex(0);
      return;
    }
    if (input === "p") {
      setIsSelectingPeriod(true);
      const currentIndex = periodOptions.findIndex(o => o.value === currentPeriod);
      setPeriodIndex(currentIndex !== -1 ? currentIndex : 0);
      return;
    }
    if (input === "r") {
      sync();
      return;
    }

    if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
    if (key.downArrow) setSelectedIndex(p => Math.min(sortedLogs.length - 1, p + 1));

    if (input === "o") {
      const activeLog = sortedLogs[selectedIndex];
      if (activeLog && activeLog.is_jira) {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeLog.identifier}`;
        Bun.spawn(["open", url]);
      }
    }

    if (key.ctrl && (input === "u" || input === "\u0015")) {
      setFilterQuery("");
    }
  });

  return {
    status,
    logs,
    error,
    filterQuery,
    isFiltering,
    setIsFiltering,
    selectedIndex,
    setSelectedIndex,
    isSorting,
    setIsSorting,
    sortType,
    setSortType,
    sortIndex,
    setSortIndex,
    sortOptions,
    periodOptions,
    currentPeriod,
    setCurrentPeriod,
    isSelectingPeriod,
    setIsSelectingPeriod,
    periodIndex,
    setPeriodIndex,
    sortedLogs,
    filteredLogs,
    totalMinutesAll,
    personalCount,
    daysRemaining,
    handleFilterChange,
    sync,
    targetHours,
    calculationDay
  };
}

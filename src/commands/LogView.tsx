import React, { useState, useEffect } from "react";
import { Text, Box, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { startOfDay, startOfWeek, startOfMonth, format, differenceInCalendarDays, addMonths, setDate } from "date-fns";
import { Table } from "../components/Table";
import { dbOps } from "../db";
import { formatMinutes } from "../utils";
import { searchIssues, fetchIssueWorklogs } from "../jira";
import { DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS, getAppConfig, isConfigValid } from "../config";
import { generateHtmlReport } from "../report";

export type SortType = "longest" | "shortest" | "newest" | "oldest";
export type PeriodType = "day" | "week" | "month";

interface LogViewProps {
  period?: PeriodType;
  sortBy?: SortType;
  isCaptureMode?: boolean;
}


type ViewStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";
const CACHE_THRESHOLD_MINUTES = 5;

export const LogView: React.FC<LogViewProps> = ({ period = "day", sortBy = "newest", isCaptureMode = false }) => {
  const { exit } = useApp();
  const config = getAppConfig();
  const targetHours = parseInt(config.MONTHLY_TARGET_HOURS, 10) || DEFAULT_MONTHLY_TARGET_HOURS;
  const calculationDay = parseInt(config.LAST_CALCULATION_DAY, 10) || DEFAULT_CALCULATION_DAY;

  const [status, setStatus] = useState<ViewStatus>("IDLE");
  const [logs, setLogs] = useState<import("../db").LogDbRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [capturedFile, setCapturedFile] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<SortType>(sortBy);
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions = [
    { label: "Newest", value: "newest" as const },
    { label: "Oldest", value: "oldest" as const },
    { label: "Longest", value: "longest" as const },
    { label: "Shortest", value: "shortest" as const },
  ];

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
        // @ts-ignore
        Bun.spawn(["open", url]);
      }
    }

    if (key.ctrl && (input === "u" || input === "\u0015")) {
      setFilterQuery("");
    }
  });

  const handleFilterChange = (val: string) => {
    // Sanitize: strip any leading slashes that leaked from the toggle key
    const sanitized = val.replace(/^\/+/, "");
    setFilterQuery(sanitized);
  };

  useEffect(() => {
    sync();
  }, [period]);

  const getSinceDate = (p: PeriodType) => {
    const now = new Date();
    switch (p) {
      case "week": return startOfWeek(now, { weekStartsOn: 1 });
      case "month": return startOfMonth(now);
      default: return startOfDay(now);
    }
  };

  async function sync() {
    const { valid, missing } = isConfigValid();
    if (!valid) {
      setError(`Configuration incomplete. Missing: ${missing.join(", ")}`);
      setStatus("ERROR");
      return;
    }

    const sinceDate = getSinceDate(period);
    const lastSyncKey = `LAST_SYNC_${period.toUpperCase()}`;

    try {
      // Check persistent cache (5 minute threshold)
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
  }

  const filteredLogs = logs.filter(log => {
    if (!filterQuery) return true;
    const search = filterQuery.toLowerCase();
    const logType = log.is_jira ? "jira" : "personal";
    return (
      log.identifier.toLowerCase().includes(search) ||
      (log.label || "").toLowerCase().includes(search) ||
      logType.includes(search)
    );
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
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

  const WINDOW_SIZE = 18;
  let startIndex = 0;
  if (sortedLogs.length > WINDOW_SIZE) {
    startIndex = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
    if (startIndex + WINDOW_SIZE > sortedLogs.length) {
      startIndex = sortedLogs.length - WINDOW_SIZE;
    }
  }
  const visibleLogs = sortedLogs.slice(startIndex, startIndex + WINDOW_SIZE);

  const data = visibleLogs.map(log => ({
    Date: format(new Date(log.created_at), "dd MMM"),
    Identifier: log.identifier,
    Label: log.label || "",
    Type: log.is_jira ? "Jira" : "Personal",
    Time: formatMinutes(log.minutes)
  }));

  const totalMinutesAll = filteredLogs.reduce((sum, log) => sum + log.minutes, 0);
  const personalCount = filteredLogs.filter(log => !log.is_jira).length;

  const getDaysRemaining = () => {
    const now = new Date();
    let targetDate = setDate(now, calculationDay);
    if (now.getDate() > calculationDay) {
      targetDate = addMonths(targetDate, 1);
    }
    return differenceInCalendarDays(targetDate, now);
  };

  const daysRemaining = getDaysRemaining();

  const getEmptyMessage = () => {
    const now = new Date();
    if (period === "day") return "No logs yet today. Ready to crush some tasks?";
    if (period === "week" && now.getDay() === 1) return "The week has just started! Time to build some momentum.";
    if (period === "month" && now.getDate() <= 3) return "Fresh month alert! Let's get a head start on that goal.";
    return `No logs found for this ${period} in Jira.`;
  };

  useEffect(() => {
    if (isCaptureMode && status === "SUCCESS") {
      const html = generateHtmlReport(
        sortedLogs,
        period,
        targetHours,
        calculationDay,
        daysRemaining,
        totalMinutesAll,
        personalCount
      );

      const filename = `kelar-report-${period}-${format(new Date(), "yyyy-MM-dd")}.html`;
      // @ts-ignore - Bun global
      Bun.write(filename, html).then(() => {
        setCapturedFile(filename);
        // Wait a bit before exiting so user can read the success message
        setTimeout(() => exit(), 1500);
      });
    } else if (isCaptureMode && status === "ERROR") {
      exit();
    }
  }, [status, isCaptureMode, exit, sortedLogs, period, targetHours, calculationDay, daysRemaining, totalMinutesAll, personalCount]);

  if (status === "ERROR") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error syncing logs:</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (isCaptureMode) {
    return (
      <Box padding={1} flexDirection="column">
        {status === "SYNCING" ? (
          <Box>
            <Spinner type="dots" />
            <Text italic> Generating work log snapshot...</Text>
          </Box>
        ) : capturedFile ? (
          <Box flexDirection="column">
            <Text color="green" bold>✅ Snapshot generated successfully!</Text>
            <Text color="dim">Saved to: <Text color="cyan">{capturedFile}</Text></Text>
          </Box>
        ) : (
          <Text italic color="dim">Preparing report data...</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="row">
        <Text bold color="cyan">Work Log Summary ({period.toUpperCase()})</Text>
        <Text color="dim"> | Sort: </Text>
        <Text color="yellow">{sortOptions.find(o => o.value === sortType)?.label || sortType}</Text>
        <Text color="dim"> | User: </Text>
        <Text color="magenta" bold>Me</Text>
        {status === "SYNCING" && (
          <Box marginLeft={2}>
            <Spinner type="dots" />
            <Text italic> Syncing with Jira...</Text>
          </Box>
        )}
      </Box>

      {logs.length > 0 ? (
        <>
          <Table
            data={data}
            columns={["Date", "Identifier", "Label", "Type", "Time"]}
            columnWidths={{
              Date: 10,
              Identifier: 40,
              Label: 100,
              Type: 12,
              Time: 10
            }}
            compact
            selectedIndex={selectedIndex - startIndex}
            header={startIndex > 0 ? (
              <Text color="dim">  ↑ {startIndex} more logs...</Text>
            ) : undefined}
            footer={startIndex + WINDOW_SIZE < sortedLogs.length ? (
              <Box paddingX={1}>
                <Text color="dim">  ↓ {sortedLogs.length - (startIndex + WINDOW_SIZE)} more logs...</Text>
              </Box>
            ) : undefined}
            renderCell={(col, val, row) => {
              const isPersonal = row.Type === "Personal";
              const isSelected = data.indexOf(row) === (selectedIndex - startIndex);

              if (isPersonal && (col === "Identifier" || col === "Type")) {
                return (
                  <Text color={isSelected ? "black" : "green"}>
                    {val}
                  </Text>
                );
              }
              if (isSelected) return val;
              if (col === "Date" || col === "Identifier") {
                return <Text color="dim">{val}</Text>;
              }
              if (col === "Time") {
                return <Text color="yellow">{val}</Text>;
              }
              return val;
            }}
          />
          <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1} flexDirection="column">
            <Box>
              <Text bold>Grand Total: </Text>
              <Text color="yellow">{formatMinutes(totalMinutesAll)}</Text>
              <Text color="dim"> ({totalMinutesAll}m) | </Text>
              {period === "month" && (
                <Text>
                  <Text color="magenta" bold>{((totalMinutesAll / (targetHours * 60)) * 100).toFixed(1)}%</Text>
                  <Text color="dim"> of {targetHours}h goal | </Text>
                  <Text color="yellow" bold>{daysRemaining}</Text>
                  <Text color="dim"> days left</Text>
                </Text>
              )}
              <Text color="dim"> | </Text>
              <Text color="cyan">{filteredLogs.length} entries ({personalCount} personal items)</Text>
            </Box>
            {period === "month" && (
              <Box marginTop={1}>
                <Text color="magenta">
                  {"█".repeat(Math.min(30, Math.floor((totalMinutesAll / (targetHours * 60)) * 30)))}
                  <Text color="dim">
                    {"░".repeat(Math.max(0, 30 - Math.floor((totalMinutesAll / (targetHours * 60)) * 30)))}
                  </Text>
                </Text>
              </Box>
            )}
          </Box>
        </>
      ) : (
        status !== "SYNCING" && <Text color="dim">{getEmptyMessage()}</Text>
      )}

      <Box marginTop={1} flexDirection="column">
        {status !== "SYNCING" && (
          isSorting ? (
            <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
              <Box backgroundColor="cyan" paddingX={1} marginRight={1} marginBottom={1} width={12}>
                <Text bold color="black"> SORT BY </Text>
              </Box>
              {sortOptions.map((opt, i) => (
                <Box key={opt.value}>
                  <Text color={i === sortIndex ? "cyan" : "dim"}>
                    {i === sortIndex ? "❯" : " "} {opt.label}
                    {sortType === opt.value ? " (active)" : ""}
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
                  placeholder="Start typing to filter..."
                />
              </Box>
              <Box marginTop={1}>
                <Text color="yellow"> {filteredLogs.length} matches | </Text>
                <Text bold color="cyan">Enter</Text>
                <Text color="dim"> to keep | </Text>
                <Text bold color="cyan">Esc</Text>
                <Text color="dim"> to reset</Text>
              </Box>
            </Box>
          ) : (
            <Box>
              <Text color="dim">Keys: </Text>
              <Text bold color="white">↑/↓</Text><Text color="dim"> navigate | </Text>
              <Text bold color="white">o</Text><Text color="dim"> open | </Text>
              <Text bold color="white">s</Text><Text color="dim"> sort | </Text>
              <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
              <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
              <Text bold color="white">q</Text><Text color="dim"> quit</Text>
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

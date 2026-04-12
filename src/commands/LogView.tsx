import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { startOfDay, startOfWeek, startOfMonth, format } from "date-fns";
import { Table } from "../components/Table";
import { dbOps } from "../db";
import { formatMinutes } from "../utils";
import { searchIssues, fetchIssueWorklogs } from "../jira";
import { getAppConfig, isConfigValid } from "../config";

export type SortType = "longest" | "shortest" | "newest" | "oldest";

interface Props {
  period?: string; // "day", "week", "month"
  sortBy?: SortType;
}


type ViewStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";

export const LogView: React.FC<Props> = ({ period = "day", sortBy = "oldest" }) => {
  const [status, setStatus] = useState<ViewStatus>("IDLE");
  const [logs, setLogs] = useState<import("../db").LogDbRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  useInput((input, key) => {
    if (input === "/" && !isFiltering) {
      setIsFiltering(true);
      setFilterQuery("");
      return;
    }

    if (key.escape) {
      setIsFiltering(false);
      setFilterQuery("");
    }

    // 3. Clear line on Ctrl+U (\u0015 is the raw code for Ctrl+U)
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

  const getSinceDate = (p: string) => {
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
      // 1. Check persistent cache (5 minute threshold)
      const lastSyncStr = dbOps.getConfig(lastSyncKey);
      if (lastSyncStr) {
        const lastSync = new Date(lastSyncStr);
        const ageInMinutes = (new Date().getTime() - lastSync.getTime()) / (1000 * 60);

        if (ageInMinutes < 5) {
          const cachedLogs = dbOps.getLogs(sinceDate.toISOString());
          setLogs(cachedLogs);
          setStatus("SUCCESS");
          return;
        }
      }

      setStatus("SYNCING");
      const config = getAppConfig();
      const jqlDate = format(sinceDate, "yyyy-MM-dd");

      // 1. Fetch matching issues from Jira
      const jql = `worklogAuthor = currentUser() AND worklogDate >= "${jqlDate}"`;
      const issues = await searchIssues(jql);

      // 2. Fetch worklogs for each issue and filter
      const myAccountId = config.JIRA_ACCOUNT_ID;
      const remoteLogs = [];

      for (const issue of issues) {
        const worklogs = await fetchIssueWorklogs(issue.key);
        for (const wl of worklogs) {
          const wlDate = new Date(wl.started);
          if (wl.author.accountId === myAccountId && wlDate >= sinceDate) {
            const isPersonal = issue.key === config.PERSONAL_TICKET_ID;

            // Extract comment text from ADF if it exists
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

      // 3. Update local DB (Mirror Jira)
      dbOps.clearAllLogsInRange(sinceDate.toISOString());
      for (const rl of remoteLogs) {
        dbOps.addLog(rl);
      }

      // 4. Update Sync Timestamp
      dbOps.setConfig(lastSyncKey, new Date().toISOString());

      // 5. Load from DB
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

    switch (sortBy) {
      case "newest": return timeB - timeA;
      case "longest": return b.minutes - a.minutes;
      case "shortest": return a.minutes - b.minutes;
      case "oldest":
      default:
        return timeA - timeB;
    }
  });

  const data = sortedLogs.map(log => ({
    Date: format(new Date(log.created_at), "dd MMM"),
    Identifier: log.identifier,
    Label: log.label || "",
    Type: log.is_jira ? "Jira" : "Personal",
    Time: formatMinutes(log.minutes)
  }));

  const totalMinutesAll = filteredLogs.reduce((sum, log) => sum + log.minutes, 0);

  if (status === "ERROR") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error syncing logs:</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">Work Log Summary ({period.toUpperCase()})</Text>
        {status === "SYNCING" && (
          <Box>
            <Spinner type="dots" />
            <Text italic> Syncing with Jira...</Text>
          </Box>
        )}
      </Box>

      {logs.length > 0 ? (
        <>
          <Table
            data={data}
            compact
            renderCell={(col, val, row) => {
              const isPersonal = row.Type === "Personal";
              if (isPersonal && (col === "Identifier" || col === "Type")) {
                return <Text color="green">{val}</Text>;
              }
              return val;
            }}
          />
          <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
            <Text bold>Grand Total: </Text>
            <Text color="yellow">{formatMinutes(totalMinutesAll)}</Text>
            <Text color="dim"> ({totalMinutesAll}m) | </Text>
            <Text color="cyan">{filteredLogs.length} entries</Text>
          </Box>
        </>
      ) : (
        status !== "SYNCING" && <Text color="dim">No logs found for this period in Jira.</Text>
      )}

      <Box marginTop={1} flexDirection="column">
        {isFiltering && (
          <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1} flexDirection="column">
            <Box>
              <Box backgroundColor="yellow" paddingX={1} marginRight={1}>
                <Text bold color="black"> FILTER MODE </Text>
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
        )}

        {!isFiltering && status !== "SYNCING" && (
          <Box>
            <Text color="dim">Press </Text>
            <Text bold color="cyan">/</Text>
            <Text color="dim"> to filter tasks</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

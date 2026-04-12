import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";
import { startOfDay, startOfWeek, startOfMonth, format } from "date-fns";
import { Table } from "../components/Table";
import { dbOps } from "../db";
import { formatMinutes } from "../utils";
import { searchIssues, fetchIssueWorklogs } from "../jira";
import { getAppConfig } from "../config";

interface Props {
  period?: string; // "day", "week", "month"
}


type ViewStatus = "IDLE" | "SYNCING" | "SUCCESS" | "ERROR";

export const LogView: React.FC<Props> = ({ period = "day" }) => {
  const [status, setStatus] = useState<ViewStatus>("IDLE");
  const [logs, setLogs] = useState<import("../db").LogDbRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sync();
  }, [period]);

  async function sync() {
    try {
      setStatus("SYNCING");
      const config = getAppConfig();
      const now = new Date();
      let sinceDate: Date;
      let jqlDate: string;

      switch (period) {
        case "week":
          sinceDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case "month":
          sinceDate = startOfMonth(now);
          break;
        default:
          sinceDate = startOfDay(now);
          break;
      }

      jqlDate = format(sinceDate, "yyyy-MM-dd");

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

      // 4. Load from DB
      const updatedLogs = dbOps.getLogs(sinceDate.toISOString());
      setLogs(updatedLogs);
      setStatus("SUCCESS");
    } catch (err: any) {
      setError(err.message);
      setStatus("ERROR");
    }
  }

  const sortedLogs = [...logs].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const data = sortedLogs.map(log => ({
    Date: format(new Date(log.created_at), "dd MMM"),
    Identifier: log.identifier,
    Label: log.label || "",
    Type: log.is_jira ? "Jira" : "Personal",
    Time: formatMinutes(log.minutes)
  }));

  const totalMinutesAll = logs.reduce((sum, log) => sum + log.minutes, 0);

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
          <Table data={data} compact />
          <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
            <Text bold>Grand Total: </Text>
            <Text color="yellow">{formatMinutes(totalMinutesAll)}</Text>
            <Text> ({totalMinutesAll}m)</Text>
          </Box>
        </>
      ) : (
        status !== "SYNCING" && <Text color="dim">No logs found for this period in Jira.</Text>
      )}
    </Box>
  );
};

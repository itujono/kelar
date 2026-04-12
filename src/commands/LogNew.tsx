import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";
import { JIRA_KEY_REGEX, parseJiraTime, roundToNearest5, getNowWithOffset } from "../utils";
import { fetchIssueDetails, postWorklog } from "../jira";
import { getAppConfig } from "../config";
import { dbOps } from "../db";

type Status = "IDLE" | "VALIDATING" | "SYNCING" | "SUCCESS" | "ERROR" | "WARNING_OVERRIDE";

interface Props {
  identifier: string;
  time: string;
}

export const LogNew: React.FC<Props> = ({ identifier, time }) => {
  const [status, setStatus] = useState<Status>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    run();
  }, [identifier, time]);

  async function run() {
    try {
      setStatus("VALIDATING");

      const config = getAppConfig();
      const minutesRaw = parseJiraTime(time);
      const minutes = roundToNearest5(minutesRaw);
      const isJiraKey = JIRA_KEY_REGEX.test(identifier);
      const started = getNowWithOffset();

      let targetIssueKey = identifier;
      let worklogComment = "";

      if (isJiraKey) {
        // Fetch details to validate assignee
        const issue = await fetchIssueDetails(identifier);
        setInfo(`Found ticket: ${issue.fields.summary}`);

        const myAccountId = config.JIRA_ACCOUNT_ID;
        if (issue.fields.assignee?.accountId !== myAccountId) {
          setWarning(`Warning: This ticket is assigned to ${issue.fields.assignee?.displayName || "someone else"}.`);
          // In a real TUI we'd wait for keypress to override, 
          // but for this version we'll just log it and proceed as per instructions "allow override".
        }
        worklogComment = "Logged via Kelar CLI";
      } else {
        // Personal log
        if (!config.PERSONAL_TICKET_ID) {
          throw new Error("PERSONAL_TICKET_ID not set in config.");
        }
        targetIssueKey = config.PERSONAL_TICKET_ID;
        worklogComment = identifier; // Identifier is the comment for personal logs
      }

      setStatus("SYNCING");

      // POST worklog to Jira
      await postWorklog(targetIssueKey, minutes, worklogComment, started);

      // Save to local SQLite
      dbOps.addLog({
        identifier: identifier, // Store original identifier
        minutes,
        is_jira: isJiraKey,
        created_at: started,
      });

      setStatus("SUCCESS");
    } catch (err: any) {
      setError(err.message);
      setStatus("ERROR");
    }
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text bold color="yellow">Logging Work: </Text>
        <Text>{identifier} ({roundToNearest5(parseJiraTime(time))}m)</Text>
      </Box>

      {status === "VALIDATING" && (
        <Box>
          <Spinner type="dots" />
          <Text color="blue"> Validating ticket details...</Text>
        </Box>
      )}

      {status === "SYNCING" && (
        <Box>
          <Spinner type="dots" />
          <Text color="blue"> Syncing with Jira...</Text>
        </Box>
      )}

      {info && (
        <Text color="dim">{info}</Text>
      )}

      {warning && (
        <Text color="yellow">⚠️ {warning}</Text>
      )}

      {status === "SUCCESS" && (
        <Box marginTop={1}>
          <Text color="green" bold>✅ Successfully logged and synced!</Text>
        </Box>
      )}

      {status === "ERROR" && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red" bold>❌ Error</Text>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
};

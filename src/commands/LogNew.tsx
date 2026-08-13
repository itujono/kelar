import { useState, useEffect } from "react";
import { Text, Box, useApp, useInput, useStdin } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { JIRA_KEY_REGEX, parseJiraTime, roundToNearest5, getNowWithOffset } from "../utils";
import { fetchIssueDetails, postWorklog, type JiraIssue } from "../jira";
import { getAppConfig } from "../config";
import { dbOps } from "../db";

type Status = "IDLE" | "GET_COMMENT" | "VALIDATING" | "SYNCING" | "SUCCESS" | "ERROR" | "WARNING_OVERRIDE";

interface Props {
  identifier: string;
  time: string;
  initialComment?: string;
}

export function LogNew({ identifier, time, initialComment }: Props) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [status, setStatus] = useState<Status>("IDLE");
  const [comment, setComment] = useState(initialComment || "");
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const isJiraKey = JIRA_KEY_REGEX.test(identifier);
    if (!isJiraKey) {
      run(initialComment || "", null);
      return;
    }

    let cancelled = false;
    setStatus("VALIDATING");
    fetchIssueDetails(identifier)
      .then((fetchedIssue) => {
        if (cancelled) return;
        setIssue(fetchedIssue);
        setInfo(`Found ticket: ${fetchedIssue.fields.summary}`);

        const myAccountId = getAppConfig().JIRA_ACCOUNT_ID;
        if (fetchedIssue.fields.assignee?.accountId !== myAccountId) {
          setWarning(`Warning: This ticket is assigned to ${fetchedIssue.fields.assignee?.displayName || "someone else"}.`);
          // Non-interactive runs can't answer the prompt, so fall through with the warning shown
          if (isRawModeSupported) {
            setStatus("WARNING_OVERRIDE");
            return;
          }
        }

        proceed(fetchedIssue);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("ERROR");
      });

    return () => {
      cancelled = true;
    };
  }, [identifier, time, initialComment]);

  function proceed(validatedIssue: JiraIssue) {
    if (initialComment) {
      run(initialComment, validatedIssue);
    } else {
      setStatus("GET_COMMENT");
    }
  }

  // Keep this subscriber active from the first render: raw mode only attaches
  // reliably at mount, so a useInput that activates after the async validation
  // never receives keys (the app then exits with a drained event loop).
  useInput(
    (input, key) => {
      if (status !== "WARNING_OVERRIDE") return;
      if (input.toLowerCase() === "y" && issue) {
        proceed(issue);
      } else if (input.toLowerCase() === "n" || key.escape || key.return) {
        exit();
      }
    },
    // Must be a real boolean: ink skips raw mode only when isActive === false,
    // and isRawModeSupported is `undefined` (not false) on non-TTY stdin.
    { isActive: Boolean(isRawModeSupported) }
  );

  async function run(finalComment: string, validatedIssue: JiraIssue | null) {
    try {
      const config = getAppConfig();
      const minutesRaw = parseJiraTime(time);
      const minutes = roundToNearest5(minutesRaw);
      const isJiraKey = JIRA_KEY_REGEX.test(identifier);
      const started = getNowWithOffset();

      let targetIssueKey = identifier;
      let worklogComment = finalComment;
      let label = "";

      if (isJiraKey) {
        label = validatedIssue?.fields.summary ?? identifier;
      } else {
        if (!config.PERSONAL_TICKET_ID) {
          throw new Error("PERSONAL_TICKET_ID not set in config.");
        }
        targetIssueKey = config.PERSONAL_TICKET_ID;
        worklogComment = identifier;
        label = identifier;
      }

      setStatus("SYNCING");

      const jiraResponse = await postWorklog(targetIssueKey, minutes, worklogComment, started);

      dbOps.addLog({
        identifier: identifier,
        label: label,
        comment: worklogComment,
        minutes,
        jira_worklog_id: jiraResponse.id,
        is_jira: isJiraKey,
        created_at: started,
      });

      setStatus("SUCCESS");
      setTimeout(() => exit(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("ERROR");
    }
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text bold color="yellow">Logging Work: </Text>
        <Text>{identifier} ({roundToNearest5(parseJiraTime(time))}m)</Text>
      </Box>

      {status === "GET_COMMENT" && (
        <Box flexDirection="column">
          <Text color="yellow">What did you do? (Optional, press Enter to skip)</Text>
          <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
            <TextInput
              value={comment}
              onChange={setComment}
              onSubmit={(val) => run(val, issue)}
            />
          </Box>
        </Box>
      )}

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

      {status === "WARNING_OVERRIDE" && (
        <Text>Log anyway? <Text color="dim">(y/N)</Text></Text>
      )}

      {status === "SUCCESS" && (
        <Box marginTop={1}>
          <Text color="green" bold>✅ Successfully logged and synced!</Text>
        </Box>
      )}

      {status === "ERROR" && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red" bold>❌ Error</Text>
          <Text color="red">{error?.message}</Text>
        </Box>
      )}
    </Box>
  );
};

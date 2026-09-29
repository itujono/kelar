import React from "react";
import { Box, Text } from "ink";
import { type LogDbRow } from "../../db";
import { formatMinutes, formatLogDate } from "../../utils";

interface LogDetailPaneProps {
  log: LogDbRow;
  allLogs: LogDbRow[];
  timeZone: string;
}

export const LogDetailPane: React.FC<LogDetailPaneProps> = ({ log, allLogs, timeZone }) => {
  // Find all logs for the same identifier (ticket key or personal log label)
  const identifierLogs = React.useMemo(() => {
    return allLogs
      .filter(l => l.identifier === log.identifier)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allLogs, log.identifier]);

  const totalMinutes = React.useMemo(() =>
    identifierLogs.reduce((sum, l) => sum + l.minutes, 0),
  [identifierLogs]);

  // Personal logs store the remark as their identifier, so repeating it here is noise
  const remarks = log.comment && log.comment !== log.identifier ? log.comment : null;

  return (
    <Box
      flexDirection="column"
      width={45}
      borderStyle="round"
      borderColor="dim"
      paddingX={1}
    >
      <Text bold underline color="cyan">ITEM DETAILS</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="yellow">{log.identifier}</Text>
        <Text color="white" wrap="wrap">{log.label || "No Description"}</Text>
        {remarks && <Text color="dim" wrap="wrap" italic>{remarks}</Text>}
      </Box>

      <Box
        marginTop={1}
        paddingTop={1}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor="dim"
        flexDirection="column"
      >
        <Box>
          <Box width={15}><Text color="dim">Total Time:</Text></Box>
          <Text color="yellow" bold>{formatMinutes(totalMinutes)}</Text>
          <Text color="dim"> ({totalMinutes}m)</Text>
        </Box>
        <Box>
          <Box width={15}><Text color="dim">Entries Count:</Text></Box>
          <Text>{identifierLogs.length} logs</Text>
        </Box>
        <Box>
          <Box width={15}><Text color="dim">Project:</Text></Box>
          <Text>{log.project || "-"}</Text>
        </Box>
      </Box>

      <Box
        marginTop={1}
        paddingTop={1}
        borderStyle="single"
        borderTop={true}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor="dim"
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text bold color="white">RECENT HISTORY</Text>
        </Box>

        <Box flexDirection="row">
          {/* Left Column */}
          <Box flexDirection="column" marginRight={2}>
            {identifierLogs.slice(0, 10).map((l) => {
              const isCurrent = l.id === log.id;
              return (
                <Box key={l.id}>
                  <Box width={7}>
                    <Text color={isCurrent ? "cyan" : "dim"}>
                      {formatLogDate(l.created_at, timeZone)}
                    </Text>
                  </Box>
                  <Box width={9}>
                    <Text color={isCurrent ? "green" : "yellow"} bold={isCurrent}>
                      {formatMinutes(l.minutes)}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Right Column */}
          <Box flexDirection="column">
            {identifierLogs.slice(10, 20).map((l) => {
              const isCurrent = l.id === log.id;
              return (
                <Box key={l.id}>
                  <Box width={7}>
                    <Text color={isCurrent ? "cyan" : "dim"}>
                      {formatLogDate(l.created_at, timeZone)}
                    </Text>
                  </Box>
                  <Box width={9}>
                    <Text color={isCurrent ? "green" : "yellow"} bold={isCurrent}>
                      {formatMinutes(l.minutes)}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {identifierLogs.length > 14 && (
          <Box marginTop={0}>
            <Text color="dim" italic> ... and {identifierLogs.length - 14} more entries</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="dim" italic>Press </Text>
        <Text color="cyan" bold>'o'</Text>
        <Text color="dim" italic> to open in browser</Text>
      </Box>
    </Box>
  );
};

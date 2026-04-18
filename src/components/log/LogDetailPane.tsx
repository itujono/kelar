import React from "react";
import { Box, Text } from "ink";
import { format } from "date-fns";
import { type LogDbRow } from "../../db";
import { formatMinutes } from "../../utils";

interface LogDetailPaneProps {
  log: LogDbRow;
  allLogs: LogDbRow[];
}

export const LogDetailPane: React.FC<LogDetailPaneProps> = ({ log, allLogs }) => {
  // Find all logs for the same identifier (ticket key or personal log label)
  const identifierLogs = allLogs
    .filter(l => l.identifier === log.identifier)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalMinutes = identifierLogs.reduce((sum, l) => sum + l.minutes, 0);

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
        {identifierLogs.slice(0, 10).map((l) => (
          <Box key={l.id}>
            <Box width={8}>
              <Text color="dim">{format(new Date(l.created_at), "dd MMM")}: </Text>
            </Box>
            <Box width={10}>
              <Text color="yellow">{formatMinutes(l.minutes)}</Text>
            </Box>
          </Box>
        ))}
        {identifierLogs.length > 10 && (
          <Box marginTop={0}>
            <Text color="dim" italic>  ... and {identifierLogs.length - 10} more entries</Text>
          </Box>
        )}
      </Box>

      {!!log.is_jira && (
        <Box marginTop={1}>
          <Text color="dim" italic>Press </Text>
          <Text color="cyan" bold>'o'</Text>
          <Text color="dim" italic> to open in browser</Text>
        </Box>
      )}
    </Box>
  );
};

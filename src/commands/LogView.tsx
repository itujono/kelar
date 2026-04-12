import React from "react";
import { Text, Box } from "ink";
import { Table } from "../components/Table";
import { dbOps } from "../db";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { formatMinutes } from "../utils";

interface Props {
  period?: string; // "day", "week", "month"
}

export const LogView: React.FC<Props> = ({ period = "day" }) => {
  const now = new Date();
  let since: Date;

  switch (period) {
    case "week":
      since = startOfWeek(now, { weekStartsOn: 1 });
      break;
    case "month":
      since = startOfMonth(now);
      break;
    case "day":
    default:
      since = startOfDay(now);
      break;
  }

  const logs = dbOps.getLogs(since.toISOString());

  // Group by identifier
  const grouped = logs.reduce((acc, log) => {
    const id = log.identifier;
    if (!acc[id]) {
      acc[id] = {
        identifier: id,
        totalMinutes: 0,
        entries: 0,
        type: log.is_jira ? "Jira" : "Personal"
      };
    }

    const item = acc[id];
    if (item) {
      item.totalMinutes += log.minutes;
      item.entries += 1;
    }
    return acc;
  }, {} as Record<string, { identifier: string; totalMinutes: number; entries: number; type: string }>);

  const data = Object.values(grouped).map(item => ({
    Identifier: item.identifier,
    Type: item.type,
    Entries: item.entries,
    "Total Time": formatMinutes(item.totalMinutes)
  }));

  const totalMinutesAll = Object.values(grouped).reduce((sum, item) => sum + item.totalMinutes, 0);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Logs for this {period || "day"}:</Text>
      </Box>

      {data.length > 0 ? (
        <>
          <Table data={data} />
          <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
            <Text bold>Grand Total: </Text>
            <Text color="yellow">{formatMinutes(totalMinutesAll)}</Text>
            <Text> ({totalMinutesAll}m)</Text>
          </Box>
        </>
      ) : (
        <Text color="dim">No logs found for this period.</Text>
      )}
    </Box>
  );
};

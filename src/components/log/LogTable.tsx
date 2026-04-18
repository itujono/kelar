import React from "react";
import { Box, Text } from "ink";
import { format } from "date-fns";
import { Table } from "../Table";
import { formatMinutes } from "../../utils";
import { type LogDbRow } from "../../db";
import type { PeriodType } from "../../hooks/useLogView";

interface LogTableProps {
  logs: LogDbRow[];
  selectedIndex: number;
  period: PeriodType;
  targetHours: number;
  daysRemaining: number;
  totalMinutes: number;
  personalCount: number;
  isLoading?: boolean;
}

export const LogTable: React.FC<LogTableProps> = ({
  logs,
  selectedIndex,
  period,
  targetHours,
  daysRemaining,
  totalMinutes,
  personalCount,
  isLoading = false,
}) => {
  const getEmptyMessage = () => {
    const now = new Date();
    if (period === "day") return "No logs yet today. Ready to crush some tasks?";
    if (period === "week" && now.getDay() === 1) return "The week has just started! Time to build some momentum.";
    if (period === "month" && now.getDate() <= 3) return "Fresh month alert! Let's get a head start on that goal.";
    return `No logs found for this ${period} in Jira.`;
  };

  if (logs.length === 0) {
    if (isLoading) return null;
    return (
      <Box padding={1}>
        <Text color="dim">{getEmptyMessage()}</Text>
      </Box>
    );
  }

  const WINDOW_SIZE = 18;
  let startIndex = 0;
  if (logs.length > WINDOW_SIZE) {
    startIndex = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
    if (startIndex + WINDOW_SIZE > logs.length) {
      startIndex = logs.length - WINDOW_SIZE;
    }
  }
  const visibleLogs = logs.slice(startIndex, startIndex + WINDOW_SIZE);

  const data = visibleLogs.map(log => ({
    Date: format(new Date(log.created_at), "dd MMM"),
    Identifier: log.identifier,
    Label: log.label || "",
    Type: log.is_jira ? "Jira" : "Personal",
    Time: formatMinutes(log.minutes),
    _raw: log
  }));

  return (
    <Box flexDirection="column">
      <Table
        data={data}
        columns={["Date", "Identifier", "Label", "Type", "Time"]}
        columnWidths={{
          Date: 10,
          Identifier: 30,
          Label: 80,
          Type: 12,
          Time: 10
        }}
        compact
        selectedIndex={selectedIndex - startIndex}
        header={startIndex > 0 ? (
          <Text color="dim">  ↑ {startIndex} more logs...</Text>
        ) : undefined}
        footer={startIndex + WINDOW_SIZE < logs.length ? (
          <Box paddingX={1}>
            <Text color="dim">  ↓ {logs.length - (startIndex + WINDOW_SIZE)} more logs...</Text>
          </Box>
        ) : undefined}
        renderCell={(col, val, row) => {
          const log = row._raw as LogDbRow;
          const isSelected = data.indexOf(row) === (selectedIndex - startIndex);

          if (!log.is_jira && (col === "Identifier" || col === "Type")) {
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
          <Text color="yellow">{formatMinutes(totalMinutes)}</Text>
          <Text color="dim"> ({totalMinutes}m) | </Text>
          {period === "month" && (
            <Text>
              <Text color="magenta" bold>{((totalMinutes / (targetHours * 60)) * 100).toFixed(1)}%</Text>
              <Text color="dim"> of {targetHours}h goal | </Text>
              <Text color="yellow" bold>{daysRemaining}</Text>
              <Text color="dim"> days left</Text>
            </Text>
          )}
          <Text color="dim"> | </Text>
          <Text color="cyan">{logs.length} entries ({personalCount} personal items)</Text>
        </Box>
        {period === "month" && (
          <Box marginTop={1}>
            <Text color="magenta">
              {"█".repeat(Math.min(30, Math.floor((totalMinutes / (targetHours * 60)) * 30)))}
              <Text color="dim">
                {"░".repeat(Math.max(0, 30 - Math.floor((totalMinutes / (targetHours * 60)) * 30)))}
              </Text>
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

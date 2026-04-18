import React from "react";
import { Box, Text } from "ink";
import { formatRelativeTime, isZombieTicket } from "../../utils";
import { type JiraIssue } from "../../jira";
import { Table } from "../Table";

interface TixTableProps {
  tickets: JiraIssue[];
  selectedIndex: number;
}

const formatSeconds = (seconds: number | null): string => {
  if (!seconds) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getStatusColor = (categoryKey: string, statusName: string): string => {
  if (statusName.toLowerCase().includes("review")) return "magenta";
  switch (categoryKey) {
    case "new": return "blue";
    case "indeterminate": return "yellow";
    case "done": return "green";
    default: return "white";
  }
};

const getPriorityColor = (priorityName: string): string => {
  const p = priorityName.toLowerCase();
  if (p.includes("high") || p.includes("highest") || p.includes("urgent") || p.includes("major")) return "red";
  if (p.includes("low") || p.includes("lowest") || p.includes("minor")) return "dim";
  return "cyan";
};

export const TixTable: React.FC<TixTableProps> = ({ tickets, selectedIndex }) => {
  const COL_WIDTHS = {
    ID: 8,
    Prio: 8,
    Title: 100,
    Status: 12,
    Assignee: 12,
    Est: 8,
    Log: 8,
    Created: 10,
    Updated: 10,
  };

  if (tickets.length === 0) {
    return (
      <Box padding={1}>
        <Text color="dim">No tickets found.</Text>
      </Box>
    );
  }

  // Calculate stats
  const total = tickets.length;
  const todo = tickets.filter(t => t.fields.status.statusCategory.key === "new").length;
  const inReview = tickets.filter(t => t.fields.status.name.toLowerCase().includes("review")).length;
  const inProgress = tickets.filter(t =>
    t.fields.status.statusCategory.key === "indeterminate" &&
    !t.fields.status.name.toLowerCase().includes("review")
  ).length;

  const zombies = tickets.filter(isZombieTicket).length;

  // Calculate windowed view
  const WINDOW_SIZE = 18;
  let start = 0;
  if (tickets.length > WINDOW_SIZE) {
    start = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
    if (start + WINDOW_SIZE > tickets.length) {
      start = tickets.length - WINDOW_SIZE;
    }
  }
  const visibleTickets = tickets.slice(start, start + WINDOW_SIZE);

  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={1}>
      <Table
        data={visibleTickets.map(t => ({
          ID: t.key,
          Prio: t.fields.priority?.name || "None",
          Title: t.fields.summary,
          Status: t.fields.status.name,
          Assignee: t.fields.assignee?.displayName?.split(" ")[0] || "Unassigned",
          Est: formatSeconds(t.fields.timeoriginalestimate),
          Log: formatSeconds(t.fields.timespent),
          Created: formatRelativeTime(new Date(t.fields.created)),
          Updated: formatRelativeTime(new Date(t.fields.updated)),
          _raw: t
        }))}
        columns={["ID", "Prio", "Title", "Status", "Assignee", "Est", "Log", "Created", "Updated"]}
        columnWidths={COL_WIDTHS}
        compact
        selectedIndex={selectedIndex - start}
        header={start > 0 ? (
          <Text color="dim italic">  ↑ {start} more tickets...</Text>
        ) : undefined}
        renderCell={(col, val, row) => {
          const t = row._raw as JiraIssue;
          const isSelected = (selectedIndex - start) === visibleTickets.indexOf(t);

          if (col === "Prio") {
            return <Text color={isSelected ? "black" : getPriorityColor(val)}>{val}</Text>;
          }
          if (col === "Status") {
            return <Text color={isSelected ? "black" : getStatusColor(t.fields.status.statusCategory.key, val)}>{val}</Text>;
          }
          if (col === "Assignee") {
            return <Text color={isSelected ? "black" : "yellow"}>{val}</Text>;
          }
          if (isSelected) return val;
          if (col === "ID" || col === "Est" || col === "Log" || col === "Created" || col === "Updated") {
            return <Text color="dim">{val}</Text>;
          }
          return val;
        }}
        footer={
          <Box flexDirection="column" flexGrow={1}>
            {start + WINDOW_SIZE < tickets.length && (
              <Box borderStyle="single" borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} borderColor="dim" paddingX={1}>
                <Text color="dim italic">  ↓ {tickets.length - (start + WINDOW_SIZE)} more tickets...</Text>
              </Box>
            )}
            <Box paddingX={1}>
              <Text color="dim">Total: </Text><Text bold>{total}</Text>
              <Text color="dim"> | To-Do: </Text><Text color="blue">{todo}</Text>
              <Text color="dim"> | In Progress: </Text><Text color="yellow">{inProgress}</Text>
              <Text color="dim"> | In Review: </Text><Text color="magenta">{inReview}</Text>
              <Text color="dim"> | Zombies: </Text><Text color="red">{zombies}</Text>
            </Box>
          </Box>
        }
      />
    </Box>
  );
};

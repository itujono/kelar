import React from "react";
import { Box, Text } from "ink";
import { formatRelativeTime, isZombieTicket, formatDuration } from "../../utils";
import { type JiraIssue } from "../../jira";
import { Table } from "../Table";
import { useWindowedSlice } from "../../hooks/useWindowedSlice";

interface TixTableProps {
  tickets: JiraIssue[];
  selectedIndex: number;
}


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
    Project: 18,
    Prio: 8,
    Title: 82,
    Status: 12,
    Assignee: 12,
    Est: 8,
    Log: 8,
    Created: 10,
    Updated: 10,
  };

  const { visibleItems: visibleTickets, startIndex } = useWindowedSlice(tickets, selectedIndex, 18);

  if (tickets.length === 0) {
    return (
      <Box padding={1}>
        <Text color="dim">No tickets found.</Text>
      </Box>
    );
  }

  // Calculate stats
  const total = tickets.length;
  const { todo, inProgress, inReview } = tickets.reduce(
    (acc, t) => {
      const key = t.fields.status.statusCategory.key;
      const name = t.fields.status.name.toLowerCase();
      if (key === "new") acc.todo++;
      if (key === "indeterminate" && !name.includes("review")) acc.inProgress++;
      if (name.includes("review")) acc.inReview++;
      return acc;
    },
    { todo: 0, inProgress: 0, inReview: 0 }
  );

  const zombies = tickets.filter(isZombieTicket).length;

  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={1}>
      <Table
        data={visibleTickets.map(t => ({
          ID: t.key,
          Project: t.fields.project.name,
          Prio: t.fields.priority?.name || "None",
          Title: t.fields.summary,
          Status: t.fields.status.name,
          Assignee: t.fields.assignee?.displayName?.split(" ")[0] || "Unassigned",
          Est: formatDuration(t.fields.timeoriginalestimate),
          Log: formatDuration(t.fields.timespent),
          Created: formatRelativeTime(new Date(t.fields.created)),
          Updated: formatRelativeTime(new Date(t.fields.updated)),
          _statusCategoryKey: t.fields.status.statusCategory.key,
        }))}
        columns={["ID", "Project", "Prio", "Title", "Status", "Assignee", "Est", "Log", "Created", "Updated"]}
        columnWidths={COL_WIDTHS}
        compact
        selectedIndex={selectedIndex - startIndex}
        header={startIndex > 0 ? (
          <Text color="dim italic">  ↑ {startIndex} more tickets...</Text>
        ) : undefined}
        renderCell={(col, val, row, rowIndex) => {
          const isSelected = (selectedIndex - startIndex) === rowIndex;

          if (col === "Prio") {
            return <Text color={isSelected ? "black" : getPriorityColor(val as string)}>{val as React.ReactNode}</Text>;
          }
          if (col === "Status") {
            return <Text color={isSelected ? "black" : getStatusColor(row._statusCategoryKey, val as string)}>{val as React.ReactNode}</Text>;
          }
          if (col === "Assignee") {
            return <Text color={isSelected ? "black" : "yellow"}>{val as React.ReactNode}</Text>;
          }
          if (isSelected) return val as React.ReactNode;
          if (col === "ID" || col === "Project" || col === "Est" || col === "Log" || col === "Created" || col === "Updated") {
            return <Text color="dim">{val as React.ReactNode}</Text>;
          }
          return val as React.ReactNode;
        }}
        footer={
          <Box flexDirection="column" flexGrow={1}>
            {startIndex + 18 < tickets.length && (
              <Text color="dim italic">  ↓ {tickets.length - (startIndex + 18)} more tickets...</Text>
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

import React from "react";
import { Box, Text } from "ink";
import { formatDistanceToNow } from "date-fns";
import { type JiraIssue } from "../jira";

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
    key: 12,
    priority: 8,
    title: 60,
    status: 15,
    assignee: 15,
    estimate: 10,
    logged: 10,
    created: 14,
  };

  const columns = [
    { label: "ID", width: COL_WIDTHS.key },
    { label: "Prio", width: COL_WIDTHS.priority },
    { label: "Title", width: COL_WIDTHS.title },
    { label: "Status", width: COL_WIDTHS.status },
    { label: "Assignee", width: COL_WIDTHS.assignee },
    { label: "Est", width: COL_WIDTHS.estimate },
    { label: "Log", width: COL_WIDTHS.logged },
    { label: "Created", width: COL_WIDTHS.created },
  ];

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
  
  // Zombie logic (simplified here, but typically checked in parent or detail pane)
  const isZombie = (t: JiraIssue) => {
    const updated = new Date(t.fields.updated).getTime();
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    return updated < fortyEightHoursAgo;
  };
  const zombies = tickets.filter(isZombie).length;

  // Calculate windowed view
  const WINDOW_SIZE = 18; // Maximum number of tickets to show
  let start = 0;
  if (tickets.length > WINDOW_SIZE) {
    start = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
    if (start + WINDOW_SIZE > tickets.length) {
      start = tickets.length - WINDOW_SIZE;
    }
  }
  const visibleTickets = tickets.slice(start, start + WINDOW_SIZE);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="dim" flexGrow={1}>
      {/* Header */}
      <Box paddingX={1} marginBottom={0}>
        {columns.map((col) => (
          <Box key={col.label} width={col.width}>
            <Text bold color="cyan">
              {col.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {start > 0 && (
        <Box paddingX={1}>
          <Text color="dim">  ↑ {start} more tickets...</Text>
        </Box>
      )}

      {visibleTickets.map((t, i) => {
        const index = start + i;
        const isSelected = index === selectedIndex;
        const priority = t.fields.priority?.name || "None";
        const assignee = t.fields.assignee?.displayName?.split(" ")[0] || "Unassigned";
        const status = t.fields.status.name;
        const statusCat = t.fields.status.statusCategory.key;
        const created = new Date(t.fields.created);

        return (
          <Box
            key={t.id}
            paddingX={1}
            backgroundColor={isSelected ? "white" : undefined}
          >
            <Box width={COL_WIDTHS.key}>
              <Text color={isSelected ? "black" : "dim"}>{t.key}</Text>
            </Box>
            <Box width={COL_WIDTHS.priority}>
              <Text color={isSelected ? "black" : getPriorityColor(priority)}>
                {priority}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.title} marginRight={2}>
              <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                {t.fields.summary}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.status}>
              <Text color={isSelected ? "black" : getStatusColor(statusCat, status)}>
                {status}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.assignee}>
              <Text color={isSelected ? "black" : "yellow"}>
                {assignee}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.estimate}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatSeconds(t.fields.timeoriginalestimate)}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.logged}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatSeconds(t.fields.timespent)}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.created}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatDistanceToNow(created, { addSuffix: false }).replace("about ", "~ ")}
              </Text>
            </Box>
          </Box>
        );
      })}

      {start + WINDOW_SIZE < tickets.length && (
        <Box paddingX={1}>
          <Text color="dim">  ↓ {tickets.length - (start + WINDOW_SIZE)} more tickets...</Text>
        </Box>
      )}

      {/* Stats Footer */}
      <Box paddingX={1} marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="dim">
        <Text color="dim">Total: </Text><Text bold>{total}</Text>
        <Text color="dim"> | To-Do: </Text><Text color="blue">{todo}</Text>
        <Text color="dim"> | In Progress: </Text><Text color="yellow">{inProgress}</Text>
        <Text color="dim"> | In Review: </Text><Text color="magenta">{inReview}</Text>
        <Text color="dim"> | Zombies: </Text><Text color="red">{zombies}</Text>
      </Box>
    </Box>
  );
};

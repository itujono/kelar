import React from "react";
import { Box, Text } from "ink";
import { formatRelativeTime } from "../utils";
import { type JiraIssue } from "../jira";
import { Table } from "./Table";

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
    title: 70,
    status: 15,
    assignee: 15,
    estimate: 10,
    logged: 10,
    created: 14,
    updated: 14,
  };


  if (tickets.length === 0) {
    return (
      <Box padding={1}>
        <Text color="dim">No tickets found.</Text>
      </Box>
    );
  }

  const total = tickets.length;
  const todo = tickets.filter(t => t.fields.status.statusCategory.key === "new").length;
  const inReview = tickets.filter(t => t.fields.status.name.toLowerCase().includes("review")).length;
  const inProgress = tickets.filter(t =>
    t.fields.status.statusCategory.key === "indeterminate" &&
    !t.fields.status.name.toLowerCase().includes("review")
  ).length;

  const isZombie = (t: JiraIssue) => {
    const status = t.fields.status.name.toLowerCase();
    const isIndeterminate = t.fields.status.statusCategory.key === "indeterminate";
    const isWaiting = status.includes("review") || status.includes("qa") || status.includes("test");

    if (!isIndeterminate || isWaiting) return false;

    const updated = new Date(t.fields.updated).getTime();
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    return updated < fortyEightHoursAgo;
  };
  const zombies = tickets.filter(isZombie).length;

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
    <>
      <Table
        data={visibleTickets.map(t => ({
          key: t.key,
          priority: t.fields.priority?.name || "None",
          title: t.fields.summary,
          status: t.fields.status.name,
          assignee: t.fields.assignee?.displayName?.split(" ")[0] || "Unassigned",
          estimate: formatSeconds(t.fields.timeoriginalestimate),
          logged: formatSeconds(t.fields.timespent),
          created: formatRelativeTime(new Date(t.fields.created)),
          updated: formatRelativeTime(new Date(t.fields.updated)),
          _raw: t
        }))}
        columns={["key", "priority", "title", "status", "assignee", "estimate", "logged", "created", "updated"]}
        columnWidths={COL_WIDTHS}
        compact
        selectedIndex={selectedIndex - start}
        renderCell={(col, val, row) => {
          const t = row._raw as JiraIssue;
          const isSelected = (selectedIndex - start) === visibleTickets.indexOf(t);

          if (col === "priority") {
            return <Text color={isSelected ? "black" : getPriorityColor(val)}>{val}</Text>;
          }
          if (col === "status") {
            return <Text color={isSelected ? "black" : getStatusColor(t.fields.status.statusCategory.key, val)}>{val}</Text>;
          }
          if (col === "assignee") {
            return <Text color={isSelected ? "black" : "yellow"}>{val}</Text>;
          }
          if (isSelected) return val;
          if (col === "key" || col === "estimate" || col === "logged" || col === "created" || col === "updated") {
            return <Text color="dim">{val}</Text>;
          }
          return val;
        }}
      />
      <Box paddingX={1} marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="dim">
        <Text color="dim">Total: </Text><Text bold>{total}</Text>
        <Text color="dim"> | To-Do: </Text><Text color="blue">{todo}</Text>
        <Text color="dim"> | In Progress: </Text><Text color="yellow">{inProgress}</Text>
        <Text color="dim"> | In Review: </Text><Text color="magenta">{inReview}</Text>
        <Text color="dim"> | Zombies: </Text><Text color="red">{zombies}</Text>
      </Box>
    </>
  );
};

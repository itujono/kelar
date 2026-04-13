import React from "react";
import { Box, Text } from "ink";
import { formatDistanceToNow } from "date-fns";
import { type BitbucketPR } from "../bitbucket";

interface PRTableProps {
  prs: BitbucketPR[];
  selectedIndex: number;
}

export const PRTable: React.FC<PRTableProps> = ({ prs, selectedIndex }) => {
  if (prs.length === 0) {
    return (
      <Box padding={1}>
        <Text color="dim">No active pull requests found.</Text>
      </Box>
    );
  }

  // Define columns and widths
  const COL_WIDTHS = {
    id: 6,
    author: 12,
    title: 80,
    created: 16,
    updated: 16,
    status: 8,
  };

  const columns = [
    { label: "ID", width: COL_WIDTHS.id },
    { label: "Author", width: COL_WIDTHS.author },
    { label: "Title", width: COL_WIDTHS.title },
    { label: "Created", width: COL_WIDTHS.created },
    { label: "Updated", width: COL_WIDTHS.updated },
    { label: "Status", width: COL_WIDTHS.status },
  ];

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
      {prs.map((pr, index) => {
        const isSelected = index === selectedIndex;
        const authorName = pr.author.display_name.split(" ")[0] || "Unknown";

        // Approval count
        const approvals = pr.participants?.filter(p => p.approved).length || 0;
        const status = approvals > 0 ? `✓ ${approvals}` : `○ ${approvals}`;
        const statusColor = isSelected ? "black" : (approvals > 0 ? "green" : "dim");


        const createdDate = new Date(pr.created_on);
        const updatedDate = new Date(pr.updated_on);

        return (
          <Box
            key={pr.id}
            paddingX={1}
            backgroundColor={isSelected ? "white" : undefined}
          >
            <Box width={COL_WIDTHS.id}>
              <Text color={isSelected ? "black" : "dim"}>#{pr.id}</Text>
            </Box>
            <Box width={COL_WIDTHS.author}>
              <Text color={isSelected ? "black" : "yellow"}>{authorName}</Text>
            </Box>
            <Box width={COL_WIDTHS.title}>
              <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                {pr.title}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.created}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatDistanceToNow(createdDate, { addSuffix: false })}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.updated}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatDistanceToNow(updatedDate, { addSuffix: false })}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.status}>
              <Text color={statusColor}>{status}</Text>
            </Box>

          </Box>
        );
      })}
    </Box>
  );
};




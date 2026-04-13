import React from "react";
import { Box, Text } from "ink";
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
  const columns = [
    { label: "ID", width: 6, key: "id" },
    { label: "Author", width: 15, key: "author" },
    { label: "Title", width: 40, key: "title" },
    { label: "Status", width: 15, key: "status" },
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="dim">
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

        const status = `✓ ${approvals}`;

        return (
          <Box
            key={pr.id}
            paddingX={1}
            backgroundColor={isSelected ? "white" : undefined}
          >
            <Box width={columns?.[0]?.width}>
              <Text color={isSelected ? "black" : "dim"}>#{pr.id}</Text>
            </Box>
            <Box width={columns?.[1]?.width}>
              <Text color={isSelected ? "black" : "yellow"}>{authorName}</Text>
            </Box>
            <Box width={columns?.[2]?.width}>
              <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                {pr.title}
              </Text>
            </Box>
            <Box width={columns?.[3]?.width}>
              <Text color={isSelected ? "black" : "green"}>{status}</Text>
            </Box>

          </Box>
        );
      })}
    </Box>
  );
};

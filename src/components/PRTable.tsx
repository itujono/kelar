import React from "react";
import { Box, Text } from "ink";
import { type BitbucketPR } from "../bitbucket";
import { getBitbucketConfig } from "../config";
import { formatRelativeTime } from "../utils";

interface PRTableProps {
  prs: BitbucketPR[];
  selectedIndex: number;
  showMeColumn?: boolean;
  unresolvedCounts?: Record<number, number | null>;
}

export const PRTable: React.FC<PRTableProps> = ({ 
  prs, 
  selectedIndex, 
  showMeColumn = true,
  unresolvedCounts = {}
}) => {
  const config = getBitbucketConfig();
  const myUsername = config.BITBUCKET_USERNAME?.toLowerCase();
  const myHandle = myUsername?.includes("@") ? myUsername.split("@")[0] : myUsername;

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
    title: showMeColumn ? 80 : 86,
    myReview: showMeColumn ? 6 : 0,
    feedback: 6,
    unresolved: 6,
    created: 14,
    updated: 14,
    status: 8,
  };

  const columns = [
    { label: "ID", width: COL_WIDTHS.id },
    { label: "Author", width: COL_WIDTHS.author },
    { label: "Title", width: COL_WIDTHS.title },
    ...(showMeColumn ? [{ label: "Me", width: COL_WIDTHS.myReview }] : []),
    { label: "FB", width: COL_WIDTHS.feedback },
    { label: "UN", width: COL_WIDTHS.unresolved },
    { label: "Created", width: COL_WIDTHS.created },
    { label: "Updated", width: COL_WIDTHS.updated },
    { label: "Status", width: COL_WIDTHS.status },
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="dim" flexGrow={1}>

      {/* Header */}
      <Box paddingX={1} marginBottom={0}>
        {columns.map((col) => (
          <Box key={col.label} width={col.width} marginRight={col.label === "Title" ? 4 : 0}>
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

        // My review status
        const myParticipant = pr.participants?.find(p => {
          if (!myUsername) return false;
          const nick = p.user.nickname?.toLowerCase();
          const display = p.user.display_name?.toLowerCase();
          const account = p.user.account_id?.toLowerCase();
          
          return (
            nick === myUsername || 
            nick === myHandle ||
            display === myUsername || 
            display?.includes(myUsername) ||
            display?.includes(myHandle || "") ||
            account === myUsername ||
            account === myHandle
          );
        });

        let myReviewIcon = "-";
        let myReviewColor = "dim";
        
        if (!myUsername) {
          myReviewIcon = "?";
          myReviewColor = "yellow";
        } else if (myParticipant) {
          const isApproved = myParticipant.approved || myParticipant.state === "approved";
          
          if (isApproved) {
            myReviewIcon = "✓";
            myReviewColor = "green";
          } else {
            myReviewIcon = "-";
            myReviewColor = "red";
          }
        }

        const approvals = pr.participants?.filter(p => p.approved || p.state === "approved").length || 0;
        const status = approvals > 0 ? `✓ ${approvals}` : `○ ${approvals}`;
        const statusColor = isSelected ? "black" : (approvals > 0 ? "green" : "dim");

        const commentCount = pr.comment_count || 0;
        const unresolvedCount = unresolvedCounts[pr.id] ?? 0;

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
            <Box width={COL_WIDTHS.title} marginRight={4}>
              <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                {pr.title}
              </Text>
            </Box>
            {showMeColumn && (
              <Box width={COL_WIDTHS.myReview}>
                <Text bold color={isSelected ? "black" : myReviewColor}>{myReviewIcon}</Text>
              </Box>
            )}
            <Box width={COL_WIDTHS.feedback}>
              <Text color={isSelected ? "black" : (commentCount > 0 ? "magenta" : "dim")}>
                {commentCount}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.unresolved}>
              <Text color={isSelected ? "black" : (unresolvedCount > 0 ? "red" : "dim")}>
                {unresolvedCount}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.created}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatRelativeTime(createdDate)}
              </Text>
            </Box>
            <Box width={COL_WIDTHS.updated}>
              <Text color={isSelected ? "black" : "dim"}>
                {formatRelativeTime(updatedDate)}
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

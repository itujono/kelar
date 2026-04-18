import React from "react";
import { Box, Text } from "ink";
import { type BitbucketPR } from "../bitbucket";
import { getBitbucketConfig } from "../config";
import { formatRelativeTime } from "../utils";
import { Table } from "./Table";

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
  const COL_WIDTHS: Partial<Record<string, number>> = {
    id: 6,
    author: 12,
    title: showMeColumn ? 80 : 86,
    me: 6,
    fb: 6,
    un: 6,
    created: 14,
    updated: 14,
    status: 8,
  };

  return (

  <Table
    data={prs.map(pr => {
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
      const feedback = pr.comment_count || 0;
      const unresolved = unresolvedCounts[pr.id] ?? 0;

      return {
        id: `#${pr.id}`,
        author: authorName,
        title: pr.title,
        me: showMeColumn ? myReviewIcon : "",
        fb: feedback,
        un: unresolved,
        created: formatRelativeTime(new Date(pr.created_on)),
        updated: formatRelativeTime(new Date(pr.updated_on)),
        status: approvals > 0 ? `✓ ${approvals}` : `○ ${approvals}`,
        _raw: { pr, myReviewColor, approvals }
      };
    })}
    columns={[
      "id", "author", "title",
      ...(showMeColumn ? ["me"] : []),
      "fb", "un", "created", "updated", "status"
    ] as any}
    columnWidths={COL_WIDTHS}
    compact
    selectedIndex={selectedIndex}
    renderCell={(col, val, row) => {
      const { pr, myReviewColor, approvals } = row._raw;
      const isSelected = prs.indexOf(pr) === selectedIndex;

      if (col === "id" || col === "created" || col === "updated") {
        return <Text color={isSelected ? "black" : "dim"}>{val}</Text>;
      }
      if (col === "author") {
        return <Text color={isSelected ? "black" : "yellow"}>{val}</Text>;
      }
      if (col === "me" && showMeColumn) {
        return <Text bold color={isSelected ? "black" : myReviewColor}>{val}</Text>;
      }
      if (col === "fb") {
        return <Text color={isSelected ? "black" : (val > 0 ? "magenta" : "dim")}>{val}</Text>;
      }
      if (col === "un") {
        return <Text color={isSelected ? "black" : (val > 0 ? "red" : "dim")}>{val}</Text>;
      }
      if (col === "status") {
        const statusColor = isSelected ? "black" : (approvals > 0 ? "green" : "dim");
        return <Text color={statusColor}>{val}</Text>;
      }
      return val;
    }}
  />
);
};

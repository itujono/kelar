import React from "react";
import { Box, Text } from "ink";
import { type BitbucketPR, isBitbucketMe } from "../../bitbucket";
import { getBitbucketConfig } from "../../config";
import { formatRelativeTime } from "../../utils";
import { Table } from "../Table";
import { useWindowedSlice } from "../../hooks/useWindowedSlice";

interface PRTableProps {
  prs: BitbucketPR[];
  selectedIndex: number;
  showMeColumn?: boolean;
  metrics?: Record<number, { fb: number; nr: number | null }>;
}

export const PRTable: React.FC<PRTableProps> = ({
  prs,
  selectedIndex,
  showMeColumn = true,
  metrics = {}
}) => {
  const config = React.useMemo(() => getBitbucketConfig(), []);

  // Define columns and widths
  const COL_WIDTHS: Partial<Record<string, number>> = {
    id: 6,
    author: 12,
    title: showMeColumn ? 80 : 86,
    me: 6,
    fb: 6,
    nr: 6,
    created: 14,
    updated: 14,
    status: 8,
  };

  const { visibleItems: visiblePrs, startIndex } = useWindowedSlice(prs, selectedIndex, 18);

  return (
    <Table
      data={visiblePrs.map(pr => {
        const authorName = pr.author.display_name.split(" ")[0] || "Unknown";

        // My review status
        const myParticipant = pr.participants?.find(p =>
          isBitbucketMe(p.user, config)
        );

        let myReviewIcon = "-";
        let myReviewColor = "dim";

        if (!config.BITBUCKET_USERNAME) {
          myReviewIcon = "?";
          myReviewColor = "yellow";
        } else if (myParticipant) {
          const isApproved = myParticipant.approved || myParticipant.state === "approved";
          const isChangesRequested = myParticipant.state === "changes_requested";

          if (isApproved) {
            myReviewIcon = "✓";
            myReviewColor = "green";
          } else if (isChangesRequested) {
            myReviewIcon = "✗";
            myReviewColor = "red";
          } else {
            myReviewIcon = "-";
            myReviewColor = "yellow";
          }
        }

        const approvals = pr.participants?.filter(p => p.approved || p.state === "approved").length || 0;
        const changesRequested = pr.participants?.some(p => p.state === "changes_requested");
        const m = metrics[pr.id] || { fb: 0, nr: 0 };

        return {
          id: `#${pr.id}`,
          author: authorName,
          title: pr.title,
          me: showMeColumn ? myReviewIcon : "",
          fb: m.fb,
          nr: m.nr ?? 0,
          created: formatRelativeTime(new Date(pr.created_on)),
          updated: formatRelativeTime(new Date(pr.updated_on)),
          status: changesRequested ? "✗ Req" : (approvals > 0 ? `✓ ${approvals}` : `○ ${approvals}`),
          _raw: { pr, myReviewColor, approvals, changesRequested }
        };
      })}
      columns={[
        "id", "author", "title",
        ...(showMeColumn ? ["me" as const] : []),
        "fb", "nr", "created", "updated", "status"
      ]}
      columnWidths={COL_WIDTHS}
      compact
      selectedIndex={selectedIndex - startIndex}
      header={startIndex > 0 ? (
        <Text color="dim italic">  ↑ {startIndex} more pull requests...</Text>
      ) : undefined}
      footer={startIndex + 18 < prs.length ? (
        <Text color="dim italic">  ↓ {prs.length - (startIndex + 18)} more pull requests...</Text>
      ) : undefined}
      renderCell={(col, val, row, rowIndex) => {
        const { myReviewColor, approvals, changesRequested } = row._raw;
        const isSelected = (rowIndex + startIndex) === selectedIndex;

        if (col === "id" || col === "created" || col === "updated") {
          return <Text color={isSelected ? "black" : "dim"}>{val as React.ReactNode}</Text>;
        }
        if (col === "author") {
          return <Text color={isSelected ? "black" : "yellow"}>{val as React.ReactNode}</Text>;
        }
        if (col === "me" && showMeColumn) {
          return <Text bold color={isSelected ? "black" : myReviewColor}>{val as React.ReactNode}</Text>;
        }
        if (col === "fb") {
          const n = val as number;
          return <Text color={isSelected ? "black" : (n > 0 ? "magenta" : "dim")}>{n}</Text>;
        }
        if (col === "nr") {
          const n = val as number;
          return <Text color={isSelected ? "black" : (n > 0 ? "red" : "dim")}>{n}</Text>;
        }
        if (col === "status") {
          const statusColor = isSelected
            ? "black"
            : (changesRequested ? "red" : (approvals > 0 ? "green" : "dim"));
          return <Text color={statusColor}>{val as React.ReactNode}</Text>;
        }
        return val as React.ReactNode;
      }}
    />
  );
};

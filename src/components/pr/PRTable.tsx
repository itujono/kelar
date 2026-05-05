import { Box, Text } from "ink";
import { type BitbucketPR } from "../../bitbucket";
import { getBitbucketConfig } from "../../config";
import { formatRelativeTime } from "../../utils";
import { Table } from "../Table";

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
  const config = getBitbucketConfig();
  const myUsername = config.BITBUCKET_USERNAME?.toLowerCase();
  const myHandle = myUsername?.includes("@") ? myUsername.split("@")[0] : myUsername;

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

  const WINDOW_SIZE = 18;
  const total = prs.length;
  const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(WINDOW_SIZE / 2), Math.max(0, total - WINDOW_SIZE)));
  const visiblePrs = prs.slice(startIndex, startIndex + WINDOW_SIZE);

  return (
    <Table
      data={visiblePrs.map(pr => {
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
            (myUsername && display?.includes(myUsername)) ||
            (myHandle && display?.includes(myHandle)) ||
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
        ...(showMeColumn ? ["me"] : []),
        "fb", "nr", "created", "updated", "status"
      ] as any}
      columnWidths={COL_WIDTHS}
      compact
      selectedIndex={selectedIndex - startIndex}
      header={startIndex > 0 ? (
        <Text color="dim italic">  ↑ {startIndex} more pull requests...</Text>
      ) : undefined}
      footer={startIndex + WINDOW_SIZE < total ? (
        <Text color="dim italic">  ↓ {total - (startIndex + WINDOW_SIZE)} more pull requests...</Text>
      ) : undefined}
      renderCell={(col, val, row, rowIndex) => {
        const { myReviewColor, approvals, changesRequested } = row._raw;
        const isSelected = (rowIndex + startIndex) === selectedIndex;

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
        if (col === "nr") {
          return <Text color={isSelected ? "black" : (val > 0 ? "red" : "dim")}>{val}</Text>;
        }
        if (col === "status") {
          const statusColor = isSelected 
            ? "black" 
            : (changesRequested ? "red" : (approvals > 0 ? "green" : "dim"));
          return <Text color={statusColor}>{val}</Text>;
        }
        return val;
      }}
    />
  );
};

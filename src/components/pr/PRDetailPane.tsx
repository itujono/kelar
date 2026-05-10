import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useQuery } from "@tanstack/react-query";
import { formatDuration } from "../../utils";
import {
  type BitbucketPR,
  fetchPRActivity,
  fetchPRComments,
  calculateVelocity,
  calculatePRFeedbackMetrics
} from "../../bitbucket";


interface PRDetailPaneProps {
  pr: BitbucketPR;
}

export const PRDetailPane: React.FC<PRDetailPaneProps> = ({ pr }) => {
  const { data: activity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["pr", pr.id, "activity"],
    queryFn: () => fetchPRActivity(pr.id),
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["pr", pr.id, "comments"],
    queryFn: () => fetchPRComments(pr.id),
  });

  const velocity = activity ? calculateVelocity(pr, activity) : null;
  const feedbackMetrics = calculatePRFeedbackMetrics(pr, comments || []);
  const peerComments = (comments || []).filter(c => c.user.account_id !== pr.author.account_id && c.user.uuid !== pr.author.uuid);
  const resolvedCount = peerComments.filter(c => c.is_resolved).length;

  return (
    <Box flexDirection="column" paddingX={2} width={50} minHeight={20} borderStyle="single" borderColor="cyan">
      <Text bold color="white" underline>PR #{pr.id}</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Velocity Metrics</Text>
        <Box paddingLeft={1}>
          <Text color="dim">Lead Time: </Text>
          <Text>{formatDuration(velocity?.leadTime ? Math.floor(velocity.leadTime / 1000) : null, { showDays: true, nullLabel: "N/A" })}</Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Pick-up Latency: </Text>
          <Text color={velocity?.pickupLatency && velocity.pickupLatency > 1000 * 60 * 60 * 4 ? "red" : "green"}>
            {formatDuration(velocity?.pickupLatency ? Math.floor(velocity.pickupLatency / 1000) : null, { showDays: true, nullLabel: "N/A" })}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Reviewers</Text>
        {pr.participants?.filter(p => p.role === "REVIEWER").map(reviewer => {
          const isApproved = reviewer.approved || reviewer.state === "approved";
          const isChangesRequested = reviewer.state === "changes_requested";
          const reviewerColor = isApproved ? "green" : (isChangesRequested ? "red" : "dim");
          const reviewerIcon = isApproved ? "✓" : (isChangesRequested ? "✗" : "○");

          return (
            <Box key={reviewer.user.account_id} paddingLeft={1}>
              <Text color={reviewerColor}>
                {reviewerIcon} {reviewer.user.display_name}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Peer Feedback</Text>
        <Box paddingLeft={1}>
          <Text color="dim">Resolved: </Text>
          <Text color={resolvedCount > 0 ? "green" : "dim"}>
            {resolvedCount} items
          </Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Not Replied: </Text>
          <Text color={feedbackMetrics.nr > 0 ? "red" : "dim"}>
            {feedbackMetrics.nr} items
          </Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Total Feedbacks: </Text>
          <Text color="magenta">{feedbackMetrics.fb}</Text>
        </Box>
      </Box>

      {(isLoadingActivity || isLoadingComments) && (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text italic color="dim"> Fetching updates...</Text>
        </Box>
      )}
    </Box>
  );
};

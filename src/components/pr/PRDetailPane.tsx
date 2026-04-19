import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useQuery } from "@tanstack/react-query";
import { getBitbucketConfig } from "../../config";
import {
  type BitbucketPR,
  type BitbucketUser,
  fetchPRActivity,
  fetchPRComments,
  fetchMe,
  calculateVelocity
} from "../../bitbucket";


interface PRDetailPaneProps {
  pr: BitbucketPR;
}

const formatDuration = (ms: number | null): string => {
  if (ms === null) return "N/A";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

export const PRDetailPane: React.FC<PRDetailPaneProps> = ({ pr }) => {
  const { data: activity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["pr", pr.id, "activity"],
    queryFn: () => fetchPRActivity(pr.id),
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["pr", pr.id, "comments"],
    queryFn: () => fetchPRComments(pr.id),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 1000 * 60 * 60,
  });

  const velocity = activity ? calculateVelocity(pr, activity) : null;
  const myAccountId = me?.account_id?.toLowerCase();
  const myNickname = me?.nickname?.toLowerCase();

  const isMe = (u: BitbucketUser) => {
    if (myAccountId && u.account_id?.toLowerCase() === myAccountId) return true;
    if (myNickname && u.nickname?.toLowerCase() === myNickname) return true;

    // Fallback logic
    const config = getBitbucketConfig();
    const myUsername = config.BITBUCKET_USERNAME?.toLowerCase().trim();
    const myHandle = myUsername?.includes("@") ? myUsername.split("@")[0] : myUsername;
    const nick = u.nickname?.toLowerCase().trim();
    const display = u.display_name?.toLowerCase().trim();
    const account = u.account_id?.toLowerCase().trim();

    return (
      nick === myUsername ||
      nick === myHandle ||
      display === myUsername ||
      display === myHandle ||
      (myUsername && display?.includes(myUsername)) ||
      (myHandle && display?.includes(myHandle)) ||
      account === myUsername ||
      account === myHandle
    );
  };

  const myPeerComments = comments?.filter(c => !isMe(c.user)) || [];

  const resolvedCount = myPeerComments.filter(c => c.is_resolved).length;
  const nrCount = myPeerComments.filter(peerComment => {
    if (peerComment.is_resolved) return false;
    const hasMyReply = (comments || []).some(c => {
      return isMe(c.user) && c.parent?.id === peerComment.id;
    });
    return !hasMyReply;
  }).length;

  return (
    <Box flexDirection="column" paddingX={2} width={50} minHeight={20} borderStyle="single" borderColor="cyan">
      <Text bold color="white" underline>PR #{pr.id}</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Velocity Metrics</Text>
        <Box paddingLeft={1}>
          <Text color="dim">Lead Time: </Text>
          <Text>{formatDuration(velocity?.leadTime || null)}</Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Pick-up Latency: </Text>
          <Text color={velocity?.pickupLatency && velocity.pickupLatency > 1000 * 60 * 60 * 4 ? "red" : "green"}>
            {formatDuration(velocity?.pickupLatency || null)}
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
          <Text color={nrCount > 0 ? "red" : "dim"}>
            {nrCount} items
          </Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Total Feedbacks: </Text>
          <Text color="magenta">{myPeerComments.length}</Text>
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



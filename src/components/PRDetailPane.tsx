import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useQuery } from "@tanstack/react-query";
import {
  type BitbucketPR,
  fetchPRActivity,
  fetchPRTasks,
  fetchPRStatuses,
  calculateVelocity
} from "../bitbucket";

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

  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["pr", pr.id, "tasks"],
    queryFn: () => fetchPRTasks(pr.id),
  });

  const { data: statuses, isLoading: isLoadingStatuses } = useQuery({
    queryKey: ["pr", pr.id, "statuses"],
    queryFn: () => fetchPRStatuses(pr.id),
  });

  const velocity = activity ? calculateVelocity(pr, activity) : null;
  const unresolvedTasks = tasks?.filter(t => t.state === "OPEN").length || 0;

  // Pipeline status (take the latest one)
  const latestStatus = statuses?.[0];

  return (
    <Box flexDirection="column" paddingX={2} width={50} borderStyle="single" borderColor="cyan">
      <Text bold color="white" underline>详细信息 (PR #{pr.id})</Text>

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
        {pr.participants.filter(p => p.role === "REVIEWER").map(reviewer => (
          <Box key={reviewer.user.account_id} paddingLeft={1}>
            <Text color={reviewer.approved ? "green" : "dim"}>
              {reviewer.approved ? "✓" : "○"} {reviewer.user.display_name}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">Tasks & Pipelines</Text>
        <Box paddingLeft={1}>
          <Text color="dim">Tasks: </Text>
          <Text color={unresolvedTasks > 0 ? "yellow" : "green"}>
            {unresolvedTasks} unresolved / {tasks?.length || 0} total
          </Text>
        </Box>
        <Box paddingLeft={1}>
          <Text color="dim">Build: </Text>
          {isLoadingStatuses ? (
            <Spinner type="dots" />
          ) : latestStatus ? (
            <Text color={latestStatus.state === "SUCCESSFUL" ? "green" : latestStatus.state === "FAILED" ? "red" : "yellow"}>
              {latestStatus.state}
            </Text>
          ) : (
            <Text color="dim">No builds</Text>
          )}
        </Box>
      </Box>

      {(isLoadingActivity || isLoadingTasks) && (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text italic color="dim"> Fetching updates...</Text>
        </Box>
      )}
    </Box>
  );
};

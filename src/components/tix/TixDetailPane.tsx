import { Box, Text } from "ink";
import { isZombieTicket } from "../../utils";
import { type JiraIssue } from "../../jira";
import { formatDistanceToNow } from "date-fns";

interface TixDetailPaneProps {
  ticket: JiraIssue;
  contextScore: number | null;
}

export const TixDetailPane: React.FC<TixDetailPaneProps> = ({ ticket, contextScore }) => {
  // Zombie detection
  const isZombie = isZombieTicket(ticket);

  // Blockers
  const blockers = ticket.fields.issuelinks.filter(link =>
    link.inwardIssue && (link.type.inward.toLowerCase().includes("blocked by") || link.type.name.toLowerCase().includes("block"))
  );

  return (
    <Box
      flexDirection="column"
      width={40}
      borderStyle="round"
      borderColor="dim"
      paddingX={1}
    >
      <Text bold underline color="cyan">OBSERVABILITY</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Zombie Status:</Text>
        {isZombie ? (
          <Box flexDirection="column" marginTop={0}>
            <Text color="red">🚨 ZOMBIE DETECTED</Text>
            <Text color="dim" italic>No activity for {'>'} 48h</Text>
          </Box>
        ) : (
          <Text color="green">🟢 Healthy</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Dependency Tree:</Text>
        {blockers.length === 0 ? (
          <Text color="dim">No blockers</Text>
        ) : (
          blockers.map((link, i) => {
            const issue = link.inwardIssue;
            if (!issue) return null;
            const isLast = i === blockers.length - 1;
            return (
              <Box key={issue.id}>
                <Text color="dim">{isLast ? "└── " : "├── "}</Text>
                <Text color="yellow">{issue.key} </Text>
                <Text color="dim">({issue.fields.status.name})</Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Context Score:</Text>
        <Box>
          <Text color="cyan">{contextScore ?? "?"}</Text>
          <Text color="dim"> tickets updated today</Text>
        </Box>
      </Box>

      <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="dim" flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="white">DETAILS</Text>
        </Box>
        <Box>
          <Box width={12}><Text color="dim">Project:</Text></Box>
          <Text>{ticket.fields.project.name}</Text>
        </Box>
        <Box>
          <Box width={12}><Text color="dim">Status:</Text></Box>
          <Text>{ticket.fields.status.name}</Text>
        </Box>
        <Box>
          <Box width={12}><Text color="dim">Priority:</Text></Box>
          <Text color={
            ticket.fields.priority?.name === "Highest" || ticket.fields.priority?.name === "High" ? "red" : "white"
          }>{ticket.fields.priority?.name || "None"}</Text>
        </Box>
        <Box>
          <Box width={12}><Text color="dim">Assignee:</Text></Box>
          <Text color="yellow">{ticket.fields.assignee?.displayName || "Unassigned"}</Text>
        </Box>
        <Box marginTop={1}>
          <Box width={12}><Text color="dim">Updated:</Text></Box>
          <Text>{formatDistanceToNow(new Date(ticket.fields.updated), { addSuffix: true }).replace("about ", "~ ")}</Text>
        </Box>
        <Box>
          <Box width={12}><Text color="dim">Created:</Text></Box>
          <Text>{formatDistanceToNow(new Date(ticket.fields.created), { addSuffix: true }).replace("about ", "~ ")}</Text>
        </Box>
      </Box>
    </Box>
  );
};

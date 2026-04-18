import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { TixTable } from "../components/tix/TixTable";
import { TixDetailPane } from "../components/tix/TixDetailPane";
import { formatMinutes } from "../utils";
import { TixControls } from "../components/tix/TixControls";
import { TixModal } from "../components/tix/TixModal";
import { TixProvider, useTixContext } from "../contexts/TixContext";

interface TixViewProps {
  isPeerMode?: boolean;
}

export function TixView({ isPeerMode = false }: TixViewProps) {
  return (
    <TixProvider isPeerMode={isPeerMode}>
      <TixViewContent />
    </TixProvider>
  );
}

function TixViewContent() {
  const { handleUserSearchChange, ...data } = useTixContext();

  if (data.isUserSelecting) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Select Team Member</Text>
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
          <Text color="dim">Search: </Text>
          <TextInput value={data.userSearchQuery} onChange={handleUserSearchChange} placeholder="Type name..." />
        </Box>
        {data.isLoadingUsers && !data.filteredUsers.length ? (
          <Box marginTop={1}><Spinner type="dots" /><Text italic> Initializing user list...</Text></Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {data.filteredUsers.length === 0 ? (
              <Text color="dim"> No matches found.</Text>
            ) : (
              data.filteredUsers.map((u, i) => (
                <Box key={u.accountId} backgroundColor={i === data.selectedIndex ? "white" : undefined} paddingX={1}>
                  <Text color={i === data.selectedIndex ? "black" : undefined}>{u.displayName}</Text>
                  {u.emailAddress && <Text color="dim"> - {u.emailAddress}</Text>}
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (data.isLoadingTickets) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text italic> Fetching tickets for {data.accountId}...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Jira Yuuuk</Text>
        <Text color="dim"> | Sort: </Text>
        <Text color="yellow">{data.sortOptions.find(o => o.value === data.sortType)?.label || data.sortType}</Text>
        {data.selectedUserName && (
          <>
            <Text color="dim"> | User: </Text>
            <Text color="magenta" bold>{data.selectedUserName}</Text>
          </>
        )}
        <Text color="dim"> | Daily Context: </Text>
        <Text color="cyan" bold>{data.contextScore ?? "?"}</Text>
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <TixTable tickets={data.sortedTickets} selectedIndex={data.selectedIndex} />
        </Box>
        {data.activeTicket && (
          <TixDetailPane ticket={data.activeTicket} />
        )}
      </Box>

      <TixControls />

      {data.accountId && (
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1} flexDirection="column">
          <Box>
            <Text bold>Monthly Worklogs: </Text>
            <Text color="yellow">{formatMinutes(data.totalMinutesAll)}</Text>
            <Text color="dim"> ({data.totalMinutesAll}m) | </Text>
            <Text color="magenta" bold>{((data.totalMinutesAll / (data.targetHours * 60)) * 100).toFixed(1)}%</Text>
            <Text color="dim"> of {data.targetHours}h goal | </Text>
            <Text color="yellow" bold>{data.daysRemaining}</Text>
            <Text color="dim"> days left</Text>
            {data.monthlyLogs === undefined && (
              <Box marginLeft={2}>
                <Spinner type="dots" />
                <Text color="dim" italic> Calculating totals...</Text>
              </Box>
            )}
          </Box>
          <Box marginTop={1}>
            <Text color="magenta">
              {"█".repeat(Math.min(30, Math.floor((data.totalMinutesAll / (data.targetHours * 60)) * 30)))}
              <Text color="dim">
                {"░".repeat(Math.max(0, 30 - Math.floor((data.totalMinutesAll / (data.targetHours * 60)) * 30)))}
              </Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Modals */}
      <TixModal />
    </Box>
  );
}

import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { TixTable } from "../components/tix/TixTable";
import { TixDetailPane } from "../components/tix/TixDetailPane";
import { formatMinutes } from "../utils";
import { TixControls } from "../components/tix/TixControls";
import { TixModal } from "../components/tix/TixModal";
import { TixProvider, useTixContext } from "../contexts/TixContext";
import { UserSelection } from "../components/tix/UserSelection";

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
      <UserSelection
        userSearchQuery={data.userSearchQuery}
        onUserSearchChange={handleUserSearchChange}
        isLoadingUsers={data.isLoadingUsers}
        filteredUsers={data.filteredUsers}
        selectedIndex={data.selectedIndex}
      />
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
        <Text color="cyan" bold>{data.contextScore ?? "-"}</Text>
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

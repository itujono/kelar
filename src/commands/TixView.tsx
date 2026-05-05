import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { TixTable } from "../components/tix/TixTable";
import { TixDetailPane } from "../components/tix/TixDetailPane";
import { formatMinutes } from "../utils";
import { TixControls } from "../components/tix/TixControls";
import { TixModal } from "../components/tix/TixModal";
import { UserSelection } from "../components/tix/UserSelection";
import { useTixView } from "../hooks/useTixView";

interface TixViewProps {
  isPeerMode?: boolean;
}

export function TixView({ isPeerMode = false }: TixViewProps) {
  const tix = useTixView(isPeerMode);

  if (tix.isUserSelecting) {
    return (
      <UserSelection
        userSearchQuery={tix.userSearchQuery}
        onUserSearchChange={tix.handleUserSearchChange}
        isLoadingUsers={tix.isLoadingUsers}
        filteredUsers={tix.filteredUsers}
        selectedIndex={tix.selectedIndex}
      />
    );
  }

  if (tix.isLoadingTickets) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text italic> Fetching tickets for {tix.accountId}...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Jira Yuuuk</Text>
        <Text color="dim"> | Sort: </Text>
        <Text color="yellow">{tix.sortOptions.find(o => o.value === tix.sortType)?.label || tix.sortType}</Text>
        {tix.selectedUserName && (
          <>
            <Text color="dim"> | User: </Text>
            <Text color="magenta" bold>{tix.selectedUserName}</Text>
          </>
        )}
        <Text color="dim"> | Daily Context: </Text>
        <Text color="cyan" bold>{tix.contextScore ?? "-"}</Text>
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <TixTable tickets={tix.sortedTickets} selectedIndex={tix.selectedIndex} />
        </Box>
        {tix.activeTicket && (
          <TixDetailPane ticket={tix.activeTicket} />
        )}
      </Box>

      <TixControls
        isSorting={tix.isSorting}
        sortOptions={tix.sortOptions}
        sortIndex={tix.sortIndex}
        sortType={tix.sortType}
        isFiltering={tix.isFiltering}
        filterQuery={tix.filterQuery}
        setFilterQuery={tix.setFilterQuery}
        setIsFiltering={tix.setIsFiltering}
        sortedTickets={tix.sortedTickets}
      />

      {tix.accountId && (
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1} flexDirection="column">
          <Box>
            <Text bold>Monthly Worklogs: </Text>
            <Text color="yellow">{formatMinutes(tix.totalMinutesAll)}</Text>
            <Text color="dim"> ({tix.totalMinutesAll}m) | </Text>
            <Text color="magenta" bold>{((tix.totalMinutesAll / (tix.targetHours * 60)) * 100).toFixed(1)}%</Text>
            <Text color="dim"> of {tix.targetHours}h goal | </Text>
            <Text color="yellow" bold>{tix.daysRemaining}</Text>
            <Text color="dim"> days left</Text>
            {tix.monthlyLogs === undefined && (
              <Box marginLeft={2}>
                <Spinner type="dots" />
                <Text color="dim" italic> Calculating totals...</Text>
              </Box>
            )}
          </Box>
          <Box marginTop={1}>
            <Text color="magenta">
              {"█".repeat(Math.min(30, Math.floor((tix.totalMinutesAll / (tix.targetHours * 60)) * 30)))}
              <Text color="dim">
                {"░".repeat(Math.max(0, 30 - Math.floor((tix.totalMinutesAll / (tix.targetHours * 60)) * 30)))}
              </Text>
            </Text>
          </Box>
        </Box>
      )}

      <TixModal
        activeModal={tix.activeModal}
        activeTicket={tix.activeTicket ?? null}
        logTime={tix.logTime}
        logComment={tix.logComment}
        logFocus={tix.logFocus}
        setLogTime={tix.setLogTime}
        setLogComment={tix.setLogComment}
        setLogFocus={tix.setLogFocus}
        handleLogSubmit={tix.handleLogSubmit}
        logMutation={tix.logMutation}
        isLoadingTransitions={tix.isLoadingTransitions}
        isConfirmingMove={tix.isConfirmingMove}
        transitions={tix.transitions}
        transitionIndex={tix.transitionIndex}
        estimateValue={tix.estimateValue}
        setEstimateValue={tix.setEstimateValue}
        handleEstimateSubmit={tix.handleEstimateSubmit}
      />
    </Box>
  );
}

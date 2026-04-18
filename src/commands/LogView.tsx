import { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { format } from "date-fns";
import { generateHtmlReport } from "../report";
import { LogTable } from "../components/log/LogTable";
import { LogControls } from "../components/log/LogControls";
import { useLogView, type PeriodType, type SortType } from "../hooks/useLogView";

export { type PeriodType, type SortType };

interface LogViewProps {
  period?: PeriodType;
  sortBy?: SortType;
  isCaptureMode?: boolean;
}

export function LogView({ period = "day", sortBy = "newest", isCaptureMode = false }: LogViewProps) {
  const { exit } = useApp();
  const [capturedFile, setCapturedFile] = useState<string | null>(null);

  const { setIsFiltering, handleFilterChange, sync, ...data } = useLogView(period, sortBy);

  useEffect(() => {
    if (isCaptureMode && data.status === "SUCCESS") {
      const html = generateHtmlReport(
        data.sortedLogs,
        data.currentPeriod,
        data.targetHours,
        data.calculationDay,
        data.daysRemaining,
        data.totalMinutesAll,
        data.personalCount
      );

      const filename = `kelar-report-${data.currentPeriod}-${format(new Date(), "dd-MM-yyyy")}.html`;
      // @ts-ignore - Bun global
      Bun.write(filename, html).then(() => {
        setCapturedFile(filename);
        setTimeout(() => exit(), 1500);
      });
    } else if (isCaptureMode && data.status === "ERROR") {
      exit();
    }
  }, [data.status, isCaptureMode, exit, data.sortedLogs, data.currentPeriod, data.targetHours, data.calculationDay, data.daysRemaining, data.totalMinutesAll, data.personalCount]);

  if (data.status === "ERROR") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error syncing logs:</Text>
        <Text>{data.error}</Text>
      </Box>
    );
  }

  if (isCaptureMode) {
    return (
      <Box padding={1} flexDirection="column">
        {data.status === "SYNCING" ? (
          <Box>
            <Spinner type="dots" />
            <Text italic> Generating work log snapshot...</Text>
          </Box>
        ) : capturedFile ? (
          <Box flexDirection="column">
            <Text color="green" bold>✅ Snapshot generated successfully!</Text>
            <Text color="dim">Saved to: <Text color="cyan">{capturedFile}</Text></Text>
          </Box>
        ) : (
          <Text italic color="dim">Preparing report data...</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="row">
        {data.status === "SYNCING" ? (
          <Box>
            <Spinner type="dots" />
            <Text italic> Syncing with Jira...</Text>
          </Box>
        ) : (
          <>
            <Text bold color="cyan">Work Log Summary ({data.currentPeriod.toUpperCase()})</Text>
            <Text color="dim"> | Sort: </Text>
            <Text color="yellow">{data.sortOptions.find(o => o.value === data.sortType)?.label || data.sortType}</Text>
            <Text color="dim"> | User: </Text>
            <Text color="magenta" bold>Me</Text>
          </>
        )}
      </Box>

      <LogTable
        logs={data.sortedLogs}
        selectedIndex={data.selectedIndex}
        period={data.currentPeriod}
        targetHours={data.targetHours}
        daysRemaining={data.daysRemaining}
        totalMinutes={data.totalMinutesAll}
        personalCount={data.personalCount}
        isLoading={data.status === "SYNCING"}
      />

      <LogControls
        isSorting={data.isSorting}
        sortOptions={data.sortOptions}
        sortIndex={data.sortIndex}
        sortType={data.sortType}
        isSelectingPeriod={data.isSelectingPeriod}
        periodOptions={data.periodOptions}
        periodIndex={data.periodIndex}
        currentPeriod={data.currentPeriod}
        isFiltering={data.isFiltering}
        filterQuery={data.filterQuery}
        onFilterChange={handleFilterChange}
        onFilterSubmit={() => setIsFiltering(false)}
        filteredLogsCount={data.filteredLogs.length}
        showControls={data.status !== "SYNCING"}
      />
    </Box>
  );
};

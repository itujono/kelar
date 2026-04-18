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
  isGenerateMode?: boolean;
}

export function LogView({ period = "day", sortBy = "newest", isGenerateMode = false }: LogViewProps) {
  const { exit } = useApp();
  const [generatedFile, setGeneratedFile] = useState<string | null>(null);

  const {
    setIsFiltering,
    handleFilterChange,
    sync,
    setIsGenerating,
    ...data
  } = useLogView(period, sortBy);

  useEffect(() => {
    if ((isGenerateMode || data.isGenerating) && data.status === "SUCCESS") {
      const html = generateHtmlReport(
        data.sortedLogs,
        data.currentPeriod,
        data.targetHours,
        data.calculationDay,
        data.daysRemaining,
        data.totalMinutesAll,
        data.personalCount
      );

      const filename = `kelar-report-${data.currentPeriod}-${format(new Date(), "dd-MM-yyyy-HHmm")}.html`;
      Bun.write(filename, html).then(() => {
        setGeneratedFile(filename);
        if (isGenerateMode) {
          setTimeout(() => exit(), 1500);
        } else {
          setIsGenerating(false);
        }
      });
    } else if (isGenerateMode && data.status === "ERROR") {
      exit();
    }
  }, [data.status, isGenerateMode, data.isGenerating, exit, data.sortedLogs, data.currentPeriod, data.targetHours, data.calculationDay, data.daysRemaining, data.totalMinutesAll, data.personalCount, setIsGenerating]);

  if (data.status === "ERROR") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error syncing logs:</Text>
        <Text>{data.error}</Text>
      </Box>
    );
  }

  if (isGenerateMode) {
    return (
      <Box padding={1} flexDirection="column">
        {data.status === "SYNCING" ? (
          <Box>
            <Spinner type="dots" />
            <Text italic> Generating report...</Text>
          </Box>
        ) : generatedFile ? (
          <Box flexDirection="column">
            <Text color="green" bold>✅ Report generated successfully!</Text>
            <Text color="dim">Saved to: <Text color="cyan">{generatedFile}</Text></Text>
          </Box>
        ) : (
          <Text italic color="dim">Preparing report data...</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {generatedFile && !isGenerateMode && (
        <Box borderStyle="single" borderColor="green" paddingX={1} marginBottom={1}>
          <Text color="green">✅ Report generated: </Text>
          <Text color="cyan">{generatedFile}</Text>
        </Box>
      )}
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

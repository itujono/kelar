import { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Spinner from "ink-spinner";
import { format, startOfMonth, differenceInCalendarDays, setDate, addMonths } from "date-fns";
import { TixTable } from "../components/tix/TixTable";
import { TixDetailPane } from "../components/tix/TixDetailPane";
import {
  searchIssues,
  fetchUsers,
  fetchTransitions,
  transitionIssue,
  postWorklog,
  updateIssueEstimate,
  fetchActivityCountToday,
  fetchUserWorklogs,
  clearTixCache
} from "../jira";
import { getAppConfig, DEFAULT_CALCULATION_DAY, DEFAULT_MONTHLY_TARGET_HOURS } from "../config";
import { parseJiraTime, getNowWithOffset, formatMinutes, extractAdfText } from "../utils";
import { TixControls } from "../components/tix/TixControls";
import { TixModal } from "../components/tix/TixModal";

interface TixViewProps {
  isPeerMode?: boolean;
}


export function TixView({ isPeerMode = false }: TixViewProps) {
  const { exit } = useApp();
  const config = getAppConfig();
  const [accountId, setAccountId] = useState<string | null>(isPeerMode ? null : config.JIRA_ACCOUNT_ID);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(isPeerMode ? null : "Me");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserSelecting, setIsUserSelecting] = useState(isPeerMode && !accountId);

  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<"newest" | "oldest" | "priority" | "updated">("newest");
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions = [
    { label: "Newest Created", value: "newest" as const },
    { label: "Oldest Created", value: "oldest" as const },
    { label: "Newest Updated", value: "updated" as const },
    { label: "High Priority", value: "priority" as const },
  ];

  // Modals state
  const [activeModal, setActiveModal] = useState<"log" | "move" | "estimate" | "view" | null>(null);
  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [logFocus, setLogFocus] = useState<"time" | "comment">("time");
  const [estimateValue, setEstimateValue] = useState("");
  const [transitionIndex, setTransitionIndex] = useState(0);
  const [isConfirmingMove, setIsConfirmingMove] = useState(false);

  // Queries
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", userSearchQuery],
    queryFn: () => fetchUsers(userSearchQuery),
    enabled: isUserSelecting
  });

  const jqlDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const { data: tickets, isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", accountId],
    queryFn: () => searchIssues(`assignee = ${accountId} AND updated >= "${jqlDate}"`),
    enabled: !!accountId && !isUserSelecting
  });

  const { data: contextScore } = useQuery({
    queryKey: ["contextScore"],
    queryFn: () => fetchActivityCountToday(),
    enabled: !!accountId && !isUserSelecting
  });

  const targetHours = parseInt(config.MONTHLY_TARGET_HOURS, 10) || DEFAULT_MONTHLY_TARGET_HOURS;
  const calculationDay = parseInt(config.LAST_CALCULATION_DAY, 10) || DEFAULT_CALCULATION_DAY;

  const { data: monthlyLogs } = useQuery({
    queryKey: ["monthlyLogs", accountId],
    queryFn: () => fetchUserWorklogs(accountId!, startOfMonth(new Date()).toISOString()),
    enabled: !!accountId && !isUserSelecting
  });

  const totalMinutesAll = monthlyLogs?.reduce((sum, log) => sum + Math.round(log.timeSpentSeconds / 60), 0) || 0;

  const getDaysRemaining = () => {
    const now = new Date();
    let targetDate = setDate(now, calculationDay);
    if (now.getDate() > calculationDay) {
      targetDate = addMonths(targetDate, 1);
    }
    return differenceInCalendarDays(targetDate, now);
  };
  const daysRemaining = getDaysRemaining();

  const activeTicket = tickets?.[selectedIndex];

  const { data: transitions, isLoading: isLoadingTransitions } = useQuery({
    queryKey: ["transitions", activeTicket?.key],
    queryFn: () => fetchTransitions(activeTicket!.key),
    enabled: activeModal === "move" && !!activeTicket
  });

  // Mutations
  const queryCache = useQueryClient();
  const logMutation = useMutation({
    mutationFn: (data: { key: string, minutes: number, comment: string }) =>
      postWorklog(data.key, data.minutes, data.comment, getNowWithOffset()),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
      setLogTime("");
      setLogComment("");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data: { key: string, id: string }) => transitionIssue(data.key, data.id),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
    }
  });

  const estimateMutation = useMutation({
    mutationFn: (data: { key: string, seconds: number }) => updateIssueEstimate(data.key, data.seconds),
    onSuccess: () => {
      queryCache.invalidateQueries({ queryKey: ["tickets"] });
      setActiveModal(null);
    }
  });

  const handleLogSubmit = () => {
    if (!activeTicket || !logTime) return;
    const mins = parseJiraTime(logTime);
    if (mins > 0) {
      logMutation.mutate({ key: activeTicket.key, minutes: mins, comment: logComment || "" });
    }
  };

  const handleEstimateSubmit = () => {
    if (!activeTicket || !estimateValue) return;
    const mins = parseJiraTime(estimateValue);
    if (mins > 0) {
      estimateMutation.mutate({ key: activeTicket.key, seconds: mins * 60 });
    }
  };

  const filteredTickets = (tickets || []).filter(t => {
    if (!filterQuery) return true;
    const s = filterQuery.toLowerCase();
    return t.key.toLowerCase().includes(s) || t.fields.summary.toLowerCase().includes(s);
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortType === "newest") return new Date(b.fields.created).getTime() - new Date(a.fields.created).getTime();
    if (sortType === "oldest") return new Date(a.fields.created).getTime() - new Date(b.fields.created).getTime();
    if (sortType === "updated") return new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime();
    if (sortType === "priority") {
      const prioMap: Record<string, number> = { "Highest": 0, "High": 1, "Medium": 2, "Low": 3, "Lowest": 4 };
      const valA = prioMap[a.fields.priority?.name || "Medium"] ?? 2;
      const valB = prioMap[b.fields.priority?.name || "Medium"] ?? 2;
      return valA - valB;
    }
    return 0;
  });

  const filteredUsers = (users || []).filter(u => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || (u.emailAddress?.toLowerCase().includes(q));
  });

  useInput((input, key) => {
    if (activeModal) {
      if (key.escape) setActiveModal(null);

      if (activeModal === "log") {
        if (key.tab) {
          setLogFocus(f => f === "time" ? "comment" : "time");
          return;
        }
      }

      if (activeModal === "move" && transitions) {
        if (isConfirmingMove) {
          if (key.return) {
            const t = transitions[transitionIndex];
            if (t && activeTicket) {
              transitionMutation.mutate({ key: activeTicket.key, id: t.id });
            }
            setIsConfirmingMove(false);
          }
          if (key.escape || key.backspace) {
            setIsConfirmingMove(false);
          }
          return;
        }

        if (key.upArrow) setTransitionIndex(p => Math.max(0, p - 1));
        if (key.downArrow) setTransitionIndex(p => Math.min(transitions.length - 1, p + 1));
        if (key.return) {
          setIsConfirmingMove(true);
        }
      }
      return;
    }

    if (isSorting) {
      if (key.escape) setIsSorting(false);
      if (key.upArrow) setSortIndex(prev => Math.max(0, prev - 1));
      if (key.downArrow) setSortIndex(prev => Math.min(sortOptions.length - 1, prev + 1));
      if (key.return) {
        const option = sortOptions[sortIndex];
        if (option) {
          setSortType(option.value);
        }
        setIsSorting(false);
      }
      return;
    }

    if (isUserSelecting) {
      if (key.escape && !isPeerMode) setIsUserSelecting(false);
      if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
      if (key.downArrow) setSelectedIndex(p => Math.min(filteredUsers.length - 1, p + 1));
      if (key.return) {
        const user = filteredUsers[selectedIndex];
        if (user) {
          setAccountId(user.accountId);
          setSelectedUserName(user.displayName);
          setIsUserSelecting(false);
          setSelectedIndex(0);
        }
      }
      return;
    }

    if (isFiltering) {
      if (key.escape) {
        setIsFiltering(false);
        setFilterQuery("");
      }
      if (key.return) setIsFiltering(false);
      return;
    }

    if (input === "q") exit();
    if (input === "/") { setIsFiltering(true); setFilterQuery(""); }
    if (input === "s") { setIsSorting(true); setSortIndex(0); }
    if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
    if (key.downArrow) setSelectedIndex(p => Math.min(sortedTickets.length - 1, p + 1));

    if (activeTicket) {
      if (input === "l") setActiveModal("log");
      if (input === "m") { setActiveModal("move"); setTransitionIndex(0); }
      if (input === "e") setActiveModal("estimate");
      if (input === "v") setActiveModal("view");
      if (input === "c") {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeTicket.key}`;
        // @ts-ignore
        Bun.spawn(["pbcopy"], { stdin: Buffer.from(url) });
      }
      if (input === "o") {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeTicket.key}`;
        // @ts-ignore
        Bun.spawn(["open", url]);
      }
    }

    if (input === "r") {
      clearTixCache();
      refetchTickets();
    }
  });

  const handleUserSearchChange = (val: string) => {
    setUserSearchQuery(val);
    setSelectedIndex(0);
  };

  if (isUserSelecting) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Select Team Member</Text>
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
          <Text color="dim">Search: </Text>
          <TextInput value={userSearchQuery} onChange={handleUserSearchChange} placeholder="Type name..." />
        </Box>
        {isLoadingUsers && users === undefined ? (
          <Box marginTop={1}><Spinner type="dots" /><Text italic> Initializing user list...</Text></Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {filteredUsers.length === 0 ? (
              <Text color="dim"> No matches found.</Text>
            ) : (
              filteredUsers.map((u, i) => (
                <Box key={u.accountId} backgroundColor={i === selectedIndex ? "white" : undefined} paddingX={1}>
                  <Text color={i === selectedIndex ? "black" : undefined}>{u.displayName}</Text>
                  {u.emailAddress && <Text color="dim"> - {u.emailAddress}</Text>}
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (isLoadingTickets) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text italic> Fetching tickets for {accountId}...</Text>
      </Box>
    );
  }


  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Jira Yuuuk</Text>
        <Text color="dim"> | Sort: </Text>
        <Text color="yellow">{sortOptions.find(o => o.value === sortType)?.label || sortType}</Text>
        {selectedUserName && (
          <>
            <Text color="dim"> | User: </Text>
            <Text color="magenta" bold>{selectedUserName}</Text>
          </>
        )}
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <TixTable tickets={sortedTickets} selectedIndex={selectedIndex} />
        </Box>
        {activeTicket && (
          <TixDetailPane ticket={activeTicket} contextScore={contextScore || 0} />
        )}
      </Box>

      <TixControls
        isSorting={isSorting}
        sortOptions={sortOptions}
        sortIndex={sortIndex}
        sortType={sortType}
        isFiltering={isFiltering}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        onFilterSubmit={() => setIsFiltering(false)}
        filteredTicketsCount={sortedTickets.length}
      />

      {accountId && (
        <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1} flexDirection="column">
          <Box>
            <Text bold>Monthly Worklogs: </Text>
            <Text color="yellow">{formatMinutes(totalMinutesAll)}</Text>
            <Text color="dim"> ({totalMinutesAll}m) | </Text>
            <Text color="magenta" bold>{((totalMinutesAll / (targetHours * 60)) * 100).toFixed(1)}%</Text>
            <Text color="dim"> of {targetHours}h goal | </Text>
            <Text color="yellow" bold>{daysRemaining}</Text>
            <Text color="dim"> days left</Text>
            {monthlyLogs === undefined && (
              <Box marginLeft={2}>
                <Spinner type="dots" />
                <Text color="dim" italic> Calculating totals...</Text>
              </Box>
            )}
          </Box>
          <Box marginTop={1}>
            <Text color="magenta">
              {"█".repeat(Math.min(30, Math.floor((totalMinutesAll / (targetHours * 60)) * 30)))}
              <Text color="dim">
                {"░".repeat(Math.max(0, 30 - Math.floor((totalMinutesAll / (targetHours * 60)) * 30)))}
              </Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Modals */}
      <TixModal
        activeModal={activeModal}
        activeTicket={activeTicket}
        logTime={logTime}
        setLogTime={setLogTime}
        logComment={logComment}
        setLogComment={setLogComment}
        logFocus={logFocus}
        setLogFocus={setLogFocus}
        onLogSubmit={handleLogSubmit}
        isLogPending={logMutation.isPending}
        isLoadingTransitions={isLoadingTransitions}
        isConfirmingMove={isConfirmingMove}
        transitions={transitions}
        transitionIndex={transitionIndex}
        estimateValue={estimateValue}
        setEstimateValue={setEstimateValue}
        onEstimateSubmit={handleEstimateSubmit}
      />
    </Box>
  );
};


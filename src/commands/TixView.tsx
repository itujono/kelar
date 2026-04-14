import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { QueryClientProvider, useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import Spinner from "ink-spinner";
import { TixTable } from "../components/TixTable";
import { TixDetailPane } from "../components/TixDetailPane";
import {
  searchIssues,
  fetchUsers,
  fetchTransitions,
  transitionIssue,
  postWorklog,
  updateIssueEstimate,
  fetchActivityCountToday
} from "../jira";
import { getAppConfig } from "../config";
import { parseJiraTime, getNowWithOffset } from "../utils";

interface TixViewProps {
  showAll?: boolean;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const TixViewContent: React.FC<TixViewProps> = ({ showAll = false }) => {
  const { exit } = useApp();
  const config = getAppConfig();
  const [accountId, setAccountId] = useState<string | null>(showAll ? null : config.JIRA_ACCOUNT_ID);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserSelecting, setIsUserSelecting] = useState(showAll && !accountId);

  const [isSorting, setIsSorting] = useState(false);
  const [sortType, setSortType] = useState<"newest" | "oldest" | "priority">("newest");
  const [sortIndex, setSortIndex] = useState(0);

  const sortOptions = [
    { label: "Newest Created", value: "newest" as const },
    { label: "Oldest Created", value: "oldest" as const },
    { label: "High Priority", value: "priority" as const },
  ];

  // Modals state
  const [activeModal, setActiveModal] = useState<"log" | "move" | "estimate" | "view" | null>(null);
  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [estimateValue, setEstimateValue] = useState("");
  const [transitionIndex, setTransitionIndex] = useState(0);

  // Queries
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", userSearchQuery],
    queryFn: () => fetchUsers(userSearchQuery),
    enabled: isUserSelecting
  });

  const { data: tickets, isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", accountId],
    queryFn: () => searchIssues(`assignee = ${accountId} AND statusCategory != Done`),
    enabled: !!accountId && !isUserSelecting
  });

  const { data: contextScore } = useQuery({
    queryKey: ["contextScore"],
    queryFn: () => fetchActivityCountToday(),
    enabled: !!accountId && !isUserSelecting
  });

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
      logMutation.mutate({ key: activeTicket.key, minutes: mins, comment: logComment || "Logged via Kelar" });
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

      if (activeModal === "move" && transitions) {
        if (key.upArrow) setTransitionIndex(p => Math.max(0, p - 1));
        if (key.downArrow) setTransitionIndex(p => Math.min(transitions.length - 1, p + 1));
        if (key.return) {
          const t = transitions[transitionIndex];
          if (t && activeTicket) {
            transitionMutation.mutate({ key: activeTicket.key, id: t.id });
          }
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
      if (key.escape && !showAll) setIsUserSelecting(false);
      if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
      if (key.downArrow) setSelectedIndex(p => Math.min(filteredUsers.length - 1, p + 1));
      if (key.return) {
        const user = filteredUsers[selectedIndex];
        if (user) {
          setAccountId(user.accountId);
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
    }

    if (input === "r") refetchTickets();
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
        <Text bold color="cyan">Jira Engineering Intelligence</Text>
        <Text color="dim"> | User: </Text>
        <Text color="yellow">{accountId}</Text>
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexGrow={1} marginRight={2}>
          <TixTable tickets={sortedTickets} selectedIndex={selectedIndex} />
        </Box>
        {activeTicket && (
          <TixDetailPane ticket={activeTicket} contextScore={contextScore || 0} />
        )}
      </Box>

      {/* Footer / Info */}
      <Box marginTop={1} flexDirection="column">
        {isSorting ? (
          <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
            <Box backgroundColor="cyan" paddingX={1} marginRight={1} marginBottom={1} width={12}>
              <Text bold color="black"> SORT BY </Text>
            </Box>
            {sortOptions.map((opt, i) => (
              <Box key={opt.value}>
                <Text color={i === sortIndex ? "cyan" : "dim"}>
                  {i === sortIndex ? "❯" : " "} {opt.label}
                  {sortType === opt.value ? " (active)" : ""}
                </Text>
              </Box>
            ))}
            <Box marginTop={1}>
              <Text bold color="cyan">Enter</Text>
              <Text color="dim"> to apply | </Text>
              <Text bold color="cyan">Esc</Text>
              <Text color="dim"> to close</Text>
            </Box>
          </Box>
        ) : isFiltering ? (
          <Box borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1} flexDirection="column">
            <Box>
              <Box backgroundColor="yellow" paddingX={1} marginRight={1}>
                <Text bold color="black"> FILTER </Text>
              </Box>
              <TextInput value={filterQuery} onChange={setFilterQuery} />
            </Box>
            <Box marginTop={1}>
              <Text color="yellow"> {sortedTickets.length} matches | </Text>
              <Text bold color="cyan">Enter</Text>
              <Text color="dim"> to keep | </Text>
              <Text bold color="cyan">Esc</Text>
              <Text color="dim"> to reset</Text>
            </Box>
          </Box>
        ) : (
          <Box>
            <Text color="dim">Keys: </Text>
            <Text bold color="white">↑/↓</Text><Text color="dim"> navigate | </Text>
            <Text bold color="white">l</Text><Text color="dim"> log | </Text>
            <Text bold color="white">m</Text><Text color="dim"> move | </Text>
            <Text bold color="white">e</Text><Text color="dim"> estimate | </Text>
            <Text bold color="white">v</Text><Text color="dim"> view | </Text>
            <Text bold color="white">c</Text><Text color="dim"> copy link | </Text>
            <Text bold color="white">s</Text><Text color="dim"> sort | </Text>
            <Text bold color="white">/</Text><Text color="dim"> filter | </Text>
            <Text bold color="white">r</Text><Text color="dim"> refetch | </Text>
            <Text bold color="white">q</Text><Text color="dim"> quit</Text>
          </Box>
        )}
      </Box>

      {/* Modals */}
      {activeModal === "log" && (
        <Box borderStyle="double" borderColor="magenta" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20}>
          <Text bold color="magenta">Log Work for {activeTicket?.key}</Text>
          <Box marginTop={1}>
            <Text>Time (e.g. 1h 30m): </Text>
            <TextInput value={logTime} onChange={setLogTime} focus={true} />
          </Box>
          <Box>
            <Text>Comment: </Text>
            <TextInput value={logComment} onChange={setLogComment} onSubmit={handleLogSubmit} />
          </Box>
          <Box marginTop={1}>
            <Text color="dim">Press </Text><Text bold color="cyan">Enter</Text><Text color="dim"> to submit | </Text>
            <Text bold color="cyan">Esc</Text><Text color="dim"> to cancel</Text>
          </Box>
          {logMutation.isPending && <Text italic color="yellow">Posting...</Text>}
        </Box>
      )}

      {activeModal === "move" && (
        <Box borderStyle="double" borderColor="yellow" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20}>
          <Text bold color="yellow">Transition {activeTicket?.key}</Text>
          {isLoadingTransitions ? (
            <Box marginTop={1}><Spinner type="dots" /><Text> Fetching options...</Text></Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              {transitions?.map((t, i) => (
                <Box key={t.id} backgroundColor={i === transitionIndex ? "white" : undefined} paddingX={1}>
                  <Text color={i === transitionIndex ? "black" : undefined}>{t.name} (→ {t.to.name})</Text>
                </Box>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="dim">Press </Text><Text bold color="cyan">Enter</Text><Text color="dim"> to select | </Text>
            <Text bold color="cyan">Esc</Text><Text color="dim"> to cancel</Text>
          </Box>
        </Box>
      )}

      {activeModal === "estimate" && (
        <Box borderStyle="double" borderColor="cyan" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20}>
          <Text bold color="cyan">Update Estimate for {activeTicket?.key}</Text>
          <Box marginTop={1}>
            <Text>New Estimate (e.g. 4h): </Text>
            <TextInput
              value={estimateValue}
              onChange={setEstimateValue}
              onSubmit={handleEstimateSubmit}
            />
          </Box>
          <Box marginTop={1}>
            <Text color="dim">Enter to save | Esc to cancel</Text>
          </Box>
        </Box>
      )}

      {activeModal === "view" && (
        <Box borderStyle="double" borderColor="white" padding={1} flexDirection="column" position="absolute" marginTop={2} marginLeft={5} width={100} height={20}>
          <Text bold color="cyan">{activeTicket?.key}: {activeTicket?.fields.summary}</Text>
          <Box marginTop={1} flexGrow={1}>
            <Text color="dim">
              {typeof activeTicket?.fields.description === "string"
                ? activeTicket.fields.description
                : "Rich description content (view in browser for full rendering)"}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text bold color="cyan">Esc</Text><Text color="dim"> to close</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const TixView: React.FC<TixViewProps> = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TixViewContent {...props} />
    </QueryClientProvider>
  );
};

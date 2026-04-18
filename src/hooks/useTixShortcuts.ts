import { useInput, useApp } from "ink";
import { clearTixCache, type JiraIssue, type JiraTransition, type JiraUser } from "../jira";
import { getAppConfig } from "../config";
import type { UseMutationResult } from "@tanstack/react-query";

interface TixShortcutParams {
  activeModal: "log" | "move" | "estimate" | "view" | null;
  setActiveModal: (modal: "log" | "move" | "estimate" | "view" | null) => void;
  setLogFocus: React.Dispatch<React.SetStateAction<"time" | "comment">>;
  transitions: JiraTransition[] | undefined;
  isConfirmingMove: boolean;
  setIsConfirmingMove: (val: boolean) => void;
  transitionIndex: number;
  setTransitionIndex: React.Dispatch<React.SetStateAction<number>>;
  activeTicket: JiraIssue | undefined;
  transitionMutation: UseMutationResult<void, Error, { key: string; id: string }, unknown>;
  isSorting: boolean;
  setIsSorting: (val: boolean) => void;
  sortIndex: number;
  setSortIndex: React.Dispatch<React.SetStateAction<number>>;
  sortOptions: { label: string; value: "newest" | "oldest" | "priority" | "updated" }[];
  setSortType: (val: "newest" | "oldest" | "priority" | "updated") => void;
  isUserSelecting: boolean;
  setIsUserSelecting: (val: boolean) => void;
  isPeerMode: boolean;
  filteredUsers: JiraUser[];
  selectedIndex: number;
  accountId: string | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setAccountId: (id: string | null) => void;
  setSelectedUserName: (name: string | null) => void;
  setUserSearchQuery: (val: string) => void;
  setCurrentPeerMode: (val: boolean) => void;
  isFiltering: boolean;
  setIsFiltering: (val: boolean) => void;
  filterQuery: string;
  setFilterQuery: (val: string) => void;
  refetchTickets: () => void;
  sortedTickets: JiraIssue[];
}

export function useTixShortcuts({
  setActiveModal,
  setLogFocus,
  setIsConfirmingMove,
  setTransitionIndex,
  setIsSorting,
  setSortIndex,
  setSortType,
  setIsUserSelecting,
  setSelectedIndex,
  setAccountId,
  setSelectedUserName,
  setUserSearchQuery,
  setCurrentPeerMode,
  filterQuery,
  setIsFiltering,
  setFilterQuery,
  refetchTickets,
  accountId,
  ...data
}: TixShortcutParams) {
  const { exit } = useApp();
  const config = getAppConfig();

  useInput((input, key) => {
    const {
      activeModal,
      activeTicket,
      transitions,
      isConfirmingMove,
      transitionIndex,
      isSorting,
      sortOptions,
      sortIndex,
      isUserSelecting,
      isPeerMode,
      filteredUsers,
      selectedIndex,
      isFiltering,
      sortedTickets,
      transitionMutation
    } = data;

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
      if (key.escape) {
        setIsUserSelecting(false);
        if (!accountId) {
          setAccountId(config.JIRA_ACCOUNT_ID);
          setSelectedUserName("Me");
          setCurrentPeerMode(false);
        }
      }
      if (key.upArrow) setSelectedIndex(p => Math.max(0, p - 1));
      if (key.downArrow) setSelectedIndex(p => Math.min(filteredUsers.length - 1, p + 1));
      if (key.return) {
        const user = filteredUsers[selectedIndex];
        if (user) {
          setAccountId(user.accountId);
          setSelectedUserName(user.displayName);
          setUserSearchQuery("");
          setIsUserSelecting(false);
          setSelectedIndex(0);
        }
      }
      return;
    }

    if (isFiltering) {
      if (key.return) setIsFiltering(false);
      
      if (key.escape) {
        if (filterQuery && filterQuery.length > 0) {
          setFilterQuery("");
        } else {
          setIsFiltering(false);
        }
      }

      if (key.ctrl && input === "u") {
        setFilterQuery("");
      }
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
        Bun.spawn(["pbcopy"], { stdin: Buffer.from(url) });
      }
      if (input === "o") {
        const domain = config.JIRA_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const url = `https://${domain}/browse/${activeTicket.key}`;
        Bun.spawn(["open", url]);
      }
    }

    if (input === "p") {
      const nextPeerMode = !isPeerMode;
      setCurrentPeerMode(nextPeerMode);
      if (nextPeerMode) {
        setAccountId(null);
        setSelectedUserName(null);
        setUserSearchQuery("");
        setIsUserSelecting(true);
      } else {
        setAccountId(config.JIRA_ACCOUNT_ID);
        setSelectedUserName("Me");
        setUserSearchQuery("");
        setIsUserSelecting(false);
      }
      setSelectedIndex(0);
    }

    if (input === "r") {
      clearTixCache();
      refetchTickets();
    }
  });
}

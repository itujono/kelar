import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { JiraUser } from "../../jira";
import { useWindowedSlice } from "../../hooks/useWindowedSlice";

interface UserSelectionProps {
  userSearchQuery: string;
  onUserSearchChange: (val: string) => void;
  isLoadingUsers: boolean;
  filteredUsers: JiraUser[];
  selectedIndex: number;
}

export const UserSelection: React.FC<UserSelectionProps> = ({
  userSearchQuery,
  onUserSearchChange,
  isLoadingUsers,
  filteredUsers,
  selectedIndex,
}) => {
  const { visibleItems, startIndex } = useWindowedSlice(filteredUsers, selectedIndex, 10);

  return (
    <Box flexDirection="column" paddingX={2} width={60} borderStyle="single" borderColor="cyan">
      <Text bold underline color="white">Select User</Text>
      <Box marginTop={1}>
        <Text color="dim">Search: </Text>
        <TextInput
          value={userSearchQuery}
          onChange={onUserSearchChange}
          placeholder="Type to filter..."
        />
      </Box>

      {isLoadingUsers ? (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text italic> Initializing user list...</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {filteredUsers.length === 0 ? (
            <Text color="dim"> No matches found.</Text>
          ) : (
            <>
              {startIndex > 0 && (
                <Text color="dim">  ↑ {startIndex} more team members...</Text>
              )}
              {visibleItems.map((u, i) => {
                const absIndex = startIndex + i;
                const isSelected = absIndex === selectedIndex;
                return (
                  <Box
                    key={u.accountId}
                    backgroundColor={isSelected ? "white" : undefined}
                    paddingX={1}
                  >
                    <Text color={isSelected ? "black" : undefined}>
                      {u.displayName}
                    </Text>
                    {u.emailAddress && (
                      <Text color="dim"> - {u.emailAddress}</Text>
                    )}
                  </Box>
                );
              })}
              {startIndex + 10 < filteredUsers.length && (
                <Text color="dim">
                  {" "}
                  ↓ {filteredUsers.length - (startIndex + 10)} more team members...
                </Text>
              )}
            </>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="dim">Keys: </Text>
        <Text bold color="white">↑/↓</Text>
        <Text color="dim"> navigate | </Text>
        <Text bold color="white">Enter</Text>
        <Text color="dim"> select | </Text>
        <Text bold color="white">Esc</Text>
        <Text color="dim"> cancel</Text>
      </Box>
    </Box>
  );
};

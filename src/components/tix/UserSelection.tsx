import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { JiraUser } from "../../jira";

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
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Select Team Member</Text>
      <Box marginTop={1} borderStyle="single" borderColor="dim" paddingX={1}>
        <Text color="dim">Search: </Text>
        <TextInput
          value={userSearchQuery}
          onChange={onUserSearchChange}
          placeholder="Type name..."
        />
      </Box>

      {isLoadingUsers && !filteredUsers.length ? (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text italic> Initializing user list...</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {filteredUsers.length === 0 ? (
            <Text color="dim"> No matches found.</Text>
          ) : (() => {
            const WINDOW_SIZE = 10;
            const total = filteredUsers.length;
            const startIndex = Math.max(
              0,
              Math.min(
                selectedIndex - Math.floor(WINDOW_SIZE / 2),
                Math.max(0, total - WINDOW_SIZE)
              )
            );
            const visibleUsers = filteredUsers.slice(
              startIndex,
              startIndex + WINDOW_SIZE
            );

            return (
              <>
                {startIndex > 0 && (
                  <Text color="dim">  ↑ {startIndex} more team members...</Text>
                )}
                {visibleUsers.map((u, i) => {
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
                {startIndex + WINDOW_SIZE < total && (
                  <Text color="dim">
                    {" "}
                    ↓ {total - (startIndex + WINDOW_SIZE)} more team members...
                  </Text>
                )}
              </>
            );
          })()}
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

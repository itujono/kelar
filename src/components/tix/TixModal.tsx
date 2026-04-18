import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { extractAdfText } from "../../utils";

interface Transition {
  id: string;
  name: string;
  to: {
    name: string;
  };
}

interface TixModalProps {
  activeModal: "log" | "move" | "estimate" | "view" | null;
  activeTicket: any;
  // Log props
  logTime: string;
  setLogTime: (val: string) => void;
  logComment: string;
  setLogComment: (val: string) => void;
  logFocus: "time" | "comment";
  setLogFocus: (focus: "time" | "comment") => void;
  onLogSubmit: () => void;
  isLogPending: boolean;
  // Move props
  isLoadingTransitions: boolean;
  isConfirmingMove: boolean;
  transitions?: Transition[];
  transitionIndex: number;
  // Estimate props
  estimateValue: string;
  setEstimateValue: (val: string) => void;
  onEstimateSubmit: () => void;
}

export function TixModal({
  activeModal,
  activeTicket,
  logTime,
  setLogTime,
  logComment,
  setLogComment,
  logFocus,
  setLogFocus,
  onLogSubmit,
  isLogPending,
  isLoadingTransitions,
  isConfirmingMove,
  transitions,
  transitionIndex,
  estimateValue,
  setEstimateValue,
  onEstimateSubmit
}: TixModalProps) {
  if (!activeModal || !activeTicket) return null;

  if (activeModal === "log") {
    return (
      <Box borderStyle="double" borderColor="magenta" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="magenta">Log Work for {activeTicket.key}</Text>
        <Box marginTop={1}>
          <Text color={logFocus === "time" ? "white" : "dim"}>Time (e.g. 1h 30m): </Text>
          <TextInput value={logTime} onChange={setLogTime} focus={logFocus === "time"} onSubmit={() => setLogFocus("comment")} />
        </Box>
        <Box>
          <Text color={logFocus === "comment" ? "white" : "dim"}>Comment: </Text>
          <TextInput value={logComment} onChange={setLogComment} focus={logFocus === "comment"} onSubmit={onLogSubmit} />
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color="dim">Press </Text>
          <Box>
            <Text bold color="cyan">Tab</Text><Text color="dim"> to switch | </Text>
            <Text bold color="cyan">Enter</Text><Text color="dim"> to save | </Text>
            <Text bold color="cyan">Esc</Text><Text color="dim"> to cancel</Text>
          </Box>
        </Box>
        {isLogPending && <Text italic color="yellow">Posting...</Text>}
      </Box>
    );
  }

  if (activeModal === "move") {
    return (
      <Box borderStyle="double" borderColor="yellow" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="yellow">Transition {activeTicket.key}</Text>
        {isLoadingTransitions ? (
          <Box marginTop={1}><Spinner type="dots" /><Text> Fetching options...</Text></Box>
        ) : isConfirmingMove ? (
          <Box flexDirection="column" marginTop={1}>
            <Text>You're about to move ticket </Text>
            <Text bold color="cyan">{activeTicket.key}</Text>
            <Box>
              <Text color="dim">{activeTicket.fields.status.name}</Text>
              <Text color="yellow"> → </Text>
              <Text bold color="green">{transitions?.[transitionIndex]?.to.name}</Text>
            </Box>
            <Box marginTop={1}>
              <Text italic color="yellow">Make sure you're aware of what this transition entails.</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="dim">Press </Text><Text bold color="green">Enter</Text><Text color="dim"> to confirm | </Text>
              <Text bold color="red">Esc</Text><Text color="dim"> to cancel</Text>
            </Box>
          </Box>
        ) : (
          <>
            <Box flexDirection="column" marginTop={1}>
              {transitions?.map((t, i) => (
                <Box key={t.id} backgroundColor={i === transitionIndex ? "white" : undefined} paddingX={1}>
                  <Text color={i === transitionIndex ? "black" : undefined}>{t.name} (→ {t.to.name})</Text>
                </Box>
              ))}
            </Box>
            <Box marginTop={1}>
              <Text color="dim">Press </Text><Text bold color="cyan">Enter</Text><Text color="dim"> to select | </Text>
              <Text bold color="cyan">Esc</Text><Text color="dim"> to cancel</Text>
            </Box>
          </>
        )}
      </Box>
    );
  }

  if (activeModal === "estimate") {
    return (
      <Box borderStyle="double" borderColor="cyan" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="cyan">Update Estimate for {activeTicket.key}</Text>
        <Box marginTop={1}>
          <Text>New Estimate (e.g. 4h): </Text>
          <TextInput
            value={estimateValue}
            onChange={setEstimateValue}
            onSubmit={onEstimateSubmit}
          />
        </Box>
        <Box marginTop={1}>
          <Text color="dim">Enter to save | Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  if (activeModal === "view") {
    return (
      <Box borderStyle="double" borderColor="white" padding={1} flexDirection="column" position="absolute" marginTop={2} marginLeft={5} width={100} height={25} backgroundColor="black">
        <Box marginBottom={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="dim" paddingBottom={1}>
          <Text bold color="cyan">[{activeTicket.key}] </Text>
          <Text bold color="white">{activeTicket.fields.summary}</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          <Text color="white">
            {extractAdfText(activeTicket.fields.description) || <Text italic color="dim">No description provided.</Text>}
          </Text>
        </Box>
        <Box marginTop={1} paddingTop={1} borderStyle="single" borderBottom={false} borderLeft={false} borderRight={false} borderColor="dim">
          <Text bold color="cyan">Esc</Text><Text color="dim"> to close</Text>
        </Box>
      </Box>
    );
  }

  return null;
}

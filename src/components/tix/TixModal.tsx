import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { extractAdfText } from "../../utils";
import { useTixContext } from "../../contexts/TixContext";

export function TixModal() {
  const { setLogTime, setLogComment, setLogFocus, handleLogSubmit, setEstimateValue, handleEstimateSubmit, ...data } = useTixContext();

  if (!data.activeModal || !data.activeTicket) return null;

  if (data.activeModal === "log") {
    return (
      <Box borderStyle="double" borderColor="magenta" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="magenta">Log Work for {data.activeTicket.key}</Text>
        <Box marginTop={1}>
          <Text color={data.logFocus === "time" ? "white" : "dim"}>Time (e.g. 1h 30m): </Text>
          <TextInput value={data.logTime} onChange={setLogTime} focus={data.logFocus === "time"} onSubmit={() => setLogFocus("comment")} />
        </Box>
        <Box>
          <Text color={data.logFocus === "comment" ? "white" : "dim"}>Comment: </Text>
          <TextInput value={data.logComment} onChange={setLogComment} focus={data.logFocus === "comment"} onSubmit={handleLogSubmit} />
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color="dim">Press </Text>
          <Box>
            <Text bold color="cyan">Tab</Text><Text color="dim"> to switch | </Text>
            <Text bold color="cyan">Enter</Text><Text color="dim"> to save | </Text>
            <Text bold color="cyan">Esc</Text><Text color="dim"> to cancel</Text>
          </Box>
        </Box>
        {data.logMutation.isPending && <Text italic color="yellow">Posting...</Text>}
      </Box>
    );
  }

  if (data.activeModal === "move") {
    return (
      <Box borderStyle="double" borderColor="yellow" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="yellow">Transition {data.activeTicket.key}</Text>
        {data.isLoadingTransitions ? (
          <Box marginTop={1}><Spinner type="dots" /><Text> Fetching options...</Text></Box>
        ) : data.isConfirmingMove ? (
          <Box flexDirection="column" marginTop={1}>
            <Text>You're about to move ticket </Text>
            <Text bold color="cyan">{data.activeTicket.key}</Text>
            <Box>
              <Text color="dim">{data.activeTicket.fields.status.name}</Text>
              <Text color="yellow"> → </Text>
              <Text bold color="green">{data.transitions?.[data.transitionIndex]?.to.name}</Text>
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
              {data.transitions?.map((t, i) => (
                <Box key={t.id} backgroundColor={i === data.transitionIndex ? "white" : undefined} paddingX={1}>
                  <Text color={i === data.transitionIndex ? "black" : undefined}>{t.name} (→ {t.to.name})</Text>
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

  if (data.activeModal === "estimate") {
    return (
      <Box borderStyle="double" borderColor="cyan" padding={1} flexDirection="column" position="absolute" marginTop={5} marginLeft={20} backgroundColor="black">
        <Text bold color="cyan">Update Estimate for {data.activeTicket.key}</Text>
        <Box marginTop={1}>
          <Text>New Estimate (e.g. 4h): </Text>
          <TextInput
            value={data.estimateValue}
            onChange={setEstimateValue}
            onSubmit={handleEstimateSubmit}
          />
        </Box>
        <Box marginTop={1}>
          <Text color="dim">Enter to save | Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  if (data.activeModal === "view") {
    return (
      <Box borderStyle="double" borderColor="white" padding={1} flexDirection="column" position="absolute" marginTop={2} marginLeft={5} width={100} height={25} backgroundColor="black">
        <Box marginBottom={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="dim" paddingBottom={1}>
          <Text bold color="cyan">[{data.activeTicket.key}] </Text>
          <Text bold color="white">{data.activeTicket.fields.summary}</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          <Text color="white">
            {extractAdfText(data.activeTicket.fields.description) || <Text italic color="dim">No description provided.</Text>}
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

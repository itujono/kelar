import { Text, Box } from "ink";
import { getAppConfig } from "../config";

export function LogConfig() {
  const config = getAppConfig();

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text bold color="yellow">Kelar Configuration</Text>
      </Box>

      {Object.entries(config).map(([key, value]) => (
        <Box key={key}>
          <Box width={25}>
            <Text bold>{key}:</Text>
          </Box>
          <Text color={value ? "white" : "red"}>
            {value ? (key.includes("TOKEN") ? "********" : value) : "NOT SET"}
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="gray" italic>Use `kelar log config set {"<key>"} {"<value>"}` to update.</Text>
      </Box>
    </Box>
  );
};

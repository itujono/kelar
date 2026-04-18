import { Box, Text } from "ink";

export interface MenuOption<T> {
  label: string;
  value: T;
}

interface SelectionMenuProps<T> {
  title: string;
  options: MenuOption<T>[];
  selectedIndex: number;
  currentValue: T;
  borderColor?: string;
}

export function SelectionMenu<T>({
  title,
  options,
  selectedIndex,
  currentValue,
  borderColor = "cyan",
}: SelectionMenuProps<T>) {
  return (
    <Box borderStyle="single" borderColor={borderColor} paddingX={1} marginBottom={1} flexDirection="column">
      <Box backgroundColor={borderColor} paddingX={1} marginRight={1} marginBottom={1}>
        <Text bold color="black"> {title.toUpperCase()} </Text>
      </Box>
      {options.map((opt, i) => (
        <Box key={i}>
          <Text color={i === selectedIndex ? borderColor : "dim"}>
            {i === selectedIndex ? "❯" : " "} {opt.label}
            {currentValue === opt.value ? " (active)" : ""}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text bold color={borderColor}>Enter</Text>
        <Text color="dim"> to apply | </Text>
        <Text bold color={borderColor}>Esc</Text>
        <Text color="dim"> to close</Text>
      </Box>
    </Box>
  );
}

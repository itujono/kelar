import React from "react";
import { Box, Text } from "ink";

interface TableProps<T> {
  data: T[];
  columns?: (keyof T)[];
  columnWidths?: Partial<Record<keyof T, number>>;
  compact?: boolean;
  selectedIndex?: number;
  renderCell?: (column: keyof T, value: any, row: T) => React.ReactNode;
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
  columnWidths,
  compact,
  selectedIndex,
  renderCell
}: TableProps<T>) {
  if (data.length === 0) return null;

  const allColumns = columns || (Object.keys(data[0] || {}) as (keyof T)[]);

  const colWidths = allColumns.map((col) => {
    if (columnWidths && columnWidths[col]) {
      return columnWidths[col] as number;
    }
    const headerLen = String(col).length;
    const maxDataLen = data.reduce((max, row) => {
      const val = row[col];
      const len = val !== undefined ? String(val).length : 0;
      return Math.max(max, len);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });

  if (compact) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="dim" flexGrow={1}>
        <Box paddingX={1} marginBottom={0}>
          {allColumns.map((col, i) => (
            <Box key={String(col)} width={colWidths[i]} paddingRight={2}>
              <Text bold color="cyan">
                {String(col)}
              </Text>
            </Box>
          ))}
        </Box>
        {data.map((row, rowIndex) => {
          const isSelected = rowIndex === selectedIndex;
          return (
            <Box
              key={rowIndex}
              paddingX={1}
              backgroundColor={isSelected ? "white" : undefined}
            >
              {allColumns.map((col, i) => (
                <Box key={String(col)} width={colWidths[i]} paddingRight={2}>
                  {renderCell ? (
                    (() => {
                      const cell = renderCell(col, row[col], row);
                      if (typeof cell === "string" || typeof cell === "number") {
                        return (
                          <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                            {cell}
                          </Text>
                        );
                      }
                      return cell;
                    })()
                  ) : (
                    <Text color={isSelected ? "black" : undefined} wrap="truncate-end">
                      {row[col] ?? ""}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
    );
  }

  // Helper to render horizontal lines with intersections (for non-compact mode)
  const renderLine = (start: string, middle: string, end: string, line: string) => (
    <Box>
      <Text color="dim">{start}</Text>
      {colWidths.map((width, i) => (
        <React.Fragment key={i}>
          <Text color="dim">{line.repeat(width)}</Text>
          {i < colWidths.length - 1 ? <Text color="dim">{middle}</Text> : null}
        </React.Fragment>
      ))}
      <Text color="dim">{end}</Text>
    </Box>
  );

  return (
    <Box flexDirection="column">
      {renderLine("┌", "┬", "┐", "─")}

      <Box>
        <Text color="dim">│</Text>
        {allColumns.map((col, i) => (
          <React.Fragment key={String(col)}>
            <Box width={colWidths[i]} paddingX={1}>
              <Text bold color="cyan">
                {String(col)}
              </Text>
            </Box>
            <Text color="dim">│</Text>
          </React.Fragment>
        ))}
      </Box>

      {renderLine("├", "┼", "┤", "─")}

      {data.map((row, rowIndex) => {
        const isSelected = rowIndex === selectedIndex;
        return (
          <React.Fragment key={rowIndex}>
            <Box backgroundColor={isSelected ? "white" : undefined}>
              <Text color={isSelected ? "black" : "dim"}>│</Text>
              {allColumns.map((col, i) => (
                <React.Fragment key={String(col)}>
                  <Box width={colWidths[i]} paddingX={1}>
                    <Box>
                      {renderCell ? (
                        <Box>
                          <Text color={isSelected ? "black" : undefined}>
                            {renderCell(col, row[col], row)}
                          </Text>
                        </Box>
                      ) : (
                        <Text color={isSelected ? "black" : undefined}>
                          {row[col] ?? ""}
                        </Text>
                      )}
                    </Box>
                  </Box>
                  <Text color={isSelected ? "black" : "dim"}>│</Text>
                </React.Fragment>
              ))}
            </Box>
            {rowIndex < data.length - 1 ? renderLine("├", "┼", "┤", "─") : null}
          </React.Fragment>
        );
      })}

      {renderLine("└", "┴", "┘", "─")}
    </Box>
  );
}

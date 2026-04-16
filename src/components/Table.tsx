import React from "react";
import { Box, Text } from "ink";

interface TableProps<T> {
  data: T[];
  columns?: (keyof T)[];
  compact?: boolean;
  selectedIndex?: number;
  renderCell?: (column: keyof T, value: any, row: T) => React.ReactNode;
}

export function Table<T extends Record<string, any>>({ data, columns, compact, selectedIndex, renderCell }: TableProps<T>) {
  if (data.length === 0) return null;

  const allColumns = columns || (Object.keys(data[0] || {}) as (keyof T)[]);

  // Calculate column widths (base content width)
  const contentWidths = allColumns.map((col) => {
    const headerLen = String(col).length;
    const maxDataLen = data.reduce((max, row) => {
      const val = row[col];
      const len = val !== undefined ? String(val).length : 0;
      return Math.max(max, len);
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });

  // Column widths with 1-character padding on each side
  const colWidths = contentWidths.map((w) => w + 2);

  // Helper to render horizontal lines with intersections
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
      {/* Top Border */}
      {renderLine("┌", "┬", "┐", "─")}

      {/* Header Row */}
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

      {/* Header Separator */}
      {renderLine("├", "┼", "┤", "─")}

      {/* Data Rows */}
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
                          {/* We wrap renderCell to ensure we can force its child Text to be black if needed */}
                          {/* However, the renderCell itself might return a <Text> which won't inherit the color automatically if it sets its own */}
                          {/* But most of our renderCells use the inherited color or we can fix them in the caller */}
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
            {/* Internal Divider (between rows) */}
            {(!compact && rowIndex < data.length - 1) ? renderLine("├", "┼", "┤", "─") : null}
          </React.Fragment>
        );
      })}

      {/* Bottom Border */}
      {renderLine("└", "┴", "┘", "─")}
    </Box>
  );
}

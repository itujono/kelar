import React from "react";
import { Box, Text } from "ink";

interface TableProps<T> {
  data: T[];
  columns?: (keyof T)[];
  compact?: boolean;
}

export function Table<T extends Record<string, any>>({ data, columns, compact }: TableProps<T>) {
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
      {data.map((row, rowIndex) => (
        <React.Fragment key={rowIndex}>
          <Box>
            <Text color="dim">│</Text>
            {allColumns.map((col, i) => (
              <React.Fragment key={String(col)}>
                <Box width={colWidths[i]} paddingX={1}>
                  <Text>{row[col] !== undefined ? String(row[col]) : ""}</Text>
                </Box>
                <Text color="dim">│</Text>
              </React.Fragment>
            ))}
          </Box>
          {/* Internal Divider (between rows) */}
          {(!compact && rowIndex < data.length - 1) ? renderLine("├", "┼", "┤", "─") : null}
        </React.Fragment>
      ))}

      {/* Bottom Border */}
      {renderLine("└", "┴", "┘", "─")}
    </Box>
  );
}

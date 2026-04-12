import React from "react";
import { Box, Text } from "ink";

interface TableProps<T> {
  data: T[];
  columns?: (keyof T)[];
}

export function Table<T extends Record<string, any>>({ data, columns }: TableProps<T>) {
  if (data.length === 0) return null;

  const allColumns = columns || (Object.keys(data[0] || {}) as (keyof T)[]);

  // Calculate column widths
  const columnWidths = allColumns.map((col) => {
    const headerLen = String(col).length;
    const maxDataLen = data.reduce((max, row) => {
      const val = row[col];
      const len = val !== undefined ? String(val).length : 0;
      return Math.max(max, len);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2; // +2 for padding
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="dim">
      {/* Header */}
      <Box borderStyle="single" borderBottom borderColor="dim">
        {allColumns.map((col, i) => (
          <Box key={String(col)} width={columnWidths[i]}>
            <Text bold color="cyan">
              {String(col)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {data.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {allColumns.map((col, i) => (
            <Box key={String(col)} width={columnWidths[i]}>
              <Text>{row[col] !== undefined ? String(row[col]) : ""}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

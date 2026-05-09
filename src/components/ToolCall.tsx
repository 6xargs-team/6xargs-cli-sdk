/**
 * ToolCall — termcn-style structured display for `ask` query responses.
 * Renders the answer, ranked sources, and request latency in a consistent layout.
 */
import React from "react";
import { Box, Text } from "ink";

export interface ToolCallSource {
  engagement_id: string;
  relevance: number;
  excerpt?: string;
}

export interface ToolCallProps {
  answer:      string;
  sources:     ToolCallSource[];
  latency_ms?: number;
  mode:        "guide" | "report";
}

export function ToolCall({ answer, sources, latency_ms }: ToolCallProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Answer</Text>
        <Text dimColor>{"─".repeat(50)}</Text>
        <Text>{answer}</Text>
      </Box>

      {sources.length > 0 && (
        <Box flexDirection="column">
          <Text bold dimColor>Sources</Text>
          {sources.map((s) => (
            <Box key={s.engagement_id} gap={1}>
              <Text dimColor>  ●</Text>
              <Text dimColor>{s.engagement_id}</Text>
              <Text dimColor>({Math.round(s.relevance * 100)}%)</Text>
              {s.excerpt && (
                <Text dimColor>— {s.excerpt.length > 60 ? s.excerpt.slice(0, 60) + "…" : s.excerpt}</Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {latency_ms !== undefined && (
        <Text dimColor>Latency: {latency_ms}ms</Text>
      )}
    </Box>
  );
}

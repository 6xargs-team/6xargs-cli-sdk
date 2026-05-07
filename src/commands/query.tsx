import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { request } from "../lib/client.js";
import { streamQuery } from "../lib/stream.js";
import { format } from "../lib/output.js";
import { formatError, EXIT } from "../lib/errors.js";
import {
  QueryResultSchema,
  QueryHistorySchema,
  FeedbackResponseSchema,
} from "../types/api.js";
import type { QueryResult, QueryHistoryItem } from "../types/api.js";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

// ── Ask ───────────────────────────────────────────────────────────────────────

interface AskProps {
  query: string;
  mode: "guide" | "report";
  stream: boolean;
  outputFmt: string;
  apiBase?: string;
  onExit: (code: number) => void;
}

export function AskCommand({ query, mode, stream, outputFmt, apiBase, onExit }: AskProps) {
  const { exit } = useApp();
  const [frame, setFrame] = useState(0);
  const [phase, setPhase] = useState<"loading" | "streaming" | "done" | "error">("loading");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [tokens, setTokens] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  // Spinner animation
  useEffect(() => {
    if (phase !== "loading" && phase !== "streaming") return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const run = async () => {
      if (stream) {
        setPhase("streaming");
        let accumulated = "";

        for await (const evt of streamQuery(query, mode, { apiBase })) {
          if (evt.type === "done") break;
          if (evt.type === "step") {
            setSteps((s) => [...s, evt.content]);
          } else if (evt.type === "token") {
            accumulated += evt.content;
            setTokens(accumulated);
          }
        }

        if (outputFmt === "json") {
          process.stdout.write(format({ query, mode, answer: accumulated }, "json"));
        } else {
          process.stdout.write(accumulated + "\n");
        }
      } else {
        const res = await request("POST", "/api/v1/query", QueryResultSchema, {
          body: { query, mode },
        });
        setResult(res);

        if (outputFmt === "json") {
          process.stdout.write(format(res, "json"));
        }
      }

      setPhase("done");
    };

    run()
      .catch((err: unknown) => {
        setError(formatError(err));
        setPhase("error");
      })
      .finally(() => {
        onExit(error ? EXIT.API_ERROR : EXIT.SUCCESS);
        exit();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "error" && error) {
    return (
      <Box flexDirection="column">
        <Box gap={1}><Text color="red">✗</Text><Text color="red">{error.message}</Text></Box>
        {error.hint && <Text dimColor>  {error.hint}</Text>}
      </Box>
    );
  }

  if (phase === "loading") {
    return (
      <Box gap={1}>
        <Text color="cyan">{SPINNER[frame]}</Text>
        <Text>Querying knowledge base...</Text>
      </Box>
    );
  }

  if (phase === "streaming") {
    return (
      <Box flexDirection="column">
        {steps.map((s, i) => (
          <Box key={i} gap={1}>
            <Text dimColor>  ↳</Text>
            <Text dimColor>{s}</Text>
          </Box>
        ))}
        {tokens && <Text>{tokens}</Text>}
        {!tokens && (
          <Box gap={1}>
            <Text color="cyan">{SPINNER[frame]}</Text>
            <Text dimColor>Generating answer...</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (outputFmt === "json" || !result) return null;

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Answer</Text>
        <Text dimColor>{"─".repeat(50)}</Text>
        <Text>{result.answer}</Text>
      </Box>
      {result.sources.length > 0 && (
        <Box flexDirection="column">
          <Text bold dimColor>Sources</Text>
          {result.sources.map((s, i) => (
            <Box key={i} gap={1}>
              <Text dimColor>  ●</Text>
              <Text dimColor>{s.engagement_id}</Text>
              <Text dimColor>({Math.round(s.relevance * 100)}%)</Text>
            </Box>
          ))}
        </Box>
      )}
      {result.latency_ms && (
        <Text dimColor>Latency: {result.latency_ms}ms</Text>
      )}
    </Box>
  );
}

// ── History ───────────────────────────────────────────────────────────────────

interface HistoryProps {
  outputFmt: string;
  onExit: (code: number) => void;
}

export function QueryHistoryCommand({ outputFmt, onExit }: HistoryProps) {
  const { exit } = useApp();
  const [items, setItems] = useState<QueryHistoryItem[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("GET", "/api/v1/query/history", QueryHistorySchema)
      .then((res) => setItems(res.items))
      .catch((err: unknown) => setError(formatError(err)))
      .finally(() => {
        onExit(error ? EXIT.API_ERROR : EXIT.SUCCESS);
        exit();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <Box flexDirection="column">
        <Box gap={1}><Text color="red">✗</Text><Text color="red">{error.message}</Text></Box>
        {error.hint && <Text dimColor>  {error.hint}</Text>}
      </Box>
    );
  }

  if (!items) {
    return <Box gap={1}><Text color="cyan">⠋</Text><Text>Loading history...</Text></Box>;
  }

  if (outputFmt === "json") {
    process.stdout.write(format(items, "json"));
    return null;
  }

  const rows = items.map((q) => ({
    id: q.id,
    query: q.query,
    mode: q.mode,
    feedback: q.useful === true ? "useful" : q.useful === false ? "not useful" : "-",
    date: new Date(q.created_at).toLocaleString(),
  }));

  process.stdout.write(format(rows, outputFmt));
  return null;
}

// ── Feedback ──────────────────────────────────────────────────────────────────

interface FeedbackProps {
  queryId: string;
  useful: boolean;
  reason?: string;
  onExit: (code: number) => void;
}

export function QueryFeedbackCommand({ queryId, useful, reason, onExit }: FeedbackProps) {
  const { exit } = useApp();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("POST", `/api/v1/query/${queryId}/feedback`, FeedbackResponseSchema, {
      body: { useful, ...(reason ? { reason } : {}) },
    })
      .then(() => setDone(true))
      .catch((err: unknown) => setError(formatError(err)))
      .finally(() => {
        onExit(error ? EXIT.API_ERROR : EXIT.SUCCESS);
        setTimeout(exit, 80);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <Box flexDirection="column">
        <Box gap={1}><Text color="red">✗</Text><Text color="red">{error.message}</Text></Box>
        {error.hint && <Text dimColor>  {error.hint}</Text>}
      </Box>
    );
  }

  if (!done) return <Box gap={1}><Text color="cyan">⠋</Text><Text>Submitting feedback...</Text></Box>;

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>Feedback recorded</Text>
      <Text dimColor>({queryId}, {useful ? "useful" : "not useful"})</Text>
    </Box>
  );
}

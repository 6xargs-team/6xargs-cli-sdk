import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Alert, Spinner, ToolCall } from "../components/index.js";
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
  const [phase, setPhase] = useState<"loading" | "streaming" | "done" | "error">("loading");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [tokens, setTokens] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

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
      .then(() => { onExit(EXIT.SUCCESS); exit(); })
      .catch((err: unknown) => {
        const fmt = formatError(err);
        setError(fmt);
        setPhase("error");
        onExit(fmt.exitCode);
        exit();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "error" && error) return <Alert message={error.message} hint={error.hint} />;

  if (phase === "loading") return <Spinner label="Querying knowledge base..." />;

  if (phase === "streaming") {
    return (
      <Box flexDirection="column">
        {steps.map((s, i) => (
          <Box key={i} gap={1}>
            <Text dimColor>  ↳</Text>
            <Text dimColor>{s}</Text>
          </Box>
        ))}
        {tokens
          ? <Text>{tokens}</Text>
          : <Spinner label="Generating answer..." />}
      </Box>
    );
  }

  if (outputFmt === "json" || !result) return null;

  return (
    <ToolCall
      query={query}
      mode={mode}
      answer={result.answer}
      sources={result.sources}
      latency_ms={result.latency_ms}
    />
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
      .then((res) => {
        setItems(res.items);
        onExit(EXIT.SUCCESS);
        exit();
      })
      .catch((err: unknown) => {
        const fmt = formatError(err);
        setError(fmt);
        onExit(fmt.exitCode);
        exit();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert message={error.message} hint={error.hint} />;
  if (!items) return <Spinner label="Loading history..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(items, "json"));
    return null;
  }

  const rows = items.map((q) => ({
    id:     q.id,
    query:  q.query,
    mode:   q.mode,
    useful: q.useful === true ? "yes" : q.useful === false ? "no" : "-",
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
      .then(() => {
        setDone(true);
        onExit(EXIT.SUCCESS);
        setTimeout(exit, 80);
      })
      .catch((err: unknown) => {
        const fmt = formatError(err);
        setError(fmt);
        onExit(fmt.exitCode);
        exit();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert message={error.message} hint={error.hint} />;
  if (!done)  return <Spinner label="Submitting feedback..." />;

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>Feedback recorded</Text>
      <Text dimColor>({queryId}, {useful ? "useful" : "not useful"})</Text>
    </Box>
  );
}

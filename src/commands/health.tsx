import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { fetch } from "undici";
import { getApiBase } from "../lib/config.js";
import { EXIT } from "../lib/errors.js";

interface Props {
  json: boolean;
  apiBase?: string;
  onExit: (code: number) => void;
}

interface HealthResult {
  status: "ok" | "error";
  latency_ms: number;
  url: string;
  error?: string;
}

export function HealthCommand({ json, apiBase, onExit }: Props) {
  const { exit } = useApp();
  const [result, setResult] = useState<HealthResult | null>(null);

  useEffect(() => {
    const base = getApiBase(apiBase);
    const url = `${base}/health`;
    const start = Date.now();

    fetch(url, { signal: AbortSignal.timeout(10_000) })
      .then((res) => {
        setResult({
          status: res.ok ? "ok" : "error",
          latency_ms: Date.now() - start,
          url,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        });
      })
      .catch((err: unknown) => {
        setResult({
          status: "error",
          latency_ms: Date.now() - start,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result === null) return;

    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      const code = result.status === "ok" ? EXIT.SUCCESS : EXIT.API_ERROR;
      onExit(code);
      exit();
      return;
    }

    // Let the component render once, then exit
    const timer = setTimeout(() => {
      const code = result.status === "ok" ? EXIT.SUCCESS : EXIT.API_ERROR;
      onExit(code);
      exit();
    }, 80);

    return () => clearTimeout(timer);
  }, [result, json, exit, onExit]);

  if (result === null) {
    const base = getApiBase(apiBase).replace(/^https?:\/\//, "");
    return (
      <Box>
        <Text color="yellow">Pinging </Text>
        <Text color="cyan">{base}</Text>
        <Text color="yellow">...</Text>
      </Box>
    );
  }

  const ok = result.status === "ok";

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={ok ? "green" : "red"}>{ok ? "✓" : "✗"}</Text>
        <Text>API:</Text>
        <Text bold color={ok ? "green" : "red"}>
          {ok ? "OK" : "UNREACHABLE"}
        </Text>
        <Text dimColor>({result.latency_ms}ms)</Text>
      </Box>
      <Text dimColor>  {result.url}</Text>
      {result.error != null && (
        <>
          <Text color="red">  {result.error}</Text>
          <Text dimColor>  Run: 6xargs config set api_base {"<url>"}</Text>
        </>
      )}
    </Box>
  );
}

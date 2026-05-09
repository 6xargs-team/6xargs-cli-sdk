import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Alert, Spinner } from "../components/index.js";
import { z } from "zod";
import { request } from "../lib/client.js";
import { format } from "../lib/output.js";
import { formatError, EXIT } from "../lib/errors.js";
import { EngagementSchema } from "../types/api.js";
import type { Engagement } from "../types/api.js";

const EngagementsListSchema = EngagementSchema.array();
const EmptySchema = z.object({}).passthrough();

// ── List ──────────────────────────────────────────────────────────────────────

interface ListProps {
  outputFmt: string;
  onExit: (code: number) => void;
}

export function EngagementsListCommand({ outputFmt, onExit }: ListProps) {
  const { exit } = useApp();
  const [engagements, setEngagements] = useState<Engagement[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("GET", "/api/v1/engagements", EngagementsListSchema)
      .then((e) => {
        setEngagements(e);
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
  if (!engagements) return <Spinner label="Loading..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(engagements, "json"));
    return null;
  }

  if (engagements.length === 0) {
    return <Text dimColor>No engagements indexed. Run: 6xargs ingest upload &lt;file&gt;</Text>;
  }

  const rows = engagements.map((e) => ({
    id:       e.id,
    name:     e.name,
    industry: e.industry ?? "-",
    findings: e.findings_count ?? 0,
    indexed:  new Date(e.indexed_at).toLocaleDateString(),
  }));

  process.stdout.write(format(rows, outputFmt));
  return null;
}

// ── Show ──────────────────────────────────────────────────────────────────────

interface ShowProps {
  engagementId: string;
  outputFmt: string;
  onExit: (code: number) => void;
}

export function EngagementsShowCommand({ engagementId, outputFmt, onExit }: ShowProps) {
  const { exit } = useApp();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("GET", `/api/v1/engagements/${engagementId}`, EngagementSchema)
      .then((e) => {
        setEngagement(e);
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
  if (!engagement) return <Spinner label="Loading..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(engagement, "json"));
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}><Text color="green">✓</Text><Text bold>{engagement.name}</Text></Box>
      <Text dimColor>  id:       {engagement.id}</Text>
      <Text dimColor>  industry: {engagement.industry ?? "-"}</Text>
      <Text dimColor>  indexed:  {new Date(engagement.indexed_at).toLocaleString()}</Text>
      {engagement.findings_count !== undefined && (
        <Text dimColor>  findings: {engagement.findings_count}</Text>
      )}
      {engagement.stack?.length ? (
        <Text dimColor>  stack:    {engagement.stack.join(", ")}</Text>
      ) : null}
    </Box>
  );
}

// ── Delete ────────────────────────────────────────────────────────────────────

interface DeleteProps {
  engagementId: string;
  onExit: (code: number) => void;
}

export function EngagementsDeleteCommand({ engagementId, onExit }: DeleteProps) {
  const { exit } = useApp();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("DELETE", `/api/v1/engagements/${engagementId}`, EmptySchema)
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
  if (!done)  return <Spinner label="Deleting engagement..." />;

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>Engagement {engagementId} removed from index.</Text>
    </Box>
  );
}

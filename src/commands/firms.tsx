import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Alert, Badge, Spinner } from "../components/index.js";
import { z } from "zod";
import { request } from "../lib/client.js";
import { format } from "../lib/output.js";
import { formatError, EXIT } from "../lib/errors.js";
import { FirmSchema, ApiKeySchema, NewApiKeySchema } from "../types/api.js";
import type { Firm, ApiKey, NewApiKey } from "../types/api.js";
import { getCurrentProfile } from "../lib/config.js";

const ApiKeysListSchema = ApiKeySchema.array();
const EmptySchema = z.object({}).passthrough();

// ── Firm Info ─────────────────────────────────────────────────────────────────

interface FirmInfoProps {
  outputFmt: string;
  onExit: (code: number) => void;
}

export function FirmInfoCommand({ outputFmt, onExit }: FirmInfoProps) {
  const { exit } = useApp();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    const firmId = getCurrentProfile().firm_id;

    if (!firmId) {
      setError({ message: "Not logged in.", hint: "Run: 6xargs login --api-key <your-key>" });
      onExit(EXIT.AUTH_ERROR);
      exit();
      return;
    }

    request("GET", `/api/v1/firms/${firmId}`, FirmSchema)
      .then((f) => {
        setFirm(f);
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
  if (!firm)  return <Spinner label="Loading firm info..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(firm, "json"));
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>{firm.name}</Text>
        <Text>[</Text><Badge variant="plan" value={firm.plan} /><Text>]</Text>
      </Box>
      <Text dimColor>  id:                  {firm.id}</Text>
      <Text dimColor>  engagements indexed: {firm.engagements_indexed}</Text>
      <Text dimColor>  queries this month:  {firm.queries_this_month}</Text>
      <Text dimColor>  member since:        {new Date(firm.created_at).toLocaleDateString()}</Text>
    </Box>
  );
}

// ── Keys List ─────────────────────────────────────────────────────────────────

interface KeysListProps {
  outputFmt: string;
  onExit: (code: number) => void;
}

export function FirmKeysListCommand({ outputFmt, onExit }: KeysListProps) {
  const { exit } = useApp();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("GET", "/api/v1/keys", ApiKeysListSchema)
      .then((k) => {
        setKeys(k);
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
  if (!keys)  return <Spinner label="Loading..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(keys, "json"));
    return null;
  }

  if (keys.length === 0) {
    return <Text dimColor>No API keys. Run: 6xargs firm keys create --name "My key"</Text>;
  }

  const rows = keys.map((k) => ({
    id:          k.id,
    name:        k.name,
    prefix:      k.prefix,
    created:     new Date(k.created_at).toLocaleDateString(),
    "last used": k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never",
  }));

  process.stdout.write(format(rows, outputFmt));
  return null;
}

// ── Keys Create ───────────────────────────────────────────────────────────────

interface KeysCreateProps {
  name: string;
  outputFmt: string;
  onExit: (code: number) => void;
}

export function FirmKeysCreateCommand({ name, outputFmt, onExit }: KeysCreateProps) {
  const { exit } = useApp();
  const [key, setKey] = useState<NewApiKey | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("POST", "/api/v1/keys", NewApiKeySchema, { body: { name } })
      .then((k) => {
        setKey(k);
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
  if (!key)   return <Spinner label="Creating key..." />;

  if (outputFmt === "json") {
    process.stdout.write(format(key, "json"));
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}><Text color="green">✓</Text><Text bold>API key created: {key.name}</Text></Box>
      <Box gap={1}><Text color="yellow">Key:</Text><Text bold>{key.key}</Text></Box>
      <Text color="yellow">  Store this key securely — it will not be shown again.</Text>
      <Text dimColor>  id:      {key.id}</Text>
      <Text dimColor>  prefix:  {key.prefix}</Text>
    </Box>
  );
}

// ── Keys Revoke ───────────────────────────────────────────────────────────────

interface KeysRevokeProps {
  keyId: string;
  onExit: (code: number) => void;
}

export function FirmKeysRevokeCommand({ keyId, onExit }: KeysRevokeProps) {
  const { exit } = useApp();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("DELETE", `/api/v1/keys/${keyId}`, EmptySchema)
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
  if (!done)  return <Spinner label="Revoking key..." />;

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>API key {keyId} revoked.</Text>
    </Box>
  );
}

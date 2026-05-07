import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { login, logout, hardLogout, getAuthStatus, getJwt, maskApiKey } from "../lib/auth.js";
import { prompt, promptSecret } from "../lib/prompt.js";
import { formatError } from "../lib/errors.js";
import { EXIT } from "../lib/errors.js";
import type { LoginResult, AuthStatus } from "../lib/auth.js";

// ── Shared ───────────────────────────────────────────────────────────────────

interface ExitProps {
  onExit: (code: number) => void;
}

function ErrorBox({ message, hint }: { message: string; hint?: string }) {
  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color="red">✗</Text>
        <Text color="red">{message}</Text>
      </Box>
      {hint && <Text dimColor>  {hint}</Text>}
    </Box>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

interface LoginProps extends ExitProps {
  result: LoginResult | null;
  error: { message: string; hint?: string } | null;
}

export function LoginOutput({ result, error, onExit }: LoginProps) {
  const { exit } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      onExit(error ? EXIT.AUTH_ERROR : EXIT.SUCCESS);
      exit();
    }, 80);
    return () => clearTimeout(timer);
  }, [error, exit, onExit]);

  if (error) return <ErrorBox {...error} />;
  if (!result) return null;

  const planColor = { starter: "yellow", pro: "cyan", enterprise: "magenta" } as const;
  const plan = result.firm.plan;
  const color = planColor[plan] ?? "white";

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text bold>Authenticated</Text>
      </Box>
      <Text dimColor>  firm:    {result.firm.name}</Text>
      <Text dimColor>
        {"  plan:    "}
        <Text color={color}>{plan.toUpperCase()}</Text>
      </Text>
      <Text dimColor>  expires: {new Date(result.expiresAt).toLocaleDateString()}</Text>
    </Box>
  );
}

export async function loginAction(opts: {
  apiKey?: string;
  username?: string;
  json: boolean;
  onExit: (code: number) => void;
}): Promise<{ result: LoginResult | null; error: { message: string; hint?: string } | null }> {
  let apiKey = opts.apiKey;
  let username = opts.username;

  // Interactive prompts when flags not provided
  if (!username) username = await prompt("Username:");
  if (!apiKey) {
    await promptSecret("Password:"); // collected for UX, not sent in Phase 2
    apiKey = await prompt("API Key (sk_live_6xargs_...):");
  }

  try {
    const result = await login(apiKey, username);

    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ firm: result.firm, expires_at: result.expiresAt }, null, 2) + "\n"
      );
      opts.onExit(EXIT.SUCCESS);
      return { result, error: null };
    }

    return { result, error: null };
  } catch (err) {
    const fmt = formatError(err);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: fmt.message, hint: fmt.hint }, null, 2) + "\n");
      opts.onExit(fmt.exitCode);
    }
    return { result: null, error: fmt };
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

interface LogoutProps extends ExitProps {
  hard: boolean;
}

export function LogoutCommand({ hard, onExit }: LogoutProps) {
  const { exit } = useApp();

  useEffect(() => {
    if (hard) hardLogout();
    else logout();

    const timer = setTimeout(() => {
      onExit(EXIT.SUCCESS);
      exit();
    }, 80);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>{hard ? "Credentials cleared." : "Session ended. API key retained."}</Text>
    </Box>
  );
}

// ── Whoami ────────────────────────────────────────────────────────────────────

interface WhoamiProps extends ExitProps {
  json: boolean;
}

export function WhoamiCommand({ json, onExit }: WhoamiProps) {
  const { exit } = useApp();
  const [status] = useState<AuthStatus>(() => getAuthStatus());

  useEffect(() => {
    if (json) {
      process.stdout.write(JSON.stringify(status, null, 2) + "\n");
      onExit(status.authenticated ? EXIT.SUCCESS : EXIT.AUTH_ERROR);
      exit();
      return;
    }

    const timer = setTimeout(() => {
      onExit(status.authenticated ? EXIT.SUCCESS : EXIT.AUTH_ERROR);
      exit();
    }, 80);
    return () => clearTimeout(timer);
  }, [json, status, exit, onExit]);

  if (!status.authenticated) {
    return (
      <ErrorBox
        message={status.expired ? "Session expired." : "Not logged in."}
        hint="Run: 6xargs login --api-key <your-key>"
      />
    );
  }

  const planColor = { starter: "yellow", pro: "cyan", enterprise: "magenta" } as const;
  const plan = status.plan ?? "starter";
  const color = planColor[plan] ?? "white";
  const daysLeft = status.expiresAt
    ? Math.ceil((status.expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color="green">●</Text>
        <Text bold>Authenticated</Text>
      </Box>
      {status.username && <Text dimColor>  user:    {status.username}</Text>}
      {status.firmName && <Text dimColor>  firm:    {status.firmName}</Text>}
      <Text dimColor>
        {"  plan:    "}
        <Text color={color}>{plan.toUpperCase()}</Text>
      </Text>
      {daysLeft !== null && (
        <Text dimColor>
          {"  expires: "}
          <Text color={daysLeft < 7 ? "yellow" : undefined}>
            {daysLeft}d
          </Text>
        </Text>
      )}
    </Box>
  );
}

// ── Token ─────────────────────────────────────────────────────────────────────

export function TokenCommand({ onExit }: ExitProps) {
  const { exit } = useApp();

  useEffect(() => {
    try {
      const jwt = getJwt();
      process.stdout.write(jwt + "\n");
      onExit(EXIT.SUCCESS);
    } catch (err) {
      const { message, hint } = formatError(err);
      process.stderr.write(`Error: ${message}\n`);
      if (hint) process.stderr.write(`  ${hint}\n`);
      onExit(EXIT.AUTH_ERROR);
    }
    exit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

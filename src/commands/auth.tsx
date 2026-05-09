import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Alert, Badge } from "../components/index.js";
import { login, logout, hardLogout, getAuthStatus, getJwt, maskApiKey } from "../lib/auth.js";
import { prompt, promptSecret } from "../lib/prompt.js";
import { formatError, EXIT } from "../lib/errors.js";
import { API_KEY_PATTERN } from "../lib/constants.js";
import type { LoginResult, AuthStatus } from "../lib/auth.js";

// ── Login ─────────────────────────────────────────────────────────────────────

interface ExitProps {
  onExit: (code: number) => void;
}

interface LoginProps extends ExitProps {
  result: LoginResult | null;
  error: { message: string; hint?: string; exitCode?: number } | null;
}

export function LoginOutput({ result, error, onExit }: LoginProps) {
  const { exit } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      onExit(error ? (error.exitCode ?? EXIT.AUTH_ERROR) : EXIT.SUCCESS);
      exit();
    }, 80);
    return () => clearTimeout(timer);
  }, [error, exit, onExit]);

  if (error) return <Alert message={error.message} hint={error.hint} />;
  if (!result) return null;

  const plan = result.firm.plan;

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text bold>Authenticated</Text>
      </Box>
      <Text dimColor>  firm:    {result.firm.name}</Text>
      <Box>
        <Text dimColor>{"  plan:    "}</Text>
        <Badge variant="plan" value={plan} />
      </Box>
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

  // Fast-fail on bad key format before interactive prompts
  if (opts.apiKey && !API_KEY_PATTERN.test(opts.apiKey)) {
    const fmt = {
      message: "API key format invalid. Expected: sk_live_6xargs_<24+ chars>",
      hint: "Run: 6xargs login --api-key <your-key>",
      exitCode: EXIT.USER_ERROR,
    };
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: fmt.message, hint: fmt.hint }, null, 2) + "\n");
      opts.onExit(EXIT.USER_ERROR);
    }
    return { result: null, error: fmt };
  }

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
      <Alert
        message={status.expired ? "Session expired." : "Not logged in."}
        hint="Run: 6xargs login --api-key <your-key>"
      />
    );
  }

  const plan = status.plan ?? "starter";
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
      <Box>
        <Text dimColor>{"  plan:    "}</Text>
        <Badge variant="plan" value={plan} />
      </Box>
      {daysLeft !== null && (
        <Box>
          <Text dimColor>{"  expires: "}</Text>
          <Text color={daysLeft < 7 ? "yellow" : undefined}>{daysLeft}d</Text>
        </Box>
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

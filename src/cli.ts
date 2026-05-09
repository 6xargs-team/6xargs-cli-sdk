import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { HealthCommand } from "./commands/health.js";
import {
  LoginOutput,
  LogoutCommand,
  WhoamiCommand,
  TokenCommand,
  loginAction,
} from "./commands/auth.js";
import {
  IngestUploadCommand,
  IngestStatusCommand,
  IngestListCommand,
  resolveFiles,
} from "./commands/ingest.js";
import {
  AskCommand,
  QueryHistoryCommand,
  QueryFeedbackCommand,
} from "./commands/query.js";
import {
  EngagementsListCommand,
  EngagementsShowCommand,
  EngagementsDeleteCommand,
} from "./commands/engagements.js";
import {
  FirmInfoCommand,
  FirmKeysListCommand,
  FirmKeysCreateCommand,
  FirmKeysRevokeCommand,
} from "./commands/firms.js";
import {
  configGet,
  configSet,
  configList,
  configReset,
  configSwitchProfile,
} from "./commands/config.js";
import { prompt } from "./lib/prompt.js";
import { VERSION } from "./lib/constants.js";
import { EXIT, UserError, formatError } from "./lib/errors.js";
import { switchProfile } from "./lib/config.js";

export interface GlobalOpts {
  json: boolean;
  format: string;
  debug: boolean;
  color: boolean;
  profile?: string;
  apiBase?: string;
  quiet: boolean;
}

function mkRender<P extends object>(Component: React.ComponentType<P>, props: P): Promise<number> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(React.createElement(Component, props));
    let code = 0;
    // onExit is injected via props — the component calls it before calling exit()
    void waitUntilExit().then(() => resolve(code));
    // Allow props to update code via the closure
    (props as { onExit?: (c: number) => void }).onExit = (c) => {
      code = c;
    };
  });
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name("6xargs")
    .description("Operational memory CLI for offensive security firms")
    .version(VERSION, "-v, --version", "Print CLI version")
    .option("--json", "Force JSON output", false)
    .option("--format <fmt>", "Output: table|json|yaml|raw", "table")
    .option("--debug", "Show HTTP requests and timing", false)
    .option("--no-color", "Disable colors")
    .option("--profile <name>", "Use named config profile")
    .option("--api-base <url>", "Override API base URL")
    .option("--quiet", "Suppress non-essential output", false);

  // Apply global flags before every command runs — process.env is non-persistent (not written to disk)
  program.hook("preAction", () => {
    const opts = program.opts<GlobalOpts>();
    if (opts.apiBase) process.env["SIXARGS_API_BASE"] = opts.apiBase;
    if (opts.profile) switchProfile(opts.profile);
  });

  // ── health ──────────────────────────────────────────────────────────────────
  program
    .command("health")
    .description("Check API availability and latency")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(HealthCommand, {
          json: opts.json,
          apiBase: opts.apiBase,
          onExit: (code: number) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── login ───────────────────────────────────────────────────────────────────
  program
    .command("login")
    .description("Authenticate with API key (interactive or --api-key)")
    .option("--api-key <key>", "API key (non-interactive)")
    .option("--username <name>", "Username (non-interactive)")
    .action(async (cmdOpts: { apiKey?: string; username?: string }) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { result, error } = await loginAction({
        apiKey: cmdOpts.apiKey,
        username: cmdOpts.username,
        json: opts.json,
        onExit: (code) => { exitCode = code; },
      });

      if (!opts.json) {
        const { waitUntilExit } = render(
          React.createElement(LoginOutput, {
            result,
            error,
            onExit: (code) => { exitCode = code; },
          })
        );
        await waitUntilExit();
      }

      process.exit(exitCode);
    });

  // ── logout ───────────────────────────────────────────────────────────────────
  program
    .command("logout")
    .description("End session (keeps API key). Use --hard to clear all credentials.")
    .option("--hard", "Remove API key too", false)
    .action(async (cmdOpts: { hard: boolean }) => {
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(LogoutCommand, {
          hard: cmdOpts.hard,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── whoami ───────────────────────────────────────────────────────────────────
  program
    .command("whoami")
    .description("Show current authentication status and firm info")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(WhoamiCommand, {
          json: opts.json,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── auth ─────────────────────────────────────────────────────────────────────
  const auth = program.command("auth").description("Authentication utilities");

  auth
    .command("token")
    .description("Print current JWT to stdout (for scripting)")
    .action(async () => {
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(TokenCommand, {
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── ingest ───────────────────────────────────────────────────────────────────
  const ingest = program.command("ingest").description("Manage engagement ingestion");

  ingest
    .command("upload <file>")
    .description("Upload a PDF, JSON, or CSV file (supports *.ext glob)")
    .option("--tags <tags>", "Comma-separated tags (e.g. fintech,ssrf)")
    .option("--wait", "Block until ingestion completes", false)
    .action(async (file: string, cmdOpts: { tags?: string; wait: boolean }) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      let filePaths: string[];
      try {
        filePaths = resolveFiles(file);
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(EXIT.USER_ERROR);
      }

      const tags = cmdOpts.tags ? cmdOpts.tags.split(",").map((t) => t.trim()) : [];

      const { waitUntilExit } = render(
        React.createElement(IngestUploadCommand, {
          filePaths,
          wait: cmdOpts.wait,
          tags,
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  ingest
    .command("status <job-id>")
    .description("Check ingestion job status")
    .action(async (jobId: string) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(IngestStatusCommand, {
          jobId,
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  ingest
    .command("list")
    .description("List recent ingestion jobs")
    .option("--status <status>", "Filter by status: pending|processing|completed|failed")
    .action(async (cmdOpts: { status?: string }) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(IngestListCommand, {
          status: cmdOpts.status,
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── ask / query ───────────────────────────────────────────────────────────────
  program
    .command("ask <query>")
    .description("Query the knowledge base (guide mode by default)")
    .option("--mode <mode>", "Response mode: guide|report", "guide")
    .option("--stream", "Stream response via SSE", false)
    .action(async (queryText: string, cmdOpts: { mode: string; stream: boolean }) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const mode = (cmdOpts.mode === "report" ? "report" : "guide") as "guide" | "report";

      const { waitUntilExit } = render(
        React.createElement(AskCommand, {
          query: queryText,
          mode,
          stream: cmdOpts.stream,
          outputFmt: opts.json ? "json" : opts.format,
          apiBase: opts.apiBase,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  const query = program.command("query").description("Query utilities");

  query
    .command("history")
    .description("Show recent queries")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;

      const { waitUntilExit } = render(
        React.createElement(QueryHistoryCommand, {
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  query
    .command("feedback <id>")
    .description("Submit query feedback")
    .option("--useful", "Mark as useful", false)
    .option("--not-useful", "Mark as not useful", false)
    .option("--reason <reason>", "Reason (used with --not-useful)")
    .action(async (id: string, cmdOpts: { useful: boolean; notUseful: boolean; reason?: string }) => {
      let exitCode = 0;
      const useful = cmdOpts.useful || !cmdOpts.notUseful;

      const { waitUntilExit } = render(
        React.createElement(QueryFeedbackCommand, {
          queryId: id,
          useful,
          reason: cmdOpts.reason,
          onExit: (code) => { exitCode = code; },
        })
      );

      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── engagements ───────────────────────────────────────────────────────────────
  const engagements = program.command("engagements").description("Manage indexed engagements");

  engagements
    .command("list")
    .description("List all indexed engagements")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(EngagementsListCommand, {
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  engagements
    .command("show <id>")
    .description("Show engagement detail")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(EngagementsShowCommand, {
          engagementId: id,
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  engagements
    .command("delete <id>")
    .description("Remove engagement from index")
    .option("--force", "Skip confirmation prompt", false)
    .action(async (id: string, cmdOpts: { force: boolean }) => {
      if (!cmdOpts.force) {
        const answer = await prompt(`Delete engagement ${id}? Type "yes" to confirm: `);
        if (answer.toLowerCase() !== "yes") {
          process.stdout.write("Cancelled.\n");
          process.exit(EXIT.SUCCESS);
        }
      }
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(EngagementsDeleteCommand, {
          engagementId: id,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── firm ──────────────────────────────────────────────────────────────────────
  const firm = program.command("firm").description("Firm account and API key management");

  firm
    .command("info")
    .description("Show firm details, plan, and usage")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(FirmInfoCommand, {
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  const firmKeys = firm.command("keys").description("API key management");

  firmKeys
    .command("list")
    .description("List API keys")
    .action(async () => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(FirmKeysListCommand, {
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  firmKeys
    .command("create")
    .description("Create a new API key")
    .requiredOption("--name <name>", "Key name (e.g. CI pipeline)")
    .action(async (cmdOpts: { name: string }) => {
      const opts = program.opts<GlobalOpts>();
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(FirmKeysCreateCommand, {
          name: cmdOpts.name,
          outputFmt: opts.json ? "json" : opts.format,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  firmKeys
    .command("revoke <id>")
    .description("Revoke an API key")
    .option("--force", "Skip confirmation prompt", false)
    .action(async (id: string, cmdOpts: { force: boolean }) => {
      if (!cmdOpts.force) {
        const answer = await prompt(`Revoke API key ${id}? Type "yes" to confirm: `);
        if (answer.toLowerCase() !== "yes") {
          process.stdout.write("Cancelled.\n");
          process.exit(EXIT.SUCCESS);
        }
      }
      let exitCode = 0;
      const { waitUntilExit } = render(
        React.createElement(FirmKeysRevokeCommand, {
          keyId: id,
          onExit: (code) => { exitCode = code; },
        })
      );
      await waitUntilExit();
      process.exit(exitCode);
    });

  // ── config ────────────────────────────────────────────────────────────────────
  const config = program.command("config").description("Manage CLI configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value (output_format, api_base)")
    .action((key: string, value: string) => {
      try {
        configSet(key, value);
      } catch (err) {
        const fmt = formatError(err);
        process.stderr.write(`Error: ${fmt.message}\n`);
        if (fmt.hint) process.stderr.write(`  ${fmt.hint}\n`);
        process.exit(fmt.exitCode);
      }
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action((key: string) => {
      try {
        configGet(key);
      } catch (err) {
        const fmt = formatError(err);
        process.stderr.write(`Error: ${fmt.message}\n`);
        if (fmt.hint) process.stderr.write(`  ${fmt.hint}\n`);
        process.exit(fmt.exitCode);
      }
    });

  config
    .command("list")
    .description("List all config values for all profiles")
    .action(() => {
      configList();
    });

  config
    .command("reset")
    .description("Reset config to defaults")
    .option("--force", "Skip confirmation prompt", false)
    .action(async (cmdOpts: { force: boolean }) => {
      if (!cmdOpts.force) {
        const answer = await prompt('Reset all config? Type "yes" to confirm: ');
        if (answer.toLowerCase() !== "yes") {
          process.stdout.write("Cancelled.\n");
          process.exit(EXIT.SUCCESS);
        }
      }
      configReset();
    });

  config
    .command("switch-profile <name>")
    .description("Switch to a named profile (creates it if missing)")
    .action((name: string) => {
      configSwitchProfile(name);
    });

  // ── version ──────────────────────────────────────────────────────────────────
  program
    .command("version")
    .description("Print CLI version")
    .action(() => {
      process.stdout.write(`6xargs CLI v${VERSION}\n`);
      process.exit(0);
    });

  return program;
}

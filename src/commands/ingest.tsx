import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { FormData } from "undici";
import { readFileSync, statSync, readdirSync, existsSync } from "fs";
import { extname, basename, dirname, join, resolve } from "path";
import { request } from "../lib/client.js";
import { format } from "../lib/output.js";
import { formatError, EXIT } from "../lib/errors.js";
import { UserError } from "../lib/errors.js";
import { INGEST_MAX_FILE_MB, INGEST_POLL_INTERVAL_MS } from "../lib/constants.js";
import { IngestionJobSchema } from "../types/api.js";
import type { IngestionJob } from "../types/api.js";

const ALLOWED_EXT = new Set([".pdf", ".json", ".csv"]);
const TERM_STATES = new Set(["completed", "failed"]);
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function expandGlob(pattern: string): string[] {
  if (!pattern.includes("*")) return [resolve(pattern)];

  const dir = resolve(dirname(pattern));
  const glob = basename(pattern);
  const ext = glob.startsWith("*") ? glob.slice(1) : "";

  if (!existsSync(dir)) throw new UserError(`Directory not found: ${dir}`);

  return readdirSync(dir)
    .filter((f) => (ext ? f.endsWith(ext) : true))
    .map((f) => join(dir, f));
}

function validateFile(filePath: string): void {
  if (!existsSync(filePath)) throw new UserError(`File not found: ${filePath}`);

  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new UserError(
      `Unsupported file type: ${ext}`,
      "Allowed types: .pdf, .json, .csv"
    );
  }

  const { size } = statSync(filePath);
  const mb = size / (1024 * 1024);
  if (mb > INGEST_MAX_FILE_MB) {
    throw new UserError(
      `File too large: ${mb.toFixed(1)}MB (max ${INGEST_MAX_FILE_MB}MB)`,
      "Split the file or contact support."
    );
  }
}

function mimeType(ext: string): string {
  return { ".pdf": "application/pdf", ".json": "application/json", ".csv": "text/csv" }[ext] ?? "application/octet-stream";
}

async function uploadFile(filePath: string, tags?: string[]): Promise<IngestionJob> {
  const ext = extname(filePath).toLowerCase();
  const buf = readFileSync(filePath);
  const name = basename(filePath);

  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeType(ext) }), name);
  if (tags?.length) form.append("tags", tags.join(","));

  return request("POST", "/api/v1/ingestion/upload", IngestionJobSchema, {
    formData: form,
    timeout: 120_000,
  });
}

async function pollJob(jobId: string, onUpdate: (job: IngestionJob) => void): Promise<IngestionJob> {
  const max = 150; // 5 minutes at 2s
  for (let i = 0; i < max; i++) {
    const job = await request(
      "GET",
      `/api/v1/ingestion/status/${jobId}`,
      IngestionJobSchema
    );
    onUpdate(job);
    if (TERM_STATES.has(job.status)) return job;
    await sleep(INGEST_POLL_INTERVAL_MS);
  }
  throw new UserError("Polling timed out after 5 minutes.", `Run: 6xargs ingest status ${jobId}`);
}

// ── Upload ────────────────────────────────────────────────────────────────────

interface UploadProps {
  filePaths: string[];
  wait: boolean;
  tags: string[];
  outputFmt: string;
  onExit: (code: number) => void;
}

export function IngestUploadCommand({ filePaths, wait, tags, outputFmt, onExit }: UploadProps) {
  const { exit } = useApp();
  const [frame, setFrame] = useState(0);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [phase, setPhase] = useState<"uploading" | "polling" | "done">("uploading");
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [currentFile, setCurrentFile] = useState(filePaths[0] ?? "");

  useEffect(() => {
    if (phase === "uploading" || phase === "polling") {
      const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80);
      return () => clearInterval(id);
    }
  }, [phase]);

  useEffect(() => {
    const run = async () => {
      const results: IngestionJob[] = [];

      for (const filePath of filePaths) {
        setCurrentFile(basename(filePath));
        try {
          validateFile(filePath);
        } catch (err) {
          const fmt = formatError(err);
          setError(fmt);
          setPhase("done");
          onExit(fmt.exitCode);
          exit();
          return;
        }
        const job = await uploadFile(filePath, tags);
        results.push(job);
        setJobs([...results]);
      }

      if (!wait) {
        setPhase("done");
        return;
      }

      setPhase("polling");
      const polled: IngestionJob[] = [];
      for (const job of results) {
        const final = await pollJob(job.id, (j) => {
          const idx = polled.findIndex((p) => p.id === j.id);
          if (idx >= 0) polled[idx] = j;
          else polled.push(j);
          setJobs([...polled]);
        });
        polled.push(final);
        setJobs([...polled]);
      }
      setPhase("done");
    };

    run()
      .catch((err: unknown) => {
        const fmt = formatError(err);
        setError(fmt);
        setPhase("done");
      })
      .finally(() => {
        const hasError = error !== null;
        onExit(hasError ? EXIT.API_ERROR : EXIT.SUCCESS);
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

  if (phase !== "done") {
    const label = phase === "polling" ? `Waiting for ${currentFile}...` : `Uploading ${currentFile}...`;
    return (
      <Box gap={1}>
        <Text color="cyan">{SPINNER[frame]}</Text>
        <Text>{label}</Text>
      </Box>
    );
  }

  if (outputFmt === "json") {
    process.stdout.write(format(jobs, "json"));
    return null;
  }

  return (
    <Box flexDirection="column">
      {jobs.map((job) => (
        <Box key={job.id} gap={1}>
          <Text color={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "yellow"}>
            {job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "○"}
          </Text>
          <Text>{job.filename}</Text>
          <Text dimColor>{job.id}</Text>
          <Text dimColor>({job.status})</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Status ────────────────────────────────────────────────────────────────────

interface StatusProps {
  jobId: string;
  outputFmt: string;
  onExit: (code: number) => void;
}

export function IngestStatusCommand({ jobId, outputFmt, onExit }: StatusProps) {
  const { exit } = useApp();
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    request("GET", `/api/v1/ingestion/status/${jobId}`, IngestionJobSchema)
      .then((j) => setJob(j))
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

  if (!job) return <Box gap={1}><Text color="cyan">⠋</Text><Text>Fetching status...</Text></Box>;

  if (outputFmt === "json") {
    process.stdout.write(format(job, "json"));
    return null;
  }

  const ok = job.status === "completed";
  const failed = job.status === "failed";
  const color = ok ? "green" : failed ? "red" : "yellow";

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={color}>{ok ? "✓" : failed ? "✗" : "○"}</Text>
        <Text bold>{job.status.toUpperCase()}</Text>
      </Box>
      <Text dimColor>  id:      {job.id}</Text>
      <Text dimColor>  file:    {job.filename}</Text>
      <Text dimColor>  started: {new Date(job.created_at).toLocaleString()}</Text>
      {job.completed_at && (
        <Text dimColor>  done:    {new Date(job.completed_at).toLocaleString()}</Text>
      )}
      {job.tags?.length ? <Text dimColor>  tags:    {job.tags.join(", ")}</Text> : null}
      {job.error && <Text color="red">  error:   {job.error}</Text>}
    </Box>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

const IngestListSchema = IngestionJobSchema.array();

interface ListProps {
  status?: string;
  outputFmt: string;
  onExit: (code: number) => void;
}

export function IngestListCommand({ status, outputFmt, onExit }: ListProps) {
  const { exit } = useApp();
  const [jobs, setJobs] = useState<IngestionJob[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    const query: Record<string, string> = {};
    if (status) query["status"] = status;

    request("GET", "/api/v1/ingestion/jobs", IngestListSchema, { query })
      .then((j) => setJobs(j))
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

  if (!jobs) return <Box gap={1}><Text color="cyan">⠋</Text><Text>Loading...</Text></Box>;

  if (outputFmt === "json") {
    process.stdout.write(format(jobs, "json"));
    return null;
  }

  const rows = jobs.map((j) => ({
    id: j.id,
    file: j.filename,
    status: j.status,
    started: new Date(j.created_at).toLocaleString(),
    tags: j.tags?.join(", ") ?? "-",
  }));

  process.stdout.write(format(rows, outputFmt));
  return null;
}

// ── Helpers exported for CLI wiring ─────────────────────────────────────────

export function resolveFiles(pattern: string): string[] {
  return expandGlob(pattern);
}

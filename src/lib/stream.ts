// SSE async generator for streaming query responses from the LangGraph agent.
// Reassembles data: lines across chunk boundaries. releaseLock() is always called in finally.
import { fetch } from "undici";
import { getApiBase, getCurrentProfile } from "./config.js";
import { USER_AGENT } from "./constants.js";
import { ApiError, AuthError } from "./errors.js";

export interface SSEEvent {
  type: "step" | "token" | "done" | "error";
  content: string;
}

export async function* streamQuery(
  query: string,
  mode: "guide" | "report",
  opts: { apiBase?: string } = {}
): AsyncGenerator<SSEEvent> {
  const profile = getCurrentProfile();

  if (!profile.jwt) {
    throw new AuthError("Not logged in.", "Run: 6xargs login --api-key <your-key>");
  }

  const base = getApiBase(opts.apiBase).replace(/\/$/, "");
  const url = `${base}/api/v1/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${profile.jwt}`,
      "user-agent": USER_AGENT,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({ query, mode, stream: true }),
    signal: AbortSignal.timeout(60_000),
  });

  if (res.status === 401) {
    throw new AuthError(
      "Authentication failed.",
      "Run: 6xargs login --api-key <your-key>"
    );
  }

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, "Try again or check API status.");
  }

  if (!res.body) throw new ApiError("Empty response body from stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          yield { type: "done", content: "" };
          return;
        }

        try {
          const evt = JSON.parse(data) as { type: SSEEvent["type"]; content: string };
          yield evt;
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

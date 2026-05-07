// Token lifecycle: validate API key format → exchange for JWT → persist to config → refresh on expiry.
// logout() keeps api_key so users can re-authenticate without re-entering it.
import { request } from "./client.js";
import { setProfileField, getCurrentProfile } from "./config.js";
import { AuthTokenResponseSchema } from "../types/api.js";
import { API_KEY_PATTERN } from "./constants.js";
import { UserError, AuthError } from "./errors.js";
import type { Plan } from "../types/config.js";

export interface LoginResult {
  firm: { id: string; name: string; plan: Plan };
  expiresAt: string;
}

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  firmName?: string;
  firmId?: string;
  plan?: Plan;
  expiresAt?: Date;
  expired?: boolean;
}

export function validateApiKey(key: string): void {
  if (!API_KEY_PATTERN.test(key)) {
    throw new UserError(
      "Invalid API key format. Expected: sk_live_6xargs_<24+ chars>",
      "Run: 6xargs login --api-key <your-key>"
    );
  }
}

export function maskApiKey(key: string): string {
  if (key.length < 24) return "sk_live_6xargs_***";
  return key.slice(0, 20) + "..." + key.slice(-4);
}

export async function login(
  apiKey: string,
  username?: string
): Promise<LoginResult> {
  validateApiKey(apiKey);

  const result = await request("POST", "/api/v1/auth/token", AuthTokenResponseSchema, {
    body: { api_key: apiKey },
    noAuth: true,
  });

  setProfileField("api_key", apiKey);
  setProfileField("jwt", result.jwt);
  setProfileField("jwt_expires_at", result.expires_at);
  setProfileField("firm_id", result.firm.id);
  setProfileField("firm_name", result.firm.name);
  setProfileField("plan", result.firm.plan);
  if (username) setProfileField("username", username);

  return { firm: result.firm, expiresAt: result.expires_at };
}

export function logout(): void {
  setProfileField("jwt", undefined);
  setProfileField("jwt_expires_at", undefined);
  // Keep api_key so the user can re-login without re-entering it
}

export function hardLogout(): void {
  setProfileField("api_key", undefined);
  setProfileField("jwt", undefined);
  setProfileField("jwt_expires_at", undefined);
  setProfileField("firm_id", undefined);
  setProfileField("firm_name", undefined);
  setProfileField("plan", undefined);
  setProfileField("username", undefined);
}

export function getAuthStatus(): AuthStatus {
  const profile = getCurrentProfile();

  if (!profile.jwt) {
    return { authenticated: false };
  }

  const expiresAt = profile.jwt_expires_at ? new Date(profile.jwt_expires_at) : null;

  if (expiresAt && expiresAt < new Date()) {
    return { authenticated: false, expired: true };
  }

  return {
    authenticated: true,
    username: profile.username,
    firmName: profile.firm_name,
    firmId: profile.firm_id,
    plan: profile.plan,
    expiresAt: expiresAt ?? undefined,
  };
}

export function getJwt(): string {
  const profile = getCurrentProfile();

  if (!profile.jwt) {
    throw new AuthError(
      "Not logged in.",
      "Run: 6xargs login --api-key <your-key>"
    );
  }

  const expiresAt = profile.jwt_expires_at ? new Date(profile.jwt_expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    throw new AuthError(
      "Session expired.",
      "Run: 6xargs login to re-authenticate."
    );
  }

  return profile.jwt;
}

export async function refreshToken(): Promise<void> {
  const profile = getCurrentProfile();
  const apiKey = profile.api_key;

  if (!apiKey) {
    throw new AuthError(
      "Cannot refresh: no API key stored.",
      "Run: 6xargs login --api-key <your-key>"
    );
  }

  const result = await request("POST", "/api/v1/auth/token", AuthTokenResponseSchema, {
    body: { api_key: apiKey },
    noAuth: true,
  });

  setProfileField("jwt", result.jwt);
  setProfileField("jwt_expires_at", result.expires_at);
}

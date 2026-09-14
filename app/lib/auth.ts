// Shared by proxy.ts (runs on the Edge runtime) and the login/logout actions
// (Node). Uses only Web Crypto, which exists in both runtimes, so there is one
// implementation instead of two.

export const AUTH_COOKIE = "rf_auth";

// How long a session stays valid, in both the `session` row and the cookie.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// SHA-256 of the input, as a hex string.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// A random, unguessable session token: 32 bytes (256 bits) from the platform's
// CSPRNG, hex-encoded. This is the value that goes in the cookie.
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The `session` table stores SHA-256(token), never the raw token, so a leaked
// table (a DB backup, a misconfigured export) hands out hashes that can't be
// turned back into a cookie someone could replay, same reasoning as hashing
// the password instead of storing it.
export function sessionId(token: string): Promise<string> {
  return sha256Hex(token);
}

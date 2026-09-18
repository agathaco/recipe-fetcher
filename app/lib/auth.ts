// Session/token helpers shared by proxy.ts and the login/logout/signup
// actions, plus password hashing for real accounts (bcryptjs). The
// session-token helpers use only Web Crypto, which exists in both Edge and
// Node, so this one implementation is portable rather than tied to whichever
// runtime Proxy happens to use (Next 16 defaults Proxy to the Node.js
// runtime, not Edge; older Next versions, and this file's own comment until
// 16/09, assumed Edge, that assumption was wrong for this app).

import bcrypt from "bcryptjs";

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

// Password hashing for real accounts (bcryptjs, pure JS, no native binary to
// compile, which matters for serverless cold starts). Deliberately not
// sha256Hex: bcrypt is salted per-hash and slow on purpose, so a leaked
// `user` table can't be cracked offline just by hashing a big password list
// once and comparing, the way it could against a bare SHA-256 digest. A
// session token (256 bits of fresh randomness, see randomToken) doesn't need
// this, there's nothing to guess; a human-chosen password does.
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// bcrypt.compare is constant-time internally (it re-derives the hash from
// the candidate and compares digests, not characters of the password), so
// this replaces the manual timingSafeEqual() this file had for the old
// single-shared-password model, that model is gone, this is its successor.
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

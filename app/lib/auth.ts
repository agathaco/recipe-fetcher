// Shared by proxy.ts and the login/logout actions. Uses only Web Crypto, which
// exists in both Edge and Node, so this one implementation is portable rather
// than tied to whichever runtime Proxy happens to use (Next 16 defaults Proxy
// to the Node.js runtime, not Edge; older Next versions, and this file's own
// comment until 16/09, assumed Edge, that assumption was wrong for this app).

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

// Constant-time string comparison: touches every character regardless of
// where the first mismatch is, so response timing can't be used to narrow
// down a guess character by character. `!==` on the raw password does not
// have this property (JS string equality can short-circuit at the first
// differing character).
export function timingSafeEqual(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  // Comparing against a fixed-length copy of `b` keeps the loop length
  // independent of `a`'s length too, not just which byte differs.
  const paddedA = new Uint8Array(bytesB.length);
  paddedA.set(bytesA.subarray(0, bytesB.length));
  let diff = bytesA.length ^ bytesB.length;
  for (let i = 0; i < bytesB.length; i++) {
    diff |= paddedA[i] ^ bytesB[i];
  }
  return diff === 0;
}

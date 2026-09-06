// Shared by proxy.ts (runs on the Edge runtime) and the login action (Node).
// Uses only Web Crypto and TextEncoder, both of which exist in both runtimes,
// so there is one implementation instead of two.

export const AUTH_COOKIE = "rf_auth";

// SHA-256 of the input, as a hex string.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The value the auth cookie should hold when signed in: the digest of the
// configured password. Storing the digest, not the password, means a leaked
// cookie does not hand over the secret in plaintext (it can still be replayed,
// which is an accepted tradeoff for a one-person app).
// Returns null when no password is configured, e.g. local dev before .env is set,
// which the proxy treats as "gate disabled".
export async function expectedAuthCookie(): Promise<string | null> {
  const secret = process.env.APP_PASSWORD;
  if (!secret) return null;
  return sha256Hex(secret);
}

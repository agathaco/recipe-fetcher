import { describe, expect, it } from "vitest";

import { AUTH_COOKIE, randomToken, sessionId, sha256Hex } from "./auth";

describe("sha256Hex", () => {
  it("produces the known SHA-256 hex of a string", async () => {
    // echo -n "letmein" | shasum -a 256
    expect(await sha256Hex("letmein")).toBe(
      "1c8bfe8f801d79745c4631d09fff36c82aa37fc4cce4fc946683d7b336b63032",
    );
  });

  it("is deterministic", async () => {
    expect(await sha256Hex("abc")).toBe(await sha256Hex("abc"));
  });
});

describe("randomToken", () => {
  it("returns a 64-char hex string (32 random bytes)", () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is different on every call", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("sessionId", () => {
  it("is the SHA-256 hex of the token", async () => {
    const token = randomToken();
    expect(await sessionId(token)).toBe(await sha256Hex(token));
  });

  it("never equals the raw token", async () => {
    const token = randomToken();
    expect(await sessionId(token)).not.toBe(token);
  });
});

describe("AUTH_COOKIE", () => {
  it("is a stable name", () => {
    expect(AUTH_COOKIE).toBe("rf_auth");
  });
});

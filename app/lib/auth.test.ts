import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE,
  hashPassword,
  randomToken,
  sessionId,
  sha256Hex,
  verifyPassword,
} from "./auth";

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

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  // bcryptjs is pure JS (no native binary, see DECISIONS), so 12-round hashing
  // is genuinely slow, this test does four such operations (two hashes, two
  // verifies), past Vitest's default 5s test timeout on a loaded machine.
  // Not a bug, just a slow-test budget, hence the explicit longer timeout.
  it(
    "salts each hash differently, even for the same password",
    async () => {
      const [a, b] = await Promise.all([hashPassword("hunter2"), hashPassword("hunter2")]);
      expect(a).not.toBe(b);
      // ...but both still verify the same plaintext, since bcrypt embeds the
      // salt in the hash string itself rather than needing it passed back in.
      expect(await verifyPassword("hunter2", a)).toBe(true);
      expect(await verifyPassword("hunter2", b)).toBe(true);
    },
    15_000,
  );
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE, expectedAuthCookie, sha256Hex } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe("expectedAuthCookie", () => {
  it("returns null when APP_PASSWORD is unset", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(await expectedAuthCookie()).toBeNull();
  });

  it("returns the digest of APP_PASSWORD when set", async () => {
    vi.stubEnv("APP_PASSWORD", "letmein");
    expect(await expectedAuthCookie()).toBe(await sha256Hex("letmein"));
  });
});

describe("AUTH_COOKIE", () => {
  it("is a stable name", () => {
    expect(AUTH_COOKIE).toBe("rf_auth");
  });
});

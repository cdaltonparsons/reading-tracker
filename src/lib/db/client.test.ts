// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({})),
}));
vi.mock("@libsql/client", () => ({ createClient }));
// Wrapping is Drizzle's job; keep the fake client from being inspected.
vi.mock("drizzle-orm/libsql", () => ({ drizzle: () => ({}) }));

beforeEach(() => {
  vi.resetModules();
  createClient.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("getDb", () => {
  it("opens nothing on import, and reuses one instance", async () => {
    const { getDb } = await import("./client");
    expect(createClient).not.toHaveBeenCalled();
    const first = getDb();
    expect(getDb()).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("defaults to a local file when no URL is set", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");
    const { getDb } = await import("./client");
    getDb();
    expect(createClient).toHaveBeenCalledWith({
      url: "file:local.db",
      authToken: undefined,
    });
  });
});

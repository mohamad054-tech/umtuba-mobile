import { describe, expect, it, vi } from "vitest";

import {
  createAuthStorageAdapter,
  isUsableStoredValue,
  SECURE_STORE_SAFE_BYTES,
  utf8ByteLength,
} from "./authStorage";

function memoryDeps(platform = "android") {
  const secure = new Map<string, string>();
  const asyncStore = new Map<string, string>();
  const secureSet = vi.fn(async (key: string, value: string) => {
    secure.set(key, value);
  });
  const secureRemove = vi.fn(async (key: string) => {
    secure.delete(key);
  });
  return {
    secure,
    asyncStore,
    adapter: createAuthStorageAdapter({
      platform,
      secureGet: async (key) => secure.get(key) ?? null,
      secureSet,
      secureRemove,
      asyncGet: async (key) => asyncStore.get(key) ?? null,
      asyncSet: async (key, value) => {
        asyncStore.set(key, value);
      },
      asyncRemove: async (key) => {
        asyncStore.delete(key);
      },
    }),
    secureSet,
    secureRemove,
  };
}

describe("auth session storage", () => {
  it("never treats empty SecureStore as a hit", () => {
    expect(isUsableStoredValue(null)).toBe(false);
    expect(isUsableStoredValue("")).toBe(false);
    expect(isUsableStoredValue("{}")).toBe(true);
  });

  it("keeps a durable AsyncStorage copy after a SecureStore write", async () => {
    const { adapter, asyncStore, secure } = memoryDeps();
    await adapter.setItem("sb-auth-token", '{"refresh_token":"r1"}');
    expect(asyncStore.get("sb-auth-token")).toBe('{"refresh_token":"r1"}');
    expect(secure.get("sb-auth-token")).toBe('{"refresh_token":"r1"}');
  });

  it("still restores from AsyncStorage if SecureStore later misses", async () => {
    const { adapter, secure } = memoryDeps();
    await adapter.setItem("sb-auth-token", '{"refresh_token":"r1"}');
    secure.delete("sb-auth-token");
    await expect(adapter.getItem("sb-auth-token")).resolves.toBe(
      '{"refresh_token":"r1"}'
    );
  });

  it("skips SecureStore for oversized session JSON", async () => {
    const { adapter, secureSet, asyncStore, secure } = memoryDeps();
    const huge = "x".repeat(SECURE_STORE_SAFE_BYTES + 50);
    await adapter.setItem("sb-auth-token", huge);
    expect(secureSet).not.toHaveBeenCalled();
    expect(asyncStore.get("sb-auth-token")).toBe(huge);
    expect(secure.has("sb-auth-token")).toBe(false);
    expect(utf8ByteLength(huge)).toBeGreaterThan(SECURE_STORE_SAFE_BYTES);
  });

  it("falls back to AsyncStorage when SecureStore get throws", async () => {
    const asyncStore = new Map<string, string>([
      ["sb-auth-token", '{"refresh_token":"r1"}'],
    ]);
    const adapter = createAuthStorageAdapter({
      platform: "android",
      secureGet: async () => {
        throw new Error("decrypt failed");
      },
      secureSet: async () => undefined,
      secureRemove: async () => undefined,
      asyncGet: async (key) => asyncStore.get(key) ?? null,
      asyncSet: async (key, value) => {
        asyncStore.set(key, value);
      },
      asyncRemove: async (key) => {
        asyncStore.delete(key);
      },
    });
    await expect(adapter.getItem("sb-auth-token")).resolves.toBe(
      '{"refresh_token":"r1"}'
    );
  });

  it("clears both stores on logout", async () => {
    const { adapter, asyncStore, secure } = memoryDeps();
    await adapter.setItem("sb-auth-token", '{"refresh_token":"r1"}');
    await adapter.removeItem("sb-auth-token");
    expect(asyncStore.has("sb-auth-token")).toBe(false);
    expect(secure.has("sb-auth-token")).toBe(false);
  });

  it("uses only AsyncStorage on web", async () => {
    const { adapter, secureSet, asyncStore } = memoryDeps("web");
    await adapter.setItem("sb-auth-token", '{"refresh_token":"r1"}');
    expect(secureSet).not.toHaveBeenCalled();
    expect(asyncStore.get("sb-auth-token")).toBe('{"refresh_token":"r1"}');
  });
});

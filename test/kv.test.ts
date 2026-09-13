import { describe, expect, it } from "vitest";
import { mockKV } from "../src";

describe("mockKV", () => {
  it("stores text, JSON and metadata", async () => {
    const kv = mockKV<{ source: string }>();
    await kv.put("user:1", JSON.stringify({ active: true }), {
      metadata: { source: "test" },
    });

    await expect(kv.get("user:1", "json")).resolves.toEqual({ active: true });
    await expect(kv.getWithMetadata("user:1")).resolves.toEqual({
      value: JSON.stringify({ active: true }),
      metadata: { source: "test" },
    });
  });

  it("lists by prefix and expires values", async () => {
    const kv = mockKV();
    await kv.put("auth:a", "1");
    await kv.put("auth:b", "2");
    await kv.put("other", "3");
    await kv.put("expired", "x", { expiration: 1 });

    const result = await kv.list({ prefix: "auth:", limit: 1 });
    expect(result.keys.map((key) => key.name)).toEqual(["auth:a"]);
    expect(result.list_complete).toBe(false);
    await expect(kv.get("expired")).resolves.toBeNull();
  });
});

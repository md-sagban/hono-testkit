import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Hono testkit inside workerd", () => {
  it("runs a Hono route with every mock binding", async () => {
    const worker = (exports as unknown as { default: {
      fetch(request: Request): Promise<Response>;
    } }).default;
    const response = await worker.fetch(
      new Request("https://test.local/runtime", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "created-in-workerd" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      count: 1,
      cached: "created-in-workerd",
      backgroundFinished: "yes",
      file: "created-in-workerd",
      queued: [{ name: "created-in-workerd" }],
      profile: { runtime: "workerd" },
    });
  });
});

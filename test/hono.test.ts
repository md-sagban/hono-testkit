import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createHonoTestHarness, mockExecutionContext, mockKV } from "../src";

describe("Hono test helpers", () => {
  it("injects bindings into a request", async () => {
    const app = new Hono<{ Bindings: { CACHE: ReturnType<typeof mockKV> } }>();
    app.post("/counter", async (c) => {
      await c.env.CACHE.put("count", "1");
      return c.json({ stored: await c.env.CACHE.get("count") });
    });

    const harness = createHonoTestHarness(app, { CACHE: mockKV() });
    const response = await harness.post("/counter");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ stored: "1" });
  });

  it("drains waitUntil promises", async () => {
    const context = mockExecutionContext();
    let finished = false;
    context.waitUntil(Promise.resolve().then(() => { finished = true; }));
    await context.drain();
    expect(finished).toBe(true);
  });

  it("posts FormData without overriding its boundary", async () => {
    const app = new Hono();
    app.post("/form", async (c) => c.json(await c.req.parseBody()));
    const harness = createHonoTestHarness(app, {});
    const form = new FormData();
    form.set("name", "test");

    const response = await harness.post("/form", form);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ name: "test" });
  });

  it("builds authenticated JSON requests with headers and cookies", async () => {
    const app = new Hono();
    app.put("/inspect", async (c) =>
      c.json({
        method: c.req.method,
        authorization: c.req.header("authorization"),
        custom: c.req.header("x-custom"),
        cookie: c.req.header("cookie"),
        body: await c.req.json(),
      }));
    const harness = createHonoTestHarness(app, {});

    const response = await harness
      .build("/inspect")
      .headers({ "x-custom": "one" })
      .header("x-custom", "two")
      .bearer("secret")
      .cookie("session", "abc")
      .cookie("theme", "dark")
      .json({ enabled: true })
      .put();

    await expect(response.json()).resolves.toEqual({
      method: "PUT",
      authorization: "Bearer secret",
      custom: "two",
      cookie: "session=abc; theme=dark",
      body: { enabled: true },
    });
  });

  it("supports raw bodies and the remaining request builder methods", async () => {
    const app = new Hono();
    app.all("/method", async (c) =>
      c.json({ method: c.req.method, body: await c.req.text() }));
    const harness = createHonoTestHarness(app, {});

    await expect(
      (await harness.build("/method").body("raw").patch()).json(),
    ).resolves.toEqual({ method: "PATCH", body: "raw" });
    await expect(
      (await harness.build("/method").delete()).json(),
    ).resolves.toEqual({ method: "DELETE", body: "" });
    await expect(
      (await harness.build("/method").get()).json(),
    ).resolves.toEqual({ method: "GET", body: "" });
    await expect(
      (await harness.build("/method").send("OPTIONS")).json(),
    ).resolves.toEqual({ method: "OPTIONS", body: "" });
  });
});

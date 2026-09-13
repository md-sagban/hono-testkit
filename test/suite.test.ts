import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createHonoTestSuite, mockKV } from "../src";

describe("createHonoTestSuite", () => {
  it("creates fresh bindings when reset", async () => {
    type Bindings = { CACHE: ReturnType<typeof mockKV> };
    const app = new Hono<{ Bindings: Bindings }>();
    app.get("/value", async (c) => {
      const value = await c.env.CACHE.get("value");
      return c.text(typeof value === "string" ? value : "empty");
    });

    const suite = await createHonoTestSuite<Bindings>(app, () => ({
      CACHE: mockKV(),
    }));
    await suite.bindings.CACHE.put("value", "old");
    await expect((await suite.get("/value")).text()).resolves.toBe("old");

    await suite.reset();
    await expect((await suite.get("/value")).text()).resolves.toBe("empty");
    await suite.dispose();
  });

  it("builds authenticated JSON and form-data requests", async () => {
    const app = new Hono();
    app.post("/inspect", async (c) =>
      c.json({
        authorization: c.req.header("authorization"),
        cookie: c.req.header("cookie"),
        contentType: c.req.header("content-type"),
        body: await c.req.parseBody(),
      }));

    const suite = await createHonoTestSuite(app, () => ({}));
    const form = new FormData();
    form.set("name", "Mohammed");
    const response = await suite
      .build("/inspect")
      .bearer("token")
      .cookie("session", "abc")
      .formData(form)
      .post();
    const result = await response.json() as Record<string, unknown>;

    expect(result.authorization).toBe("Bearer token");
    expect(result.cookie).toBe("session=abc");
    expect(result.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(result.body).toEqual({ name: "Mohammed" });
  });
});

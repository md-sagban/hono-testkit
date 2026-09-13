/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  asBinding,
  createHonoTestHarness,
  createHonoTestSuite,
  mockD1,
  mockExecutionContext,
  mockKV,
  mockQueue,
  mockR2,
  mockService,
} from "../src";

describe("Hono binding inference", () => {
  it("infers bindings from the supplied bindings and factory", async () => {
    const bindings = {
      CACHE: mockKV(),
      JOBS: mockQueue<{ id: number }>(),
    };
    const app = new Hono<{ Bindings: typeof bindings }>();

    const harness = createHonoTestHarness(app, bindings);
    const suite = await createHonoTestSuite(app, () => bindings);

    expectTypeOf(harness.bindings).toEqualTypeOf<typeof bindings>();
    expectTypeOf(suite.bindings).toEqualTypeOf<typeof bindings>();
    expect(harness.bindings.CACHE).toBe(bindings.CACHE);
    await suite.dispose();
  });
});

describe("binding type adapters", () => {
  it("preserves mock helpers with generated Cloudflare binding types", async () => {
    const CACHE = asBinding<KVNamespace>()(mockKV());
    const FILES = asBinding<R2Bucket>()(mockR2());
    const EMAILS = asBinding<Queue<{ email: string }>>()(mockQueue<{ email: string }>());
    const API = asBinding<Fetcher>()(mockService(() => new Response("ok")));
    const DB = asBinding<D1Database>()(await mockD1());
    const executionContext = asBinding<ExecutionContext>()(
      mockExecutionContext(),
    );

    await CACHE.put("key", "value");
    await EMAILS.send({ email: "test@example.com" });
    await DB.exec("CREATE TABLE type_check (id INTEGER)");

    expect(CACHE.has("key")).toBe(true);
    expect(FILES.size()).toBe(0);
    expect(EMAILS.messages).toHaveLength(1);
    expect((await API.fetch("https://service.test")).status).toBe(200);
    expect(DB.dump().byteLength).toBeGreaterThan(0);
    expect(executionContext.props).toEqual({});
    DB.close();
  });
});

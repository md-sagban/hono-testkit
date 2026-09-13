import { Hono } from "hono";
import {
  createHonoTestHarness,
  mockD1,
  mockKV,
  mockQueue,
  mockR2,
  mockService,
} from "../../src";

const bindings = {
  CACHE: mockKV(),
  DB: await mockD1({
    schema: "CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
  }),
  FILES: mockR2(),
  JOBS: mockQueue<{ name: string }>(),
  PROFILE_API: mockService(() => Response.json({ runtime: "workerd" })),
};

const app = new Hono<{ Bindings: typeof bindings }>();

app.post("/runtime", async (c) => {
  const { name } = await c.req.json<{ name: string }>();

  await c.env.CACHE.put("last-event", name);
  await c.env.DB.prepare("INSERT INTO events (name) VALUES (?)").bind(name).run();
  await c.env.FILES.put("event.txt", name);
  await c.env.JOBS.send({ name });
  const profile = await c.env.PROFILE_API.fetch("https://profile.test/me");

  c.executionCtx.waitUntil(c.env.CACHE.put("background-finished", "yes"));

  const count = await c.env.DB
    .prepare<{ count: number }>("SELECT COUNT(*) AS count FROM events")
    .first("count");

  return c.json({
    count,
    cached: await c.env.CACHE.get("last-event"),
    backgroundFinished: await c.env.CACHE.get("background-finished"),
    file: await (await c.env.FILES.get("event.txt"))?.text(),
    queued: c.env.JOBS.messages.map((message) => message.body),
    profile: await profile.json(),
  });
});

const harness = createHonoTestHarness(app, bindings);

export default {
  async fetch(request: Request) {
    const response = await harness.request(request);
    await harness.executionContext.drain();
    return response;
  },
};

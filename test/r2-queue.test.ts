import { describe, expect, it } from "vitest";
import { mockQueue, mockR2 } from "../src";

describe("mockR2", () => {
  it("stores and retrieves objects", async () => {
    const bucket = mockR2();
    await bucket.put("docs/report.txt", "hello", {
      customMetadata: { owner: "user-1" },
    });

    const object = await bucket.get("docs/report.txt");
    expect(await object?.text()).toBe("hello");
    expect(object?.customMetadata).toEqual({ owner: "user-1" });
    expect((await bucket.list({ prefix: "docs/" })).objects).toHaveLength(1);
  });

  it("supports object body helpers and HTTP metadata", async () => {
    const bucket = mockR2();
    const stored = await bucket.put("profile.json", JSON.stringify({ active: true }), {
      httpMetadata: { contentType: "application/json" },
    });

    expect(stored?.key).toBe("profile.json");
    expect(stored?.size).toBeGreaterThan(0);
    expect(await stored?.json()).toEqual({ active: true });
    expect(await stored?.blob()).toBeInstanceOf(Blob);
    expect((await stored?.arrayBuffer())?.byteLength).toBeGreaterThan(0);

    const headers = new Headers();
    stored?.writeHttpMetadata(headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect((await bucket.head("profile.json"))?.etag).toBe(stored?.etag);
  });

  it("paginates, deletes and clears stored objects", async () => {
    const bucket = mockR2();
    await bucket.put("a.txt", "a");
    await bucket.put("b.txt", "b");
    await bucket.put("c.txt", "c");

    const firstPage = await bucket.list({ limit: 2 });
    expect(firstPage.objects.map((object) => object.key)).toEqual(["a.txt", "b.txt"]);
    expect(firstPage.truncated).toBe(true);
    expect(firstPage.cursor).toBe("2");

    const secondPage = await bucket.list({ cursor: firstPage.cursor });
    expect(secondPage.objects.map((object) => object.key)).toEqual(["c.txt"]);
    expect(secondPage.truncated).toBe(false);

    await bucket.delete(["a.txt", "b.txt"]);
    expect(bucket.has("a.txt")).toBe(false);
    expect(bucket.size()).toBe(1);

    await bucket.put("c.txt", null);
    expect(await bucket.get("c.txt")).toBeNull();

    await bucket.put("remaining.txt", "value");
    bucket.clear();
    expect(bucket.size()).toBe(0);
  });
});

describe("mockQueue", () => {
  it("captures sent messages", async () => {
    const queue = mockQueue<{ email: string }>();
    await queue.send({ email: "test@example.com" });
    expect(queue.messages).toHaveLength(1);
    expect(queue.messages[0]?.body.email).toBe("test@example.com");
  });

  it("captures batches and supports draining and clearing", async () => {
    const queue = mockQueue<{ id: number }>();
    await queue.sendBatch([
      { body: { id: 1 }, contentType: "json" },
      { body: { id: 2 }, delaySeconds: 10 },
    ]);

    expect(queue.messages).toHaveLength(2);
    expect(queue.messages[0]).toMatchObject({ body: { id: 1 }, contentType: "json" });
    expect(queue.messages[1]).toMatchObject({ body: { id: 2 }, delaySeconds: 10 });
    expect(queue.messages[0]?.timestamp).toBeInstanceOf(Date);

    const drained = queue.drain();
    expect(drained.map((message) => message.body.id)).toEqual([1, 2]);
    expect(queue.messages).toHaveLength(0);

    await queue.send({ id: 3 });
    queue.clear();
    expect(queue.messages).toHaveLength(0);
  });
});

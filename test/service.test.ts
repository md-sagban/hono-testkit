import { describe, expect, it } from "vitest";
import { mockService } from "../src";

describe("mockService", () => {
  it("captures requests and returns handler responses", async () => {
    const service = mockService(async (request) =>
      Response.json({ method: request.method }));

    const response = await service.fetch("https://payments.test/charge", {
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({ method: "POST" });
    expect(service.lastRequest?.url).toBe("https://payments.test/charge");
  });

  it("can fail exactly one request", async () => {
    const service = mockService(() => new Response("ok"));
    service.failNext(new Error("offline"));

    await expect(service.fetch("https://service.test")).rejects.toThrow("offline");
    await expect((await service.fetch("https://service.test")).text()).resolves.toBe("ok");
  });
});

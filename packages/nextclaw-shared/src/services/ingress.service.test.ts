import { describe, expect, it, vi } from "vitest";
import { Ingress } from "./ingress.service.js";

describe("Ingress", () => {
  it("handles envelopes by registered type", async () => {
    const ingress = new Ingress();
    const handler = vi.fn(() => ({ accepted: true }));

    ingress.addHandler("channel.message.submit", handler);

    await expect(ingress.handle(
      { type: " channel.message.submit ", payload: { text: "hello" } },
      { source: "test" },
    )).resolves.toEqual({ accepted: true });
    expect(handler).toHaveBeenCalledWith(
      { type: " channel.message.submit ", payload: { text: "hello" } },
      { source: "test" },
    );
  });

  it("rejects unknown ingress types", async () => {
    const ingress = new Ingress();

    await expect(ingress.handle(
      { type: "missing" },
      { source: "test" },
    )).rejects.toThrow("Unsupported ingress type: missing");
  });
});

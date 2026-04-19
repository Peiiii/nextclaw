import { afterEach, describe, expect, it, vi } from "vitest";
import { createNappClient } from "./napp-client.service.js";

describe("NappClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls manifest and run endpoints through the host bridge", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/__napp/manifest")) {
        return new Response(
          JSON.stringify({
            ok: true,
            manifest: {
              id: "nextclaw.hello-notes",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            action: JSON.parse(String(init?.body)).action,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createNappClient("http://127.0.0.1:3100");
    await expect(client.getManifest()).resolves.toMatchObject({
      manifest: {
        id: "nextclaw.hello-notes",
      },
    });
    await expect(client.runAction("summarizeNotes")).resolves.toMatchObject({
      result: {
        action: "summarizeNotes",
      },
    });
  });
});

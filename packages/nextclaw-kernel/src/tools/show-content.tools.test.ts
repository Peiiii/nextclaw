import { describe, expect, it } from "vitest";
import { ShowContentTool } from "./show-content.tools.js";

describe("ShowContentTool", () => {
  it("returns a normalized showContent request for a file target", async () => {
    const result = await new ShowContentTool().execute({
      type: "file",
      title: "README",
      purpose: "read",
      payload: {
        path: "README.md",
        line: 3,
      },
    });

    expect(result).toEqual({
      ok: true,
      action: "showContent",
      request: {
        target: {
          type: "file",
          payload: {
            path: "README.md",
            line: 3,
            column: undefined,
          },
        },
        title: "README",
        purpose: "read",
      },
    });
  });

  it("rejects a URL target outside http and https", async () => {
    await expect(
      new ShowContentTool().execute({
        type: "url",
        payload: {
          url: "file:///tmp/example.md",
        },
      }),
    ).rejects.toThrow("payload.url must use http or https.");
  });
});

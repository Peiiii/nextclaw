import { describe, expect, it } from "vitest";
import { writeResponsesUpstreamStream } from "./codex-openai-responses-stream-writer.utils.js";

type WrittenEvent = {
  event: string;
  data: Record<string, unknown>;
};

class FakeServerResponse {
  readonly chunks: string[] = [];

  statusCode = 0;

  end = (): void => {};

  setHeader = (): void => {};

  write = (chunk: string): void => {
    this.chunks.push(chunk);
  };

  events = (): WrittenEvent[] => {
    return this.chunks
      .join("")
      .trim()
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const lines = block.split("\n");
        const event = lines
          .find((line) => line.startsWith("event: "))
          ?.slice("event: ".length);
        const data = lines
          .find((line) => line.startsWith("data: "))
          ?.slice("data: ".length);
        if (!event || !data) {
          throw new Error(`Invalid SSE block: ${block}`);
        }
        return { event, data: JSON.parse(data) as Record<string, unknown> };
      });
  };
}

function sseResponse(chunks: Record<string, unknown>[]): Response {
  const body = chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("");
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("OpenAI responses stream writer", () => {
  it("emits a single reasoning delta channel per upstream reasoning delta", async () => {
    const response = new FakeServerResponse();

    await writeResponsesUpstreamStream({
      response: response as never,
      responseId: "response-1",
      model: "model-1",
      upstreamResponse: sseResponse([
        {
          choices: [{ delta: { reasoning_content: "The" } }],
        },
        {
          choices: [{ delta: { reasoning_content: " user" } }],
        },
      ]),
    });

    const events = response.events();
    expect(events.filter((event) => event.event === "response.reasoning_summary_text.delta"))
      .toHaveLength(2);
    expect(events.filter((event) => event.event === "response.reasoning_text.delta"))
      .toHaveLength(0);
  });

  it("preserves leading spaces in streamed tool call argument deltas", async () => {
    const response = new FakeServerResponse();

    await writeResponsesUpstreamStream({
      response: response as never,
      responseId: "response-1",
      model: "model-1",
      upstreamResponse: sseResponse([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call-1",
                    function: {
                      name: "commandExecution",
                      arguments: "{\"command\":\"sw_vers",
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: " && echo done\"}" },
                  },
                ],
              },
            },
          ],
        },
      ]),
    });

    const doneEvent = response
      .events()
      .find((event) => event.event === "response.function_call_arguments.done");

    expect(doneEvent?.data.arguments).toBe("{\"command\":\"sw_vers && echo done\"}");
  });
});

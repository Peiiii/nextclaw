import { describe, expect, it } from "vitest";
import { writeAnthropicOpenAiUpstreamStream } from "./anthropic-openai-bridge-stream.utils.js";

class CapturedSseResponse {
  readonly chunks: string[] = [];
  readonly headers: Array<Record<string, string>> = [];

  write = (chunk: string): void => {
    this.chunks.push(chunk);
  };

  writeHead = (_statusCode: number, headers: Record<string, string>): void => {
    this.headers.push(headers);
  };

  end = (): void => {};

  text = (): string => this.chunks.join("");
}

function createOpenAiStreamResponse(chunks: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body);
}

function readEvents(rawSse: string): Array<{ event: string; data: Record<string, unknown> }> {
  return rawSse
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "";
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "{}";
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    });
}

describe("writeAnthropicOpenAiUpstreamStream", () => {
  it("preserves raw whitespace in reasoning, text, and tool argument deltas", async () => {
    const response = new CapturedSseResponse();
    await writeAnthropicOpenAiUpstreamStream({
      response,
      requestModel: "model",
      upstreamResponse: createOpenAiStreamResponse([
        { choices: [{ delta: { reasoning_content: "These seem " } }] },
        { choices: [{ delta: { reasoning_content: "to be " } }] },
        { choices: [{ delta: { content: "Hello " } }] },
        { choices: [{ delta: { content: "world" } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call-1",
                    function: { name: "bash", arguments: " -la" },
                  },
                ],
              },
            },
          ],
        },
      ]),
    });

    const deltaEvents = readEvents(response.text())
      .filter((event) => event.event === "content_block_delta")
      .map((event) => event.data.delta as Record<string, unknown>);

    expect(deltaEvents).toEqual([
      { type: "thinking_delta", thinking: "These seem " },
      { type: "thinking_delta", thinking: "to be " },
      { type: "text_delta", text: "Hello " },
      { type: "text_delta", text: "world" },
      { type: "input_json_delta", partial_json: " -la" },
    ]);
  });
});

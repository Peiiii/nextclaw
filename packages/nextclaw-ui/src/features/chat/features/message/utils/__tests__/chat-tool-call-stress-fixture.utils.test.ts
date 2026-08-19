import { expect, it } from "vitest";
import {
  createChatToolCallStressMessage,
  createChatToolCallStressViewModel,
} from "@/features/chat/features/message/utils/chat-tool-call-stress-fixture.utils";

it("builds one assistant message with dense nested NCP tool invocations", () => {
  const message = createChatToolCallStressMessage({
    toolCallCount: 120,
    argumentBytesPerCall: 4_096,
    resultBytesPerCall: 6_144,
  });

  expect(message.parts).toHaveLength(122);
  const firstTool = message.parts[1];
  expect(firstTool).toMatchObject({
    type: "tool-invocation",
    toolCallId: "stress-call-0",
    state: "result",
  });
  expect(firstTool).toMatchObject({
    args: {
      request: {
        nested: { levelOne: { levelTwo: { levelThree: { payload: expect.any(String) } } } },
      },
    },
  });
});

it("adapts the stress message through the regular tool-card presentation path", () => {
  const message = createChatToolCallStressViewModel({
    toolCallCount: 120,
    argumentBytesPerCall: 4_096,
    resultBytesPerCall: 6_144,
  });

  const toolCards = message.parts.filter((part) => part.type === "tool-card");
  expect(toolCards).toHaveLength(120);
  expect(toolCards[0]).toMatchObject({
    card: {
      toolCallId: "stress-call-0",
      input: undefined,
      output: undefined,
      inputData: {
        request: {
          metadata: { labels: expect.arrayContaining(["nested-payload"]) },
        },
      },
      outputData: {
        request: {
          metadata: { labels: expect.arrayContaining(["nested-payload"]) },
        },
      },
    },
  });
});

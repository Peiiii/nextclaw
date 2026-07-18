import { expect, it, vi } from "vitest";
import {
  buildChatMessageExecutionLabels,
  buildChatMessageTexts,
} from "@/features/chat/features/message/utils/chat-message-texts.utils";

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

it("provides localized status keys for built-in tool categories", () => {
  expect(buildChatMessageTexts("zh").toolStatusLabels?.builtIn).toMatchObject({
    directory: {
      running: "chatToolDirectoryRunning",
      success: "chatToolDirectorySuccess",
      error: "chatToolDirectoryError",
      cancelled: "chatToolDirectoryCancelled",
    },
    memory: {
      running: "chatToolMemoryRunning",
      success: "chatToolMemorySuccess",
      error: "chatToolMemoryError",
      cancelled: "chatToolMemoryCancelled",
    },
  });
});

it("provides localized labels for the AI execution metadata action", () => {
  expect(buildChatMessageExecutionLabels("zh")).toMatchObject({
    moreActions: "chatMessageMoreActions",
    viewMetadata: "chatAiExecutionViewMetadata",
    fields: {
      cachedInputTokens: "chatAiExecutionCachedInputTokens",
    },
  });
});

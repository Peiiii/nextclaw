import { describe, expect, it } from "vitest";
import { shouldShowChatWelcome } from "@/features/chat/features/welcome/utils/chat-welcome-visibility.utils";

function createVisibilitySnapshot(
  overrides: Partial<Parameters<typeof shouldShowChatWelcome>[0]> = {},
): Parameters<typeof shouldShowChatWelcome>[0] {
  return {
    canDeleteSession: false,
    hasSubmittedDraftMessage: false,
    isSending: false,
    messages: [],
    ...overrides,
  };
}

describe("shouldShowChatWelcome", () => {
  it("shows the welcome entry for an untouched draft", () => {
    expect(shouldShowChatWelcome(createVisibilitySnapshot())).toBe(true);
  });

  it("keeps the welcome entry hidden after a draft send attempt", () => {
    expect(
      shouldShowChatWelcome(
        createVisibilitySnapshot({ hasSubmittedDraftMessage: true }),
      ),
    ).toBe(false);
  });

  it("keeps the welcome entry hidden for an existing session", () => {
    expect(
      shouldShowChatWelcome(createVisibilitySnapshot({ canDeleteSession: true })),
    ).toBe(false);
  });
});

import { NextClawClientError } from "@nextclaw/client-sdk";
import { describe, expect, it } from "vitest";
import { resolveWorkspacePreviewErrorText } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { t } from "@/shared/lib/i18n";

describe("resolveWorkspacePreviewErrorText", () => {
  it.each([
    [
      new NextClawClientError({
        code: "SERVER_PATH_NOT_FOUND",
        message: "server path does not exist",
        status: 404,
      }),
      "chatWorkspacePreviewNotFound",
    ],
    [new Error("private upstream diagnostic"), "chatWorkspacePreviewFailed"],
  ] as const)("maps preview errors to %s", (error, translationKey) => {
    const message = resolveWorkspacePreviewErrorText(error);
    expect(message).toBe(t(translationKey));
    expect(message).not.toContain(error.message);
  });
});

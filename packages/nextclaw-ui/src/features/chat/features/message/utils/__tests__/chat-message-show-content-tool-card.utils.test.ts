import { describe, expect, it } from "vitest";
import { buildShowContentToolCard } from "@/features/chat/features/message/utils/chat-message-show-content-tool-card.utils";
import { buildToolCard } from "@/features/chat/features/message/utils/chat-message-tool-card.utils";
import type { ChatMessageAdapterTexts } from "@/features/chat/types/chat-message.types";

const TEXTS: ChatMessageAdapterTexts = {
  fileAttachmentLabel: "File",
  imageAttachmentLabel: "Image",
  reasoningLabel: "Reasoning",
  roleLabels: {
    assistant: "Assistant",
    fallback: "Message",
    system: "System",
    tool: "Tool",
    user: "User",
  },
  showContentActionLabel: "Show content",
  toolCallLabel: "Tool call",
  toolInputLabel: "Input",
  toolNoOutputLabel: "No output",
  toolOutputLabel: "Output",
  toolResultLabel: "Tool result",
  toolStatusCancelledLabel: "Cancelled",
  toolStatusCompletedLabel: "Completed",
  toolStatusFailedLabel: "Failed",
  toolStatusPreparingLabel: "Preparing",
  toolStatusRunningLabel: "Running",
  unknownPartLabel: "Unknown",
};

describe("buildShowContentToolCard", () => {
  it("builds a show-content action from a normalized show_file result", () => {
    const card = buildShowContentToolCard({
      invocation: {
        status: "result",
        toolCallId: "call-show-file",
        toolName: "show_file",
        result: {
          ok: true,
          action: "showContent",
          request: {
            target: {
              type: "file",
              payload: {
                path: "docs/example.md",
                line: 2,
                viewer: "rendered",
              },
            },
            title: "Example",
            purpose: "read",
          },
        },
      },
      actionLabel: "Show content",
      statusLabel: "Completed",
    });

    expect(card).toMatchObject({
      kind: "result",
      name: "show_file",
      detail: "Example",
      statusTone: "success",
      statusLabel: "Completed",
      action: {
        kind: "show-content",
        label: "Show content",
        request: {
          target: {
            type: "file",
            payload: {
              path: "docs/example.md",
              line: 2,
              viewer: "rendered",
            },
          },
          title: "Example",
          purpose: "read",
          placement: "side_panel",
        },
      },
    });
  });

  it("builds a show-content action from a normalized show_content result", () => {
    const card = buildShowContentToolCard({
      invocation: {
        status: "result",
        toolCallId: "call-show-content",
        toolName: "show_content",
        result: {
          ok: true,
          action: "showContent",
          request: {
            target: {
              type: "file",
              payload: {
                path: "docs/example.md",
                line: 2,
                viewer: "rendered",
              },
            },
            title: "Example",
            purpose: "read",
          },
        },
      },
      actionLabel: "Show content",
      statusLabel: "Completed",
    });

    expect(card).toMatchObject({
      kind: "result",
      name: "show_content",
      detail: "Example",
      statusTone: "success",
      statusLabel: "Completed",
      action: {
        kind: "show-content",
        label: "Show content",
        request: {
          target: {
            type: "file",
            payload: {
              path: "docs/example.md",
              line: 2,
              viewer: "rendered",
            },
          },
          title: "Example",
          purpose: "read",
          placement: "side_panel",
        },
      },
    });
  });

  it("builds an inline panel app card while keeping the expand action on side panel placement", () => {
    const card = buildShowContentToolCard({
      invocation: {
        status: "result",
        toolCallId: "call-show-content",
        toolName: "show_panel_app",
        result: {
          ok: true,
          action: "showContent",
          request: {
            target: {
              type: "panel_app",
              payload: {
                appId: "reader",
              },
            },
            title: "Reader",
            purpose: "interact",
            placement: "inline",
          },
        },
      },
      actionLabel: "Show content",
      statusLabel: "Completed",
    });

    expect(card).toMatchObject({
      panelApp: {
        appId: "reader",
        title: "Reader",
        action: {
          kind: "show-content",
          label: "Show content",
          request: {
            target: {
              type: "panel_app",
              payload: {
                appId: "reader",
              },
            },
            title: "Reader",
            purpose: "interact",
            placement: "side_panel",
          },
        },
      },
    });
  });

  it("preserves inline panel app data when converting to the shared chat tool view model", () => {
    const card = buildShowContentToolCard({
      invocation: {
        status: "result",
        toolCallId: "call-show-content",
        toolName: "show_content",
        result: {
          ok: true,
          action: "showContent",
          request: {
            target: {
              type: "panel_app",
              payload: {
                appId: "weather-card",
              },
            },
            title: "Weather",
            purpose: "interact",
            placement: "inline",
          },
        },
      },
      actionLabel: "Show content",
      statusLabel: "Completed",
    });

    expect(card).not.toBeNull();
    expect(buildToolCard(card!, TEXTS)).toMatchObject({
      panelApp: {
        appId: "weather-card",
        title: "Weather",
        action: {
          kind: "show-content",
          request: {
            placement: "side_panel",
          },
        },
      },
    });
  });
});

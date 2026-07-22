import { render, waitFor } from "@testing-library/react";
import { type ComponentProps, useRef } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatMessageListContainer as RuntimeChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";

function ChatMessageListContainer({
  sessionKey = "session-1",
  ...props
}: Omit<
  ComponentProps<typeof RuntimeChatMessageListContainer>,
  "sessionKey" | "scrollRef"
> & {
  sessionKey?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <RuntimeChatMessageListContainer
      {...props}
      scrollRef={scrollRef}
      sessionKey={sessionKey}
    />
  );
}

const captures = vi.hoisted(() => ({
  renders: [] as Array<{
    onInlineTokenClick?: (token: unknown) => void;
  }>,
  openFilePreview: vi.fn(),
  fetchSessionSkills: vi.fn(),
  toastError: vi.fn(),
  selectedSession: null as null | {
    projectRoot: string;
    workingDir?: string | null;
  },
}));

vi.mock("@/shared/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchNcpSessionSkills: captures.fetchSessionSkills,
}));

vi.mock("sonner", () => ({
  toast: { error: captures.toastError },
}));

vi.mock("@nextclaw/agent-chat-ui", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  ChatMessageList: (props: {
    onInlineTokenClick?: (token: unknown) => void;
  }) => {
    captures.renders.push(props);
    return <div data-testid="chat-message-list" />;
  },
}));

vi.mock(
  "@/features/chat/features/message/hooks/use-chat-message-virtualizer",
  () => ({
    useChatMessageVirtualizer: ({
      rows,
    }: {
      rows: Array<{ key: string }>;
    }) => ({
      containerRef: vi.fn(),
      virtualizer: {
        getVirtualItems: () => rows.map((_, index) => ({ index, start: 0 })),
        measureElement: vi.fn(),
      },
    }),
  }),
);

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      openFilePreview: captures.openFilePreview,
      handleToolAction: vi.fn(),
    },
    chatUiManager: { showContent: vi.fn() },
  }),
}));

vi.mock(
  "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state",
  () => ({
    useNcpChatSelectedSession: () => captures.selectedSession,
  }),
);

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: "en" }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  formatDateTime: (value: string) => value,
  t: (key: string) => key,
}));

beforeEach(() => {
  captures.renders = [];
  captures.openFilePreview.mockReset();
  captures.fetchSessionSkills.mockReset();
  captures.toastError.mockReset();
  captures.selectedSession = null;
});

function clickSkill(token: Record<string, unknown>, sessionKey?: string): void {
  render(
    <ChatMessageListContainer
      messages={[]}
      isSending
      sessionKey={sessionKey}
    />,
  );
  captures.renders[captures.renders.length - 1]?.onInlineTokenClick?.(token);
}

it("opens a persisted skill path without consulting the session catalog", () => {
  clickSkill({
    kind: "skill", ref: "global:/skills/review", name: "review", source: "global",
    path: "/home/.agents/skills/review/SKILL.md", label: "review", rawText: "$review",
  });

  expect(captures.openFilePreview).toHaveBeenCalledWith({
    path: "/home/.agents/skills/review/SKILL.md",
    label: "review",
    viewMode: "preview",
    previewViewer: "rendered",
  });
  expect(captures.fetchSessionSkills).not.toHaveBeenCalled();
});

it("resolves a persisted v1 skill against its owning session", async () => {
  captures.selectedSession = { projectRoot: "/tmp/project" };
  captures.fetchSessionSkills.mockResolvedValue({
    records: [{
      ref: "project:/tmp/project/.agents/skills/review",
      name: "review",
      path: "/tmp/project/.agents/skills/review/SKILL.md",
    }],
  });
  clickSkill({
    kind: "skill", ref: "project:/tmp/project/.agents/skills/review", name: "review",
    source: null, path: null, label: "review", rawText: "$project:/skills/review",
  }, "session-legacy");

  await waitFor(() => expect(captures.openFilePreview).toHaveBeenCalledWith({
    path: "/tmp/project/.agents/skills/review/SKILL.md",
    label: "review",
    viewMode: "preview",
    previewViewer: "rendered",
  }));
  expect(captures.fetchSessionSkills).toHaveBeenCalledWith("session-legacy", {
    projectRoot: "/tmp/project",
  });
});

it("shows an error when a persisted v1 skill is no longer resolvable", async () => {
  captures.fetchSessionSkills.mockResolvedValue({ records: [] });
  clickSkill({
    kind: "skill", ref: "workspace:/missing/review", name: "review",
    source: null, path: null, label: "review", rawText: "$workspace:/missing/review",
  });

  await waitFor(() => expect(captures.toastError).toHaveBeenCalledWith(
    "chatSkillPreviewUnavailable",
  ));
  expect(captures.openFilePreview).not.toHaveBeenCalled();
});

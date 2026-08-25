import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatSidebarSessionItem } from "@/features/chat/features/session/components/chat-sidebar-session-item";

const mocks = vi.hoisted(() => ({
  copyText: vi.fn(),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  copyText: mocks.copyText,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  mocks.copyText.mockReset();
  mocks.copyText.mockResolvedValue(true);
  render(
    <ChatSidebarSessionItem
      sessionKey="session:current"
      active
      showUnreadDot={false}
      context={{
        icon: {
          kind: "runtime-image",
          src: "/runtime-icons/codex-openai.svg",
          name: "Codex",
        },
        label: null,
      }}
      isPinned={false}
      title="Current Task"
      previewText="Preview"
      trailingText="Now"
      childSessionCount={2}
      cronJobCount={3}
      projectName="nextbot"
      isEditing={false}
      draftLabel="Current Task"
      isSaving={false}
      onSelect={vi.fn()}
      onStartEditing={vi.fn()}
      onDraftLabelChange={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onTogglePinned={vi.fn()}
    />,
  );
});

it("shows session actions only on hover or when an action owns focus", () => {
  screen.getByText("Current Task").closest("button")?.focus();
  const actions = screen.getByLabelText("Pin session").parentElement;
  const titleRow =
    screen.getByText("Current Task").parentElement?.parentElement;

  expect(actions?.className).toContain("opacity-0");
  expect(actions?.className).toContain("group-hover/session:opacity-100");
  expect(actions?.className).toContain("focus-within:opacity-100");
  expect(actions?.className).not.toContain(
    "group-focus-within/session:opacity-100",
  );
  expect(titleRow?.classList.contains("pr-20")).toBe(false);
  expect(titleRow?.className).toContain("group-hover/session:pr-20");
  expect(titleRow?.className).toContain(
    "group-has-[[data-session-actions]:focus-within]/session:pr-20",
  );
  expect(titleRow?.className).not.toContain("pr-32");
  expect(
    screen.queryByRole("button", { name: "View child sessions" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
});

it("copies the sidebar session ID from the more-actions menu", async () => {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(screen.getByRole("button", { name: "Copy session ID" }));

  expect(mocks.copyText).toHaveBeenCalledWith("session:current");
});

it("sizes the runtime icon to the session title text", () => {
  const runtimeIcon = screen.getByRole("img", { name: "Codex logo" });

  expect(runtimeIcon.parentElement?.className).toContain("h-[13px]");
  expect(runtimeIcon.parentElement?.className).toContain("w-[13px]");
  expect(runtimeIcon.parentElement?.parentElement?.className).toContain("h-4");
  expect(runtimeIcon.parentElement?.parentElement?.className).toContain("w-4");
});

it("shows session context from the row on hover", async () => {
  const user = userEvent.setup();

  await user.hover(screen.getByText("Current Task").closest("button")!);

  const tooltip = await screen.findByRole("tooltip");
  expect(within(tooltip).getByText("Project")).toBeTruthy();
  expect(within(tooltip).getByText("Child sessions")).toBeTruthy();
  expect(within(tooltip).getByText("Scheduled tasks")).toBeTruthy();
  expect(within(tooltip).getByText("nextbot")).toBeTruthy();
  expect(within(tooltip).getByText("2")).toBeTruthy();
  expect(within(tooltip).getByText("3")).toBeTruthy();
});

import { fireEvent, render, screen } from "@testing-library/react";
import { countChatReferenceCharacters } from "@agent-chat-ui/components/chat/ui/chat-reference-tag";
import { ChatInlineTokenBadge } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-inline-token-badge";

it("counts user-visible Unicode code points for excerpt metrics", () => {
  expect(countChatReferenceCharacters("A😀中")).toBe(3);
});

it("renders a workspace excerpt as a compact token with a source preview", async () => {
  const onClick = vi.fn();
  const excerpt = "Requests must include an authorization header.";
  render(
    <ChatInlineTokenBadge
      excerpt={excerpt}
      kind="workspace_excerpt"
      label="guide.md"
      location="L32–34"
      path="docs/guide.md"
      tooltip="docs/guide.md#excerpt-1"
      onClick={onClick}
    />,
  );

  const excerptButton = screen.getByRole("button", { name: /guide\.md/ });
  expect(excerptButton.className).toContain("h-6");
  expect(excerptButton.className).not.toContain("flex-col");
  expect(screen.getByText(excerpt)).toBeTruthy();

  fireEvent.pointerMove(excerptButton, { pointerType: "mouse" });
  const preview = await screen.findByRole("tooltip");
  expect(preview.textContent).toContain("docs/guide.md");
  expect(preview.textContent).toContain(excerpt);

  fireEvent.click(excerptButton);
  expect(onClick).toHaveBeenCalledOnce();
});

it("renders a conversation excerpt with only its role and content fingerprint", async () => {
  const excerpt = "Keep the visible tag concise and reveal details only on demand.";
  const { container } = render(
    <ChatInlineTokenBadge
      excerpt={excerpt}
      kind="conversation_excerpt"
      label="AI reply"
      tooltip="assistant-message-1#excerpt"
    />,
  );

  expect(screen.getByText("AI reply")).toBeTruthy();
  expect(screen.getByText(excerpt)).toBeTruthy();
  expect(container.querySelector('[data-reference-icon="conversation-excerpt"]')).toBeTruthy();
  expect(container.textContent).not.toContain("characters");

  fireEvent.pointerMove(screen.getByText("AI reply"), { pointerType: "mouse" });
  expect((await screen.findByRole("tooltip")).textContent).toContain(excerpt);
});

it.each([
  ["skill", "Review", "skill"],
  ["panel_app", "Task board", "panel-app"],
  ["project", "NextClaw", "project"],
  ["workspace_directory", "docs", "directory"],
  ["workspace_file", "settings.json", "data-file"],
  ["workspace_file", "chat.tsx", "code-file"],
  ["workspace_file", "cover.png", "image-file"],
  ["custom_context", "External context", "reference"],
])("uses the semantic icon for %s references", (kind, label, icon) => {
  const { container } = render(
    <ChatInlineTokenBadge
      kind={kind}
      label={label}
      tooltip={label}
    />,
  );

  expect(container.querySelector(`[data-reference-kind="${kind}"]`)).toBeTruthy();
  expect(container.querySelector(`[data-reference-icon="${icon}"]`)).toBeTruthy();
  const token = container.querySelector(".nextclaw-chat-inline-token");
  expect(token?.className).toContain("h-6");
  expect(token?.className).not.toContain("underline");
});

it("keeps the same base token visual while changing only message behavior", () => {
  const { rerender } = render(
    <ChatInlineTokenBadge kind="skill" label="Review" tooltip="Review" />,
  );
  const passive = screen.getByText("Review").closest("span.nextclaw-chat-inline-token");
  expect(passive).toBeTruthy();
  expect(passive?.className).toContain("border-border/70");

  rerender(
    <ChatInlineTokenBadge
      kind="skill"
      label="Review"
      tooltip="Review"
      onClick={vi.fn()}
    />,
  );
  const interactive = screen.getByRole("button", { name: "Review" });
  expect(interactive.className).toContain("border-border/70");
  expect(interactive.querySelector('[data-reference-icon="skill"]')).toBeTruthy();
});

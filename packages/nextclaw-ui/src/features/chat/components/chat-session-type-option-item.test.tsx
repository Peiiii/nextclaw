import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSessionTypeOptionItem } from "./chat-session-type-option-item";

describe("ChatSessionTypeOptionItem", () => {
  it("renders a runtime icon image when the session type option provides an app resource URI", () => {
    render(
      <ChatSessionTypeOptionItem
        option={{
          value: "codex",
          label: "Codex",
          icon: {
            kind: "image",
            src: "app://runtime-icons/codex-openai.svg",
            alt: "Codex",
          },
          ready: true,
        }}
        onSelect={vi.fn()}
      />,
    );

    const runtimeIcon = screen.getByRole("img", { name: "Codex logo" });
    expect(runtimeIcon.getAttribute("src")).toBe("/runtime-icons/codex-openai.svg");
  });

  it("keeps ready options visually compact without repeating helper copy", () => {
    render(
      <ChatSessionTypeOptionItem
        option={{
          value: "claude",
          label: "Claude",
          icon: {
            kind: "image",
            src: "app://runtime-icons/claude.ico",
            alt: "Claude",
          },
          ready: true,
        }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Ready")).toHaveLength(1);
  });
});

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatPopoverContent } from "@/features/chat/components/chat-popover-content";
import { Popover, PopoverTrigger } from "@/shared/components/ui/popover";

function ChatPopoverHarness() {
  const [open, setOpen] = useState(true);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>Sessions</PopoverTrigger>
      <ChatPopoverContent>Session search</ChatPopoverContent>
    </Popover>
  );
}

function appendComposerFocusTarget(): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "nextclaw-chat-input-bar-shell";
  const composer = document.createElement("div");
  composer.setAttribute("contenteditable", "true");
  composer.setAttribute("role", "textbox");
  shell.appendChild(composer);
  document.body.appendChild(shell);
  return composer;
}

describe("ChatPopoverContent", () => {
  it("keeps chat popovers open when the composer receives programmatic focus", () => {
    const composer = appendComposerFocusTarget();
    try {
      render(<ChatPopoverHarness />);

      fireEvent.focusIn(composer);

      expect(screen.getByText("Session search")).toBeTruthy();
    } finally {
      composer.closest(".nextclaw-chat-input-bar-shell")?.remove();
    }
  });
});

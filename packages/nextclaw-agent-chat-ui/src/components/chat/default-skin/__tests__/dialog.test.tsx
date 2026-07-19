import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ChatDialog,
  ChatDialogContent,
  ChatDialogDescription,
  ChatDialogHeader,
  ChatDialogTitle,
} from "@agent-chat-ui/components/chat/default-skin/dialog";

describe("ChatDialog", () => {
  it("keeps centered positioning throughout the shadcn-style animation", () => {
    render(
      <ChatDialog open>
        <ChatDialogContent closeLabel="Close run metadata">
          <ChatDialogHeader>
            <ChatDialogTitle>AI run metadata</ChatDialogTitle>
            <ChatDialogDescription>Runtime facts</ChatDialogDescription>
          </ChatDialogHeader>
        </ChatDialogContent>
      </ChatDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "AI run metadata" });
    expect(dialog.className).toContain("duration-200");
    expect(dialog.className).toContain(
      "data-[state=open]:slide-in-from-left-1/2",
    );
    expect(dialog.className).toContain(
      "data-[state=open]:slide-in-from-top-[48%]",
    );
    expect(dialog.className).toContain(
      "data-[state=closed]:slide-out-to-left-1/2",
    );
    expect(dialog.className).toContain(
      "data-[state=closed]:slide-out-to-top-[48%]",
    );
    expect(
      screen.getByRole("button", { name: "Close run metadata" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Runtime facts").parentElement?.className,
    ).toContain("sm:text-left");
  });
});

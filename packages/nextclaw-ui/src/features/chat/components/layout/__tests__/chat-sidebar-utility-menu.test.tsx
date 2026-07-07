import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebarUtilityMenu } from "@/features/chat/components/layout/chat-sidebar-utility-menu";

function renderUtilityMenu() {
  return render(
    <MemoryRouter>
      <ChatSidebarUtilityMenu
        isOpen
        onOpenChange={vi.fn()}
        currentTheme="warm"
        currentThemeLabel="Warm"
        themeOptions={[{ value: "warm", label: "Warm" }]}
        onSelectTheme={vi.fn()}
        currentLanguage="en"
        currentLanguageLabel="English"
        languageOptions={[{ value: "en", label: "English" }]}
        onSelectLanguage={vi.fn()}
        onOpenDocs={vi.fn()}
        onOpenApps={vi.fn()}
      />
    </MemoryRouter>,
  );
}

function appendComposerFocusTarget(): HTMLElement {
  const composerShell = document.createElement("div");
  composerShell.className = "nextclaw-chat-input-bar-shell";
  const composer = document.createElement("div");
  composer.setAttribute("contenteditable", "true");
  composer.setAttribute("role", "textbox");
  composer.tabIndex = 0;
  composerShell.appendChild(composer);
  document.body.appendChild(composerShell);
  return composer;
}

describe("ChatSidebarUtilityMenu", () => {
  it("stays open when the streaming composer restores focus", () => {
    const composer = appendComposerFocusTarget();

    try {
      renderUtilityMenu();

      expect(screen.getByRole("button", { name: "Help Docs" })).toBeTruthy();

      fireEvent.focusIn(composer);

      expect(screen.getByRole("button", { name: "Help Docs" })).toBeTruthy();
    } finally {
      composer.closest(".nextclaw-chat-input-bar-shell")?.remove();
    }
  });
});

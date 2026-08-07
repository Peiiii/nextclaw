import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu } from "@/shared/components/ui/context-menu/context-menu";

describe("ContextMenu", () => {
  it("opens at the trigger and supports keyboard selection", async () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        label="File actions"
        groups={[
          {
            key: "file",
            items: [
              { key: "open", label: "Open", onSelect: vi.fn() },
              { key: "copy", label: "Copy path", onSelect },
            ],
          },
        ]}
      >
        <button type="button">README.md</button>
      </ContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "README.md" }), {
      clientX: 120,
      clientY: 80,
    });

    expect(screen.getByRole("menu", { name: "File actions" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Open" }),
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not steal focus back when an action focuses the composer", async () => {
    render(
      <div>
        <button type="button" data-testid="composer">Composer</button>
        <ContextMenu
          label="File actions"
          groups={[
            {
              key: "chat",
              items: [
                {
                  key: "add",
                  label: "Add to chat",
                  restoreFocus: false,
                  onSelect: () => screen.getByTestId("composer").focus(),
                },
              ],
            },
          ]}
        >
          <button type="button">README.md</button>
        </ContextMenu>
      </div>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "README.md" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to chat" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("composer"));
    });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompactTabStrip,
  type CompactTabStripTab,
} from "@/shared/components/ui/tab-strip/compact-tab-strip";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

function tabs(activeKey: string): CompactTabStripTab[] {
  return ["first", "second", "third"].map((key) => ({
    key,
    label: key,
    active: key === activeKey,
    onSelect: vi.fn(),
  }));
}

describe("CompactTabStrip", () => {
  it("scrolls the active tab into the horizontal viewport", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <CompactTabStrip
        tabs={tabs("first")}
        actions={[]}
        scrollTestId="compact-tabs"
      />,
    );

    scrollIntoView.mockClear();

    rerender(
      <CompactTabStrip
        tabs={tabs("second")}
        actions={[]}
        scrollTestId="compact-tabs"
      />,
    );

    expect(screen.getByRole("button", { name: "second" })).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
    });
  });

  it("selects a tab when clicking its leading icon", () => {
    const onSelect = vi.fn();

    render(
      <CompactTabStrip
        tabs={[
          {
            key: "child-session",
            label: "Child session",
            active: false,
            leadingIcon: <span data-testid="child-tab-icon" />,
            onSelect,
          },
        ]}
        actions={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("child-tab-icon"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects a tab when clicking the tab item outside the label button", () => {
    const onSelect = vi.fn();

    render(
      <CompactTabStrip
        tabs={[
          {
            key: "preview-tab",
            label: "Preview",
            active: false,
            onSelect,
          },
        ]}
        actions={[]}
      />,
    );

    const labelButton = screen.getByRole("button", { name: "Preview" });
    const tabItem = labelButton.parentElement;

    expect(tabItem).not.toBeNull();
    fireEvent.click(tabItem!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not select a tab when clicking its close button", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <CompactTabStrip
        tabs={[
          {
            key: "preview-tab",
            label: "Preview",
            active: false,
            closeLabel: "Close preview",
            closePlacement: "leading-hover",
            leadingIcon: <span data-testid="preview-tab-icon" />,
            onClose,
            onSelect,
          },
        ]}
        actions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("preview-tab-icon").parentElement?.className,
    ).toContain("group-hover:opacity-0");
  });

  it("overlays the close action at the start without changing the tab width on hover", () => {
    render(
      <CompactTabStrip
        tabs={[
          {
            key: "marketplace",
            label: "NextClaw Marketplace",
            active: true,
            closeLabel: "Close tab",
            closePlacement: "leading-hover",
            menuLabel: "More tab actions",
            menuGroups: [{ key: "tab", items: [{ key: "close", label: "Close", onSelect: vi.fn() }] }],
            onClose: vi.fn(),
            onSelect: vi.fn(),
          },
        ]}
        actions={[]}
      />,
    );

    const tabItem = screen.getByRole("button", { name: "NextClaw Marketplace" })
      .closest("[data-compact-tab-item]");
    const leadingActions = tabItem?.querySelector(
      '[data-compact-tab-leading-actions=""]',
    );
    const trailingActions = tabItem?.querySelector(
      '[data-compact-tab-trailing-actions=""]',
    );
    const trailingSpacer = tabItem?.querySelector(
      '[data-compact-tab-trailing-spacer=""]',
    );
    const leadingSlot = tabItem?.querySelector(
      '[data-compact-tab-leading-slot=""]',
    );

    expect(tabItem?.className).toContain("relative");
    expect(tabItem?.className).toContain("max-w-[180px]");
    expect(tabItem?.className).not.toContain("min-w-[");
    expect(leadingSlot?.className).toContain("w-3.5");
    expect(leadingSlot?.className).toContain("shrink-0");
    expect(leadingActions?.className).toContain("absolute");
    expect(leadingActions?.className).toContain("left-1");
    expect(leadingActions?.className).toContain("opacity-0");
    expect(leadingActions?.className).toContain("pointer-events-none");
    expect(leadingActions?.className).not.toContain("bg-inherit");
    expect(leadingActions?.className).toContain("group-hover:opacity-100");
    expect(leadingActions?.className).toContain("group-focus-within:opacity-100");
    expect(trailingActions?.className).toContain("absolute");
    expect(trailingActions?.className).toContain("opacity-0");
    expect(trailingActions?.className).toContain("pointer-events-none");
    expect(trailingActions?.className).not.toContain("bg-inherit");
    expect(trailingActions?.className).toContain("group-hover:opacity-100");
    expect(trailingActions?.className).toContain("group-focus-within:opacity-100");
    expect(trailingActions?.className).not.toContain("w-0");
    expect(trailingActions?.className).not.toContain("transition-[width");
    expect(trailingSpacer?.className).toContain("w-6");
    expect(trailingSpacer?.className).toContain("shrink-0");
    const closeButton = leadingActions?.querySelector<HTMLButtonElement>(
      '[aria-label="Close tab"]',
    );
    const menuButton = trailingActions?.querySelector<HTMLButtonElement>(
      '[aria-label="More tab actions"]',
    );
    expect(closeButton).toBeTruthy();
    expect(menuButton).toBeTruthy();
    expect(closeButton?.className).toBe(menuButton?.className);
    expect(closeButton?.className).toContain("h-6");
    expect(closeButton?.className).toContain("w-6");
    expect(closeButton?.className).toContain("rounded-md");
    expect(
      trailingActions?.querySelector('[aria-label="Close tab"]'),
    ).toBeNull();
  });

  it("opens a tab action menu without selecting the tab or restoring stale focus after an action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onSelect = vi.fn();

    render(
      <CompactTabStrip
        tabs={[
          {
            key: "source-tab",
            label: "index.html",
            active: true,
            menuLabel: "File actions",
            menuGroups: [
              {
                key: "file",
                items: [
                  {
                    key: "preview",
                    icon: <span />,
                    label: "Open preview",
                    restoreFocus: false,
                    onSelect: onAction,
                  },
                ],
              },
            ],
            onSelect,
          },
        ]}
        actions={[]}
      />,
    );

    const menuTrigger = screen.getByRole("button", { name: "File actions" });
    await user.click(menuTrigger);
    await user.click(screen.getByRole("menuitem", { name: "Open preview" }));

    const tabItem = screen
      .getByRole("button", { name: "index.html" })
      .closest("[data-compact-tab-item]");
    expect(tabItem).not.toBeNull();
    fireEvent.contextMenu(tabItem!);
    await user.click(screen.getByRole("menuitem", { name: "Open preview" }));

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(menuTrigger);
  });
});

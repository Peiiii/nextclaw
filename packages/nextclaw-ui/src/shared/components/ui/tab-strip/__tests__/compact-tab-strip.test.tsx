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
            leadingIcon: <span />,
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
            menuActions: [
              {
                key: "preview",
                icon: <span />,
                label: "Open preview",
                onClick: onAction,
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

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(menuTrigger);
  });
});

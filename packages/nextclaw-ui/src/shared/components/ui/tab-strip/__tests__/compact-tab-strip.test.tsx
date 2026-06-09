import { render, screen } from "@testing-library/react";
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
});

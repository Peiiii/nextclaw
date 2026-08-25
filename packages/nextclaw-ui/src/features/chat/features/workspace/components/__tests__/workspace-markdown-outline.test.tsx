import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceMarkdownOutline } from "@/features/chat/features/workspace/components/workspace-markdown-outline";
import { t } from "@/shared/lib/i18n";

describe("WorkspaceMarkdownOutline", () => {
  it("does not render an outline action when the document has no headings", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    render(
      <>
        <WorkspaceMarkdownOutline
          contentKey="plain fixture"
          documentKey="notes.md"
          scrollContainerRef={scrollContainerRef}
        />
        <div ref={scrollContainerRef}>Plain paragraph</div>
      </>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: t("chatWorkspaceMarkdownOutline"),
        }),
      ).toBeNull();
    });
  });

  it("preserves outline scroll state and instantly jumps to the selected rendered heading", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const scrollTo = vi.fn();
    const { rerender } = render(
      <>
        <WorkspaceMarkdownOutline
          contentKey="outline fixture"
          documentKey="README.md"
          scrollContainerRef={scrollContainerRef}
        />
        <div ref={scrollContainerRef}>
          <h1>Overview</h1>
          <h3>
            Install <em>quickly</em>
          </h3>
          <h2>Overview</h2>
        </div>
      </>,
    );

    const outlineTrigger = await screen.findByRole("button", {
      name: t("chatWorkspaceMarkdownOutline"),
    });
    const scrollContainer = scrollContainerRef.current!;
    const headings = screen.getAllByRole("heading");
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 40,
      writable: true,
    });
    Object.defineProperty(scrollContainer, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
      top: 100,
    } as DOMRect);
    vi.spyOn(headings[1]!, "getBoundingClientRect").mockReturnValue({
      top: 420,
    } as DOMRect);

    fireEvent.click(outlineTrigger);

    expect(
      screen.getByTestId("workspace-markdown-outline-popover").className,
    ).toContain("w-[min(20rem,calc(100vw-1.5rem))]");
    const outlineNavigation = screen.getByRole("navigation");
    expect(outlineNavigation.className).toContain("max-h-80");
    expect(screen.getAllByRole("button", { name: "Overview" })).toHaveLength(2);
    const nestedHeading = screen.getByRole("button", {
      name: "Install quickly",
    });
    expect(nestedHeading.style.paddingInlineStart).toBe("1.25rem");

    outlineNavigation.scrollTop = 176;
    fireEvent.click(outlineTrigger);
    await waitFor(() => {
      expect(
        screen.queryByTestId("workspace-markdown-outline-popover"),
      ).toBeNull();
    });
    fireEvent.click(outlineTrigger);
    expect((await screen.findByRole("navigation")).scrollTop).toBe(176);
    fireEvent.click(outlineTrigger);
    rerender(
      <>
        <WorkspaceMarkdownOutline
          contentKey="outline fixture"
          documentKey="docs/other.md"
          scrollContainerRef={scrollContainerRef}
        />
        <div ref={scrollContainerRef}>
          <h1>Overview</h1>
          <h3>
            Install <em>quickly</em>
          </h3>
          <h2>Overview</h2>
        </div>
      </>,
    );
    fireEvent.click(outlineTrigger);
    expect((await screen.findByRole("navigation")).scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Install quickly" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 344 });
    await waitFor(() => {
      expect(
        screen.queryByTestId("workspace-markdown-outline-popover"),
      ).toBeNull();
    });
    expect(document.activeElement).toBe(outlineTrigger);
    expect(
      document.querySelector(
        '[role="tooltip"][data-state="delayed-open"], [role="tooltip"][data-state="instant-open"]',
      ),
    ).toBeNull();
  });
});

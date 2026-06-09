import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResizableRightPanel } from "@/shared/components/resizable-right-panel/resizable-right-panel";

function firePointerEvent(
  target: Window | Document | Node | Element,
  type: string,
  point: { clientX: number; pointerId?: number },
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: point.clientX },
    pointerId: { value: point.pointerId ?? 1 },
  });
  fireEvent(target, event);
}

describe("ResizableRightPanel", () => {
  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it("resizes horizontally from the left handle and clamps to max width", () => {
    render(
      <ResizableRightPanel
        data-testid="right-panel"
        defaultWidth={420}
        minWidth={320}
        maxWidth={500}
      >
        Content
      </ResizableRightPanel>,
    );

    firePointerEvent(
      screen.getByTestId("resizable-right-panel-handle"),
      "pointerdown",
      { clientX: 800, pointerId: 1 },
    );
    firePointerEvent(window, "pointermove", { clientX: 600, pointerId: 1 });

    expect(screen.getByTestId("right-panel").style.width).toBe("500px");
    expect(
      screen.getByTestId("resizable-right-panel-resize-shield"),
    ).toBeTruthy();

    firePointerEvent(window, "pointerup", { clientX: 600, pointerId: 1 });

    expect(
      screen.queryByTestId("resizable-right-panel-resize-shield"),
    ).toBeNull();
  });

  it("does not render resize controls in overlay mode", () => {
    render(
      <ResizableRightPanel data-testid="right-panel" overlay>
        Content
      </ResizableRightPanel>,
    );

    expect(
      screen.queryByTestId("resizable-right-panel-handle"),
    ).toBeNull();
    expect(screen.getByTestId("right-panel").className).toContain("fixed");
  });
});

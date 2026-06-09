import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizableRightPanel } from "../resizable-right-panel";

describe("ResizableRightPanel", () => {
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

    fireEvent.mouseDown(screen.getByTestId("resizable-right-panel-handle"), {
      clientX: 800,
    });
    fireEvent.mouseMove(window, { clientX: 600 });

    expect(screen.getByTestId("right-panel").style.width).toBe("500px");
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

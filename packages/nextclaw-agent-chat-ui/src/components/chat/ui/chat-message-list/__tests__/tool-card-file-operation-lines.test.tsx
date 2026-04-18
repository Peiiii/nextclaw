import { render } from "@testing-library/react";
import { FileOperationCodeSurface } from "../tool-card/tool-card-file-operation-lines";

const block = {
  key: "preview:hello.txt",
  path: "/tmp/hello.txt",
  display: "preview" as const,
  lines: [
    {
      kind: "context" as const,
      text: "hello",
      newLineNumber: 1,
    },
    {
      kind: "context" as const,
      text: "world",
      newLineNumber: 2,
    },
  ],
};

describe("FileOperationCodeSurface", () => {
  it("renders compact layout for tool cards", () => {
    const view = render(<FileOperationCodeSurface block={block} />);
    const surface = view.container.querySelector(
      '[data-file-code-surface="true"]',
    ) as HTMLDivElement | null;
    const stack = view.container.querySelector(
      '[data-file-code-stack="true"]',
    ) as HTMLDivElement | null;
    const firstRow = view.container.querySelector(
      '[data-file-line-row="true"]',
    ) as HTMLDivElement | null;
    const firstCodeCell = view.container.querySelector(
      '[data-file-code-row="true"]',
    ) as HTMLSpanElement | null;

    expect(surface?.getAttribute("data-file-code-surface-layout")).toBe(
      "compact",
    );
    expect(
      view.container.querySelectorAll('[data-file-line-row="true"]').length,
    ).toBe(2);
    expect(
      view.container.querySelector('[data-file-code-gutter="true"]'),
    ).toBeNull();
    expect(stack?.style.minWidth).toBe("calc(6.5ch + calc(5ch + 1.25rem))");
    expect(firstRow?.className).toContain("flex");
    expect(firstRow?.className).toContain("w-full");
    expect(firstCodeCell?.className).toContain("flex-1");
    expect(firstCodeCell?.className).toContain("min-w-0");
  });

  it("renders workspace layout with a dedicated gutter and canvas", () => {
    const view = render(
      <div className="h-40">
        <FileOperationCodeSurface block={block} layout="workspace" />
      </div>,
    );
    const surface = view.container.querySelector(
      '[data-file-code-surface="true"]',
    ) as HTMLDivElement | null;
    const gutter = view.container.querySelector(
      '[data-file-code-gutter="true"]',
    ) as HTMLDivElement | null;
    const canvas = view.container.querySelector(
      '[data-file-code-canvas="true"]',
    ) as HTMLDivElement | null;
    const stack = view.container.querySelector(
      '[data-file-code-stack="true"]',
    ) as HTMLDivElement | null;
    const firstCanvasRow = view.container.querySelector(
      '[data-file-code-canvas-row="true"]',
    ) as HTMLDivElement | null;
    const firstCodeCell = view.container.querySelector(
      '[data-file-code-row="true"]',
    ) as HTMLSpanElement | null;

    expect(surface?.getAttribute("data-file-code-surface-layout")).toBe(
      "workspace",
    );
    expect(gutter).toBeTruthy();
    expect(canvas).toBeTruthy();
    expect(gutter?.style.width).toBe("6.5ch");
    expect(gutter?.className).toContain("font-mono");
    expect(gutter?.className).toContain("text-[11px]");
    expect(canvas?.className).toContain("flex-1");
    expect(stack?.style.minWidth).toBe("calc(5ch + 1.25rem)");
    expect(firstCanvasRow?.className).toContain("flex");
    expect(firstCanvasRow?.className).toContain("w-full");
    expect(firstCodeCell?.className).toContain("flex-1");
    expect(firstCodeCell?.className).toContain("min-w-0");
  });
});

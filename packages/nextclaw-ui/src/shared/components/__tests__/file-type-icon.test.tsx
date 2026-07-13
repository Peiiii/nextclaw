import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileTypeIcon } from "@/shared/components/file-type-icon";

function readIcon(container: HTMLElement, name: string): SVGElement {
  const icon = container.querySelector<SVGElement>(
    `[data-file-type-icon="${name}"]`,
  );
  expect(icon).not.toBeNull();
  expect(icon?.innerHTML).not.toContain("undefined");
  expect(icon?.childElementCount).toBeGreaterThan(0);
  return icon!;
}

describe("FileTypeIcon", () => {
  it("renders recognizable SVG icons for common file types", () => {
    const { container } = render(
      <>
        <FileTypeIcon fileName="src/app.tsx" />
        <FileTypeIcon fileName="scripts/setup.js" />
        <FileTypeIcon fileName="docs/guide.md" />
        <FileTypeIcon fileName="assets/hero.png" />
        <FileTypeIcon fileName="reports/data.xlsx" />
      </>,
    );

    expect(readIcon(container, "react-typescript").tagName).toBe("svg");
    expect(readIcon(container, "javascript").tagName).toBe("svg");
    expect(readIcon(container, "markdown").tagName).toBe("svg");
    expect(readIcon(container, "image").tagName).toBe("svg");
    expect(readIcon(container, "excel").tagName).toBe("svg");
  });

  it("recognizes editor-style special file names", () => {
    const { container } = render(
      <>
        <FileTypeIcon fileName="package.json" />
        <FileTypeIcon fileName="Dockerfile" />
        <FileTypeIcon fileName=".env.local" />
        <FileTypeIcon fileName="vitest.unit.config.ts" />
        <FileTypeIcon fileName="PHOTO.JPEG" />
      </>,
    );

    expect(readIcon(container, "npm")).toBeTruthy();
    expect(readIcon(container, "docker")).toBeTruthy();
    expect(readIcon(container, "dotenv")).toBeTruthy();
    expect(readIcon(container, "vitest")).toBeTruthy();
    expect(readIcon(container, "image")).toBeTruthy();
  });

  it("uses the neutral SVG fallback and compact size predictably", () => {
    const { container } = render(
      <FileTypeIcon fileName="artifact.customtype" size="compact" />,
    );

    const fallback = readIcon(container, "default");
    expect(fallback.classList.contains("h-3.5")).toBe(true);
    expect(fallback.getAttribute("aria-hidden")).toBe("true");
  });
});

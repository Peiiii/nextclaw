import { describe, expect, it } from "vitest";
import { buildWorkspaceTextExcerpt } from "@/features/chat/features/workspace/utils/workspace-text-excerpt.utils";

describe("buildWorkspaceTextExcerpt", () => {
  it("keeps the exact snapshot and maps a cross-line selection", () => {
    expect(buildWorkspaceTextExcerpt({
      path: "docs/guide.md",
      label: "guide.md",
      selectedText: "second\nthird",
      sourceText: "first\nsecond\nthird\nfourth",
      sourceStartLine: 10,
    })).toEqual({
      path: "docs/guide.md",
      label: "guide.md",
      excerpt: "second\nthird",
      startLine: 11,
      endLine: 12,
    });
  });

  it("keeps a rendered selection without inventing a source position", () => {
    expect(buildWorkspaceTextExcerpt({
      path: "README.md",
      label: "README.md",
      selectedText: "Rendered sentence",
      sourceText: "**Rendered** sentence",
    })).toMatchObject({
      excerpt: "Rendered sentence",
      startLine: null,
      endLine: null,
    });
  });

  it("omits a line number when repeated text makes the location ambiguous", () => {
    expect(buildWorkspaceTextExcerpt({
      path: "src/example.ts",
      label: "example.ts",
      selectedText: "return value;",
      sourceText: "return value;\nnext();\nreturn value;",
    })).toMatchObject({
      startLine: null,
      endLine: null,
    });
  });

  it("rejects whitespace-only selections", () => {
    expect(buildWorkspaceTextExcerpt({
      path: "README.md",
      label: "README.md",
      selectedText: "  \n ",
      sourceText: "content",
    })).toBeNull();
  });
});

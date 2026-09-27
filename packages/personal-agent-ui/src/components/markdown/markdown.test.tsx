import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

describe("shared Markdown renderer", () => {
  it("renders GFM, math, and a usable code block in one document", () => {
    const html = renderToStaticMarkup(<Markdown text={[
      "| Item | Value |", "| --- | --- |", "| One | Two |", "",
      "- [x] Done", "", "$$E = mc^2$$", "",
      "```typescript", "const value: number = 42;", "```",
    ].join("\n")} />);
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("katex");
    expect(html).toContain("typescript");
    expect(html).toContain("复制代码");
    expect(html).toContain("hljs-keyword");
  });

  it("does not create executable or unresolved links and keeps image alternatives", () => {
    const html = renderToStaticMarkup(<Markdown text={[
      "[bad](javascript:alert(1)) [local](./missing.md) [good](https://example.com)",
      "![unsafe](data:image/svg+xml;base64,PHN2Zz4=)",
      "<script>alert(1)</script>",
    ].join("\n\n")} />);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("<script>");
    expect(html).toContain("noopener noreferrer");
    expect(html).toContain("unsafe");
  });

  it("keeps unknown code languages readable", () => {
    const html = renderToStaticMarkup(<Markdown text={'```unknown\n<a href="evil">\n```'} />);
    expect(html).toContain("unknown");
    expect(html).toContain("&lt;a href=&quot;evil&quot;&gt;");
  });
});

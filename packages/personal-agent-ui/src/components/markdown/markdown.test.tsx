/// <reference types="node" />
import { Writable } from "node:stream";
import type { ReactElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";
import { Message } from "../message";

function renderMarkdown(element: ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const output = new Writable({ write: (chunk, _encoding, done) => { html += chunk.toString(); done(); } });
    output.on("finish", () => resolve(html));
    output.on("error", reject);
    const stream = renderToPipeableStream(element, {
      onAllReady: () => { stream.pipe(output); },
      onError: reject,
    });
  });
}

describe("shared Markdown renderer", () => {
  it("renders GFM, math, and a usable code block in one document", async () => {
    const html = await renderMarkdown(<Markdown text={[
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

  it("does not create executable or unresolved links and keeps image alternatives", async () => {
    const html = await renderMarkdown(<Markdown text={[
      "[bad](javascript:alert(1)) [local](./missing.md) [good](https://example.com)",
      "![unsafe](data:image/svg+xml;base64,PHN2Zz4=)",
      "<script>alert(1)</script>",
    ].join("\n\n")} />);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("<script>");
    expect(html).toContain("noreferrer noopener");
    expect(html).toContain("unsafe");
  });

  it("keeps unknown code languages readable", async () => {
    const html = await renderMarkdown(<Markdown text={'```unknown\n<a href="evil">\n```'} />);
    expect(html).toContain("unknown");
    expect(html).toContain("&lt;a href=&quot;evil&quot;&gt;");
  });

  it("renders portable document table/image attributes while stripping active HTML", async () => {
    const html = await renderMarkdown(<Markdown document text={[
      '<table width="240"><colgroup><col width="160"><col width="80"></colgroup><tbody><tr><th colspan="2">Title</th></tr><tr><td align="center">Cell</td><td>Other</td></tr></tbody></table>',
      '<img src="/api/assets/12345678-1234-4123-8123-123456789012" width="180" alt="Description" title="Caption" onerror="alert(1)">',
      '<script>alert(1)</script><iframe src="https://example.com"></iframe>',
      '<a href="javascript:alert(1)" onclick="alert(1)" style="position:fixed">Unsafe</a>',
    ].join("\n\n")} />);
    expect(html).toContain('<col width="160"');
    expect(html).toContain('colSpan="2"');
    expect(html).toContain('text-align:center');
    expect(html).toContain('width:180px');
    expect(html).toContain('Caption');
    for (const unsafe of ["<script", "<iframe", "onerror=", "onclick=", "javascript:", "position:fixed"]) expect(html).not.toContain(unsafe);
  });

  it("renders user message file links through the same safe Markdown host", async () => {
    const text = "[搭档启动卡.md](/data/workspace/搭档启动卡.md) [危险](javascript:alert(1))";
    const html = await renderMarkdown(<Message role="user" text={text} label="你" resolveResourceHref={(uri) =>
      decodeURIComponent(uri) === "/data/workspace/搭档启动卡.md" ? "/files/path/starter" : null
    } />);
    expect(html).toContain('href="/files/path/starter"');
    expect(html).toContain("搭档启动卡.md");
    expect(html).not.toContain("href=\"javascript:");
    expect(html).toContain('aria-disabled="true"');
  });
});

import { describe, expect, it } from "vitest";
import { ansiToHtml, hasAnsiSequences, stripAnsiSequences } from "./terminal-ansi.utils";

describe("terminal-ansi.utils", () => {
  it("detects and strips ansi sequences", () => {
    const sample = `[31mred[0m plain`;
    expect(hasAnsiSequences(sample)).toBe(true);
    expect(stripAnsiSequences(sample)).toBe("red plain");
  });

  it("renders common sgr colors as html spans", () => {
    const html = ansiToHtml(`[1;32mok[0m`);
    expect(html).toContain('class="ansi ansi-bold ansi-fg-green"');
    expect(html).toContain("ok");
    expect(html).toContain("</span>");
  });
});

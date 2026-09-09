import { render } from "@testing-library/react";
import { ChatMessageMarkdown } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-markdown";

const texts = { copyCodeLabel: "Copy", copiedCodeLabel: "Copied" };

it("renders both delimiter families in the shared chat and document renderer", () => {
  const view = render(<ChatMessageMarkdown text={String.raw`Inline $a$ and \(b\).

$$
c
$$

\[
\frac{d}{2}
\]`} role="assistant" texts={texts} />);
  expect(view.container.querySelectorAll(".katex")).toHaveLength(4);
  expect(view.container.querySelectorAll(".katex-display")).toHaveLength(2);
  expect(view.container.querySelector(".katex-error")).toBeNull();
});

it("preserves code, escaped delimiters, links and surrounding Markdown", () => {
  const view = render(<ChatMessageMarkdown text={String.raw`**bold** \(x_1\) [link](https://example.com)

\`\(code\)\` and \\(literal\\)

\`\`\`text
\[code\]
\`\`\``.replaceAll("\\`", "`")} role="assistant" texts={texts} />);
  expect(view.container.querySelectorAll(".katex")).toHaveLength(1);
  expect(view.container.querySelector("strong")?.textContent).toBe("bold");
  expect(view.container.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  expect(view.container.textContent).toContain("(literal");
});

it("does not color unsupported commands red during generation", () => {
  const view = render(<ChatMessageMarkdown text={"$\\notARealCommand$"} role="assistant" texts={texts} isStreaming />);
  expect(view.container.innerHTML).not.toContain("#cc0000");
  expect(view.container.innerHTML).not.toContain("rgb(204, 0, 0)");
  view.rerender(<ChatMessageMarkdown text={"$\\notARealCommand$"} role="assistant" texts={texts} />);
  expect(view.container.innerHTML).toContain("rgb(204, 0, 0)");
});

it.each([
  String.raw`\(\frac{1}{2}\)`,
  String.raw`\[
\begin{pmatrix}1&2\\3&4\end{pmatrix}
\]`,
  "$$\n\\frac{1}{2}\n$$",
  "$$\n\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\n$$",
  "```math\n\\frac{1}{2}\n```",
  "> $$\n> \\frac{1}{2}\n> $$",
  "- $$\n  \\frac{1}{2}\n  $$",
])("never flashes red while receiving every prefix of %s", (source) => {
  const view = render(<ChatMessageMarkdown text="" role="assistant" texts={texts} isStreaming />);
  for (let length = 1; length <= source.length; length += 1) {
    view.rerender(<ChatMessageMarkdown text={source.slice(0, length)} role="assistant" texts={texts} isStreaming />);
    expect(view.container.querySelector(".katex-error")).toBeNull();
  }
  expect(view.container.querySelector(".katex")).not.toBeNull();
});

it("leaves code and escaped dollars alone and clears pending on interruption", () => {
  const view = render(<ChatMessageMarkdown text={"`$$` and \\$5\n\n```text\n$$\n\\frac{"} role="assistant" texts={texts} isStreaming />);
  expect(view.container.querySelector('[data-chat-math-pending]')).toBeNull();
  view.rerender(<ChatMessageMarkdown text={"$$\n\\frac{"} role="assistant" texts={texts} isStreaming />);
  expect(view.container.querySelector('[data-chat-math-pending]')).not.toBeNull();
  view.rerender(<ChatMessageMarkdown text={"$$\n\\frac{"} role="assistant" texts={texts} />);
  expect(view.container.querySelector('[data-chat-math-pending]')).toBeNull();
  expect(view.container.querySelector(".katex-error")).not.toBeNull();
});

it("holds incomplete display math without flashing parser errors", () => {
  const view = render(<ChatMessageMarkdown text="" role="assistant" texts={texts} isStreaming />);
  for (const text of ["$$", "$$\n\\frac{", "$$\n\\frac{1}{", "$$\n\\frac{1}{2}", "$$\n\\frac{1}{2}\n$"]) {
    view.rerender(<ChatMessageMarkdown text={text} role="assistant" texts={texts} isStreaming />);
    expect(view.container.querySelector(".katex-error")).toBeNull();
    expect(view.container.querySelector(".katex")).toBeNull();
    expect(view.container.querySelector('[data-chat-math-pending]')).not.toBeNull();
  }
  view.rerender(<ChatMessageMarkdown text={"$$\n\\frac{1}{2}\n$$"} role="assistant" texts={texts} isStreaming />);
  expect(view.container.querySelector(".katex-display")).not.toBeNull();
  expect(view.container.querySelector('[data-chat-math-pending]')).toBeNull();
});

it("shows genuine errors only when generation ends", () => {
  const text = "$$\n\\frac{\n$$";
  const view = render(<ChatMessageMarkdown text={text} role="assistant" texts={texts} isStreaming />);
  expect(view.container.querySelector(".katex-error")).toBeNull();
  expect(view.container.querySelector('[data-chat-math-pending]')).not.toBeNull();
  view.rerender(<ChatMessageMarkdown text={text} role="assistant" texts={texts} />);
  expect(view.container.querySelector(".katex-error")).not.toBeNull();
  expect(view.container.querySelector('[data-chat-math-pending]')).toBeNull();
});

it("keeps completed content and selected text stable through streaming and final", () => {
  const prefix = "Keep this selected\n\n$E=mc^2$\n\n";
  const view = render(<ChatMessageMarkdown text={prefix} role="assistant" texts={texts} isStreaming />);
  const paragraph = view.container.querySelector("p")!;
  const formula = view.container.querySelector(".katex")!;
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection()!;
  selection.removeAllRanges(); selection.addRange(range);
  for (const suffix of ["$$\n\\begin{pmatrix}1&", "$$\n\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\n$$"]) {
    view.rerender(<ChatMessageMarkdown text={prefix + suffix} role="assistant" texts={texts} isStreaming />);
    expect(view.container.querySelector(".katex-error")).toBeNull();
    expect(view.container.querySelector("p")).toBe(paragraph);
    expect(view.container.querySelector(".katex")).toBe(formula);
    expect(selection.toString()).toBe("Keep this selected");
  }
  view.rerender(<ChatMessageMarkdown text={prefix + "$$\nx\n$$"} role="assistant" texts={texts} />);
  expect(view.container.querySelector(".katex")).toBe(formula);
});

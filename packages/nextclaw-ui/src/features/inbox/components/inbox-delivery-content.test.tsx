import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => <article>{text}</article>,
}));

describe("InboxDeliveryContent", () => {
  it("keeps Markdown on the existing renderer path", () => {
    render(
      <InboxDeliveryContent
        content="# Markdown report"
        contentType="markdown"
        title="Markdown report"
      />,
    );

    expect(screen.getByText("# Markdown report")).toBeTruthy();
    expect(screen.queryByTitle("Markdown report")).toBeNull();
  });

  it("renders static HTML in an isolated document", () => {
    render(
      <InboxDeliveryContent
        content={'<meta http-equiv="refresh" content="0;url=https://example.com"><h1 onclick="alert(1)">Report</h1><a href="https://example.com/report">Source</a><a href="javascript:alert(1)">Unsafe</a><script>alert(1)</script>'}
        contentType="html"
        fillHeight
        title="HTML report"
      />,
    );

    const frame = screen.getByTitle<HTMLIFrameElement>("HTML report");
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-popups allow-popups-to-escape-sandbox",
    );
    expect(frame.className).toContain("h-full");
    expect(frame.className).toContain("border-0");
    expect(frame.srcdoc).toContain("Content-Security-Policy");
    expect(frame.srcdoc).toContain("script-src 'none'");
    expect(frame.srcdoc).toContain("connect-src 'none'");
    expect(frame.srcdoc).not.toContain("http-equiv=\"refresh\"");
    expect(frame.srcdoc).not.toContain("onclick");
    expect(frame.srcdoc).not.toContain("<script");
    expect(frame.srcdoc).toContain('href="https://example.com/report"');
    expect(frame.srcdoc).toContain('target="_blank"');
    expect(frame.srcdoc).toContain('rel="noopener noreferrer"');
    expect(frame.srcdoc).not.toContain("javascript:");
  });

  it("preserves the iframe instance while the surrounding view rerenders", () => {
    const view = render(
      <InboxDeliveryContent content="<h1>Report</h1>" contentType="html" title="Report" />,
    );
    const frame = screen.getByTitle("Report");

    view.rerender(
      <InboxDeliveryContent content="<h1>Report</h1>" contentType="html" title="Report" />,
    );

    expect(screen.getByTitle("Report")).toBe(frame);
  });
});

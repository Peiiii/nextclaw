import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageResourceIcon } from "@/features/right-panel-resources/components/page-resource-icon";

vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({
  usePanelApps: () => ({
    data: { entries: [{ id: "source:notes", appId: "notes", icon: "/notes.png" }] },
  }),
}));
afterEach(cleanup);

describe("resource icon precedence", () => {
  it("keeps avatar links inline under Markdown body-image styles without resizing body images", () => {
    const view = render(
      <div className="chat-markdown">
        <style>{'.chat-markdown img { display: block; width: auto; height: auto; max-width: 32rem; }'}</style>
        <a href="nextclaw://objects/agent/coder">
          <PageResourceIcon uri="nextclaw://objects/agent/coder" icon={{ type: "url", url: "/avatar.png" }} />
          Coder
        </a>
        <img src="/body.png" alt="Body illustration" />
      </div>,
    );
    const icon = view.container.querySelector("a img")!;
    expect(getComputedStyle(icon).width).toBe("1em");
    expect(getComputedStyle(icon).height).toBe("1em");
    expect(getComputedStyle(icon).display).toBe("inline-block");
    expect(getComputedStyle(view.getByAltText("Body illustration")).width).toBe("auto");
  });
  it("uses installed app metadata for an ordinary resource URI and falls back after a load error", () => {
    const view = render(<PageResourceIcon uri="nextclaw://panel-app/notes" />);
    const image = view.container.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("/notes.png");
    fireEvent.error(image);
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector(".lucide-app-window")).not.toBeNull();
  });
  it("uses an explicit icon ahead of metadata and then the resource category", () => {
    const view = render(
      <PageResourceIcon
        uri="nextclaw://panel-app/notes"
        icon={{ type: "text", value: "✎" }}
      />,
    );
    expect(view.container.textContent).toBe("✎");
    view.rerender(<PageResourceIcon uri="https://example.com" />);
    expect(view.container.querySelector(".lucide-globe")).not.toBeNull();
    view.rerender(<PageResourceIcon uri="nextclaw://unknown/item" />);
    expect(view.container.querySelector(".lucide-link2")).not.toBeNull();
  });
  it("uses Panel object identity for its installed icon and falls back to the application icon", () => {
    const view = render(<PageResourceIcon uri="nextclaw://objects/panel-app/source%3Anotes" />);
    const icon = view.container.querySelector("img")!;
    expect(icon.getAttribute("src")).toBe("/notes.png");
    fireEvent.error(icon);
    expect(view.container.querySelector(".lucide-app-window")).not.toBeNull();
  });
  it("honors precise builtin icons", () => {
    const view = render(
      <PageResourceIcon
        uri="https://github.com"
        icon={{ type: "builtin", name: "github" }}
      />,
    );
    expect(view.container.querySelector(".lucide-github")).not.toBeNull();
  });
});

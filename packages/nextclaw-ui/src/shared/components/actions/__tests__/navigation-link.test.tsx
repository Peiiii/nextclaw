import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationLink } from "@/shared/components/actions/navigation-link";

const mocks = vi.hoisted(() => ({
  openExternalUrl: vi.fn(),
}));

vi.mock("@/shared/lib/host-capabilities", () => ({
  hostCapabilityManager: {
    openExternalUrl: mocks.openExternalUrl,
  },
}));

describe("NavigationLink", () => {
  beforeEach(() => {
    mocks.openExternalUrl.mockReset();
  });

  it("exposes external destinations as links and delegates normal clicks to the host", () => {
    render(
      <NavigationLink href="https://docs.nextclaw.io/" external>
        View docs
      </NavigationLink>,
    );

    const link = screen.getByRole("link", { name: "View docs" });
    expect(link.getAttribute("href")).toBe("https://docs.nextclaw.io/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.queryByRole("button", { name: "View docs" })).toBeNull();

    fireEvent.click(link);

    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://docs.nextclaw.io/",
    );
  });

  it("keeps same-page links on the browser navigation path", () => {
    render(<NavigationLink href="/settings">Settings</NavigationLink>);

    const link = screen.getByRole("link", { name: "Settings" });
    expect(link.getAttribute("target")).toBeNull();
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
  });
});

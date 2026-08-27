import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesktopCapabilitiesPage } from "./desktop-capabilities-page";

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), revoke: vi.fn() }));

vi.mock("../hooks/use-desktop-capabilities", () => ({
  useDesktopCapabilityStatus: () => ({
    data: {
      online: true,
      permissions: { accessibility: "granted", screenCapture: "not_supported" },
    },
    isLoading: false,
    isFetching: false,
    refetch: mocks.refetch,
  }),
  useDesktopCapabilityGrants: () => ({
    data: [
      {
        subject: { type: "agent", id: "main" },
        resource: { type: "desktop.application", target: { applicationId: "wechat" } },
        access: ["ui.read"],
        declarationFingerprint: "fingerprint",
        grantedAt: "2026-08-26T00:00:00.000Z",
      },
    ],
    isLoading: false,
  }),
  useRequestDesktopSystemPermission: () => ({ isPending: false, mutate: vi.fn() }),
  useOpenDesktopSystemSettings: () => ({ isPending: false, mutate: vi.fn() }),
  useRevokeDesktopGrant: () => ({ isPending: false, mutate: mocks.revoke }),
}));

describe("DesktopCapabilitiesPage", () => {
  it("shows system permission and Agent grants with reachable actions", () => {
    render(<DesktopCapabilitiesPage />);

    expect(screen.getByText("Desktop Access")).toBeTruthy();
    expect(screen.getByText("AI · main")).toBeTruthy();
    expect(screen.getByText("wechat · ui.read")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});

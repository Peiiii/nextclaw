import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopAuthorizationDialog } from "./desktop-authorization-dialog";
import { useDesktopAuthorizationStore } from "../stores/desktop-authorization.store";

const mocks = vi.hoisted(() => ({ grantAccess: vi.fn() }));

vi.mock("../managers/desktop-capability.manager", () => ({
  desktopCapabilityManager: {
    grantAccess: mocks.grantAccess,
  },
}));

describe("DesktopAuthorizationDialog", () => {
  beforeEach(() => {
    mocks.grantAccess.mockReset();
    mocks.grantAccess.mockResolvedValue({});
    useDesktopAuthorizationStore.getState().clear();
  });

  it("shows the trusted subject and grants only after explicit approval", async () => {
    useDesktopAuthorizationStore.getState().present({
      applicationId: "wechat",
      request: {
        subject: { type: "agent", id: "main" },
        resource: {
          type: "desktop.application",
          target: { applicationId: "wechat", platform: "darwin", bundleId: "com.tencent.xinWeChat" },
        },
        access: ["ui.write"],
        declarationFingerprint: "fingerprint",
      },
    });

    render(<DesktopAuthorizationDialog />);
    expect(screen.getByText("AI · main")).toBeTruthy();
    expect(screen.getByText("wechat")).toBeTruthy();
    expect(mocks.grantAccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    await waitFor(() => expect(mocks.grantAccess).toHaveBeenCalledOnce());
  });

  it("explains the bounded pointer permission in user terms", () => {
    useDesktopAuthorizationStore.getState().present({
      applicationId: "wechat",
      request: {
        subject: { type: "agent", id: "main" },
        resource: { type: "desktop.application", target: { applicationId: "wechat", platform: "darwin", bundleId: "com.tencent.xinWeChat" } },
        access: ["input.pointer"],
        declarationFingerprint: "fingerprint",
      },
    });
    render(<DesktopAuthorizationDialog />);
    expect(screen.getByText("Click inside the app window")).toBeTruthy();
    expect(screen.getByText(/cannot use keys, scroll, drag, send, or confirm/i)).toBeTruthy();
  });
});

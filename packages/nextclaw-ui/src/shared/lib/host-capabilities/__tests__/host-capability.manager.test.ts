import { HostCapabilityManager } from "@/shared/lib/host-capabilities";

describe("HostCapabilityManager", () => {
  it("uses the desktop host bridge when available", async () => {
    const openExternalUrl = vi.fn(async () => ({ opened: true as const }));
    const manager = new HostCapabilityManager(() => ({
      open: vi.fn(),
      nextclawDesktop: {
        host: { openExternalUrl }
      }
    } as unknown as Window));

    await expect(manager.openExternalUrl("https://skillhub.cn")).resolves.toEqual({ opened: true });
    expect(openExternalUrl).toHaveBeenCalledWith("https://skillhub.cn/");
  });

  it("falls back to window.open outside the desktop host", async () => {
    const open = vi.fn(() => ({ closed: false }));
    const manager = new HostCapabilityManager(() => ({
      open
    } as unknown as Window));

    await expect(manager.openExternalUrl("https://skillhub.cn")).resolves.toEqual({ opened: true });
    expect(open).toHaveBeenCalledWith("https://skillhub.cn/", "_blank", "noopener,noreferrer");
  });

  it("reports unsupported URLs without opening them", async () => {
    const open = vi.fn();
    const manager = new HostCapabilityManager(() => ({
      open
    } as unknown as Window));

    await expect(manager.openExternalUrl("javascript:alert(1)")).resolves.toEqual({
      opened: false,
      reason: "unsupported-url"
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("reports popup-blocked when the web fallback cannot open a window", async () => {
    const manager = new HostCapabilityManager(() => ({
      open: vi.fn(() => null)
    } as unknown as Window));

    await expect(manager.openExternalUrl("https://skillhub.cn")).resolves.toEqual({
      opened: false,
      reason: "popup-blocked"
    });
  });
});

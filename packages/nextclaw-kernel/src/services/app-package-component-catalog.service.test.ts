import { describe, expect, it, vi } from "vitest";
import { AppPackageComponentCatalogService } from "@kernel/services/app-package-component-catalog.service.js";
import type { AppPackageComponentSourceList } from "@kernel/types/app-package.types.js";

function catalog(id: string): AppPackageComponentSourceList {
  return {
    sources: [{ id }] as AppPackageComponentSourceList["sources"],
    unavailablePackages: [],
  };
}

describe("AppPackageComponentCatalogService", () => {
  it("loads once and serves repeated reads from the verified snapshot", async () => {
    const load = vi.fn(async () => catalog("panel.one"));
    const service = new AppPackageComponentCatalogService(load);

    expect((await service.read()).sources[0]?.id).toBe("panel.one");
    expect((await service.read()).sources[0]?.id).toBe("panel.one");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("publishes a refreshed snapshot only after the lifecycle refresh completes", async () => {
    let finishRefresh: ((value: AppPackageComponentSourceList) => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(catalog("panel.one"))
      .mockImplementationOnce(async () => await new Promise<AppPackageComponentSourceList>((resolve) => {
        finishRefresh = resolve;
      }));
    const service = new AppPackageComponentCatalogService(load);
    await service.read();

    const refreshing = service.refresh();
    expect((await service.read()).sources[0]?.id).toBe("panel.one");
    finishRefresh?.(catalog("panel.two"));
    await refreshing;

    expect((await service.read()).sources[0]?.id).toBe("panel.two");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

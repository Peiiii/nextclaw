import type { DesktopHost } from "@kernel/features/desktop-host/index.js";
import type { ProductFeatureControls } from "@kernel/features/feature-controls/types/feature-controls.types.js";

export class FeatureControlsService {
  constructor(private readonly desktopHost: DesktopHost) {}

  get = async (): Promise<ProductFeatureControls> => {
    const desktop = await this.desktopHost.status();
    return {
      desktopAutomation: {
        available: desktop.online && desktop.platform === "darwin" && desktop.supportedOperations.includes("host.ui.snapshot"),
      },
    };
  };
}

import type { RequestService } from "./request.service.js";

/**
 * 与 kernel `ProductFeatureControls` 对齐的客户端视图。
 * `desktopAutomation.available` / `mcp.available` 是平台/配置能力（既有语义）；
 * `active` 是降级开关作用后的真实可用性；`core` 暴露最小核心健康与降级状态。
 */
export type ProductFeatureControlsView = {
  desktopAutomation: {
    available: boolean;
    active: boolean;
    reason?: string;
  };
  mcp: {
    available: boolean;
    active: boolean;
    reason?: string;
  };
  core: {
    healthy: boolean;
    autoDegrade: boolean;
    failedCheckIds: string[];
  };
};

export class FeatureControlsService {
  constructor(private readonly requestService: RequestService) {}

  get = async (): Promise<ProductFeatureControlsView> =>
    await this.requestService.get<ProductFeatureControlsView>("/api/feature-controls");
}

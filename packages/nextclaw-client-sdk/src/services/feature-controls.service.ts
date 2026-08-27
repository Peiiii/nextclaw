import type { RequestService } from "./request.service.js";

export type ProductFeatureControlsView = {
  desktopAutomation: {
    available: boolean;
  };
};

export class FeatureControlsService {
  constructor(private readonly requestService: RequestService) {}

  get = async (): Promise<ProductFeatureControlsView> =>
    await this.requestService.get<ProductFeatureControlsView>("/api/feature-controls");
}

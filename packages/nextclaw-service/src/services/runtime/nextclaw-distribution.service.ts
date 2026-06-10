import type { NextclawDistribution } from "@nextclaw-service/types/distribution.types.js";

export class NextclawDistributionService {
  private static currentDistribution: NextclawDistribution | null = null;

  static configure(distribution: NextclawDistribution): void {
    NextclawDistributionService.currentDistribution = distribution;
  }

  static get(): NextclawDistribution {
    if (!NextclawDistributionService.currentDistribution) {
      throw new Error("NextClaw distribution is not configured.");
    }
    return NextclawDistributionService.currentDistribution;
  }
}

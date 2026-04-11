import type {
  ApiEnvelope,
  MaintainabilityOverview,
  MaintainabilityProfile
} from "@shared/maintainability.types";

class MaintainabilityApiService {
  readonly baseUrl: string;

  constructor(baseUrl = (import.meta.env.VITE_MAINTAINABILITY_API_BASE ?? "").replace(/\/+$/, "")) {
    this.baseUrl = baseUrl;
  }

  createOverviewUrl = (profile: MaintainabilityProfile): string => {
    const query = new URLSearchParams({
      profile
    }).toString();
    const path = `/api/maintainability/overview?${query}`;
    return this.baseUrl ? `${this.baseUrl}${path}` : path;
  };

  getOverview = async (profile: MaintainabilityProfile): Promise<MaintainabilityOverview> => {
    const response = await fetch(this.createOverviewUrl(profile));
    const payload = (await response.json()) as ApiEnvelope<MaintainabilityOverview>;

    if (!response.ok || !payload.ok) {
      const message = payload.ok ? "Failed to load maintainability overview." : payload.error.message;
      throw new Error(message);
    }

    return payload.data;
  };
}

export const maintainabilityApiService = new MaintainabilityApiService();

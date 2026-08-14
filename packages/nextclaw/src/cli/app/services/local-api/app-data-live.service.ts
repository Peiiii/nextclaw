import type { AppDataDeleteResult, AppDataList } from "@nextclaw/kernel";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";

export class AppDataLiveService {
  constructor(private readonly params: {
    createApiClient?: () => UiApiClient | null;
  } = {}) {}

  list = async (): Promise<AppDataList> =>
    await this.requireApiClient().request<AppDataList>({ path: "/api/app-data" });

  deleteRetained = async (
    dataId: string,
    confirmAppId: string,
  ): Promise<AppDataDeleteResult> => {
    const normalizedDataId = dataId.trim();
    const normalizedAppId = confirmAppId.trim();
    if (!normalizedDataId) throw new Error("App data id is required.");
    if (!normalizedAppId) throw new Error("--confirm <app-id> is required.");
    return await this.requireApiClient().request<AppDataDeleteResult>({
      path: `/api/app-data/${encodeURIComponent(normalizedDataId)}`,
      method: "DELETE",
      body: { confirmAppId: normalizedAppId },
    });
  };

  private requireApiClient = (): UiApiClient => {
    const client = this.params.createApiClient
      ? this.params.createApiClient()
      : createLocalUiApiClient();
    if (!client) {
      throw new Error(
        "NextClaw UI runtime is not running; start NextClaw before managing App data.",
      );
    }
    return client;
  };
}

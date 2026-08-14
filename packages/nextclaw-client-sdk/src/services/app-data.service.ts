import type {
  AppDataDeleteResult,
  AppDataList,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class AppDataClientService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<AppDataList> =>
    await this.requestService.get<AppDataList>("/api/app-data");

  readonly deleteRetained = async (
    dataId: string,
    confirmAppId: string,
  ): Promise<AppDataDeleteResult> =>
    await this.requestService.request<AppDataDeleteResult>(
      `/api/app-data/${encodeURIComponent(dataId)}`,
      { method: "DELETE", body: { confirmAppId } },
    );
}

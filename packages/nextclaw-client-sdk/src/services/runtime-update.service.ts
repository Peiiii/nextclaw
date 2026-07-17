import type { UpdateSnapshot } from "@nextclaw/shared";
import type { RequestService } from "./request.service.js";

export class RuntimeUpdateService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetch = async (): Promise<UpdateSnapshot> => {
    return await this.requestService.get<UpdateSnapshot>("/api/runtime/update");
  };

  readonly check = async (): Promise<UpdateSnapshot> => {
    return await this.requestService.post<UpdateSnapshot>("/api/runtime/update/check", {});
  };

  readonly download = async (): Promise<UpdateSnapshot> => {
    return await this.requestService.post<UpdateSnapshot>("/api/runtime/update/download", {});
  };

  readonly apply = async (): Promise<UpdateSnapshot> => {
    return await this.requestService.post<UpdateSnapshot>("/api/runtime/update/apply", {});
  };

  readonly updateChannel = async (channel: UpdateSnapshot["channel"]): Promise<UpdateSnapshot> => {
    return await this.requestService.put<UpdateSnapshot>("/api/runtime/update/channel", { channel });
  };
}

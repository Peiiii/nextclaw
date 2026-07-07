import type { ServerPathBrowseView, ServerPathReadView } from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ServerPathsService {
  constructor(private readonly requestService: RequestService) {}

  readonly browse = async (params?: {
    path?: string | null;
    basePath?: string | null;
    includeFiles?: boolean;
  }): Promise<ServerPathBrowseView> => {
    const { basePath: rawBasePath, includeFiles, path: rawPath } = params ?? {};
    const path = typeof rawPath === "string" ? rawPath.trim() : "";
    const basePath = typeof rawBasePath === "string" ? rawBasePath.trim() : "";
    return await this.requestService.get<ServerPathBrowseView>("/api/server-paths/browse", {
      query: {
        ...(path ? { path } : {}),
        ...(basePath ? { basePath } : {}),
        ...(includeFiles ? { includeFiles: "1" } : {})
      }
    });
  };

  readonly read = async (params: { path: string; basePath?: string | null }): Promise<ServerPathReadView> => {
    const path = params.path.trim();
    const basePath = typeof params.basePath === "string" ? params.basePath.trim() : "";
    return await this.requestService.get<ServerPathReadView>("/api/server-paths/read", {
      query: {
        path,
        ...(basePath ? { basePath } : {})
      }
    });
  };
}

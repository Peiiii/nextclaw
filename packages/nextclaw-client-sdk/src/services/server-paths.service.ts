import type {
  ServerPathBrowseView,
  ServerPathDirectoryCreateRequest,
  ServerPathDirectoryCreateView,
  ServerPathReadView,
} from "@nextclaw/server";
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

  readonly createDirectory = async (
    input: ServerPathDirectoryCreateRequest,
  ): Promise<ServerPathDirectoryCreateView> =>
    await this.requestService.post<ServerPathDirectoryCreateView>(
      "/api/server-paths/directory",
      input,
    );

  readonly read = async (params: { path: string; basePath?: string | null; line?: number | null }): Promise<ServerPathReadView> => {
    const { basePath: rawBasePath, line: rawLine, path: rawPath } = params;
    const path = rawPath.trim();
    const basePath = typeof rawBasePath === "string" ? rawBasePath.trim() : "";
    const line = Number.isSafeInteger(rawLine) && (rawLine ?? 0) > 0 ? rawLine : null;
    return await this.requestService.get<ServerPathReadView>("/api/server-paths/read", {
      query: {
        path,
        ...(basePath ? { basePath } : {}),
        ...(line ? { line: String(line) } : {})
      }
    });
  };
}

import type {
  ServerPathBrowseView,
  ServerPathDirectoryCreateRequest,
  ServerPathDirectoryCreateView,
  ServerPathEntryDeleteView,
  ServerPathEntryRenameRequest,
  ServerPathEntryRenameView,
  ServerPathFileCreateRequest,
  ServerPathFileCreateView,
  ServerPathFilesUploadView,
  ServerPathReadView,
  ServerPathSearchView,
  ServerPathWatchRequest,
  ServerPathWatchView,
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
    return await this.requestService.get<ServerPathBrowseView>(
      "/api/server-paths/browse",
      {
        query: {
          ...(path ? { path } : {}),
          ...(basePath ? { basePath } : {}),
          ...(includeFiles ? { includeFiles: "1" } : {}),
        },
      },
    );
  };

  readonly watch = async (input: ServerPathWatchRequest): Promise<ServerPathWatchView> =>
    await this.requestService.post<ServerPathWatchView>("/api/server-paths/watch", input);

  readonly unwatch = async (subscriptionId: string): Promise<void> => {
    await this.requestService.delete<{ unsubscribed: boolean }>("/api/server-paths/watch", {
      query: { subscriptionId: subscriptionId.trim() },
    });
  };

  readonly createDirectory = async (
    input: ServerPathDirectoryCreateRequest,
  ): Promise<ServerPathDirectoryCreateView> =>
    await this.requestService.post<ServerPathDirectoryCreateView>(
      "/api/server-paths/directory",
      input,
    );

  readonly createFile = async (
    input: ServerPathFileCreateRequest,
  ): Promise<ServerPathFileCreateView> =>
    await this.requestService.post<ServerPathFileCreateView>(
      "/api/server-paths/file",
      input,
    );

  readonly renameEntry = async (
    input: ServerPathEntryRenameRequest,
  ): Promise<ServerPathEntryRenameView> =>
    await this.requestService.request<ServerPathEntryRenameView>(
      "/api/server-paths/entry",
      { method: "PATCH", body: input },
    );

  readonly deleteEntry = async (params: {
    basePath: string;
    path: string;
  }): Promise<ServerPathEntryDeleteView> =>
    await this.requestService.delete<ServerPathEntryDeleteView>(
      "/api/server-paths/entry",
      {
        query: {
          basePath: params.basePath.trim(),
          path: params.path.trim(),
        },
      },
    );

  readonly uploadFiles = async (params: {
    basePath: string;
    targetPath: string;
    files: readonly File[];
    overwrite?: boolean;
  }): Promise<ServerPathFilesUploadView> => {
    const { basePath, files, overwrite, targetPath } = params;
    const formData = new FormData();
    formData.append("basePath", basePath.trim());
    formData.append("targetPath", targetPath.trim());
    formData.append("overwrite", overwrite ? "true" : "false");
    files.forEach((file) => formData.append("files", file));
    return await this.requestService.upload<ServerPathFilesUploadView>(
      "/api/server-paths/files",
      formData,
      { timeoutMs: 120_000 },
    );
  };

  readonly read = async (params: {
    path: string;
    basePath?: string | null;
    line?: number | null;
  }): Promise<ServerPathReadView> => {
    const { basePath: rawBasePath, line: rawLine, path: rawPath } = params;
    const path = rawPath.trim();
    const basePath = typeof rawBasePath === "string" ? rawBasePath.trim() : "";
    const line =
      Number.isSafeInteger(rawLine) && (rawLine ?? 0) > 0 ? rawLine : null;
    return await this.requestService.get<ServerPathReadView>(
      "/api/server-paths/read",
      {
        query: {
          path,
          ...(basePath ? { basePath } : {}),
          ...(line ? { line: String(line) } : {}),
        },
      },
    );
  };

  readonly search = async (params: {
    basePath: string;
    query?: string | null;
    limit?: number | null;
  }): Promise<ServerPathSearchView> => {
    const { basePath: rawBasePath, limit: rawLimit, query: rawQuery } = params;
    const basePath = rawBasePath.trim();
    const query = rawQuery?.trim() ?? "";
    const limit =
      Number.isSafeInteger(rawLimit) && (rawLimit ?? 0) > 0 ? rawLimit : null;
    return await this.requestService.get<ServerPathSearchView>(
      "/api/server-paths/search",
      {
        query: {
          basePath,
          ...(query ? { query } : {}),
          ...(limit ? { limit: String(limit) } : {}),
        },
      },
    );
  };
}

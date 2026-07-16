import type { Context } from "hono";
import type {
  ServerPathBrowseView,
  ServerPathReadView,
  ServerPathSearchView,
} from "@nextclaw-server/shared/types/server-api.types.js";
import {
  browseServerPath,
  isServerPathBrowseError,
} from "@nextclaw-server/features/server-path/utils/server-path-browse.utils.js";
import {
  createServerPathDirectory,
  isServerPathDirectoryCreateError,
} from "@nextclaw-server/features/server-path/utils/server-path-directory.utils.js";
import {
  isServerPathReadError,
  readServerPath,
} from "@nextclaw-server/features/server-path/utils/server-path-read.utils.js";
import {
  isServerPathContentError,
  readServerPathContent,
} from "@nextclaw-server/features/server-path/utils/server-path-content.utils.js";
import {
  isServerPathSearchError,
  ServerPathSearchService,
} from "@nextclaw-server/features/server-path/services/server-path-search.service.js";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

function readIncludeFilesFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function readPositiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function encodeContentDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/\*/g, "%2A");
}

function statusForServerPathContentError(code: string): 400 | 404 {
  return code === "SERVER_PATH_NOT_FOUND" ? 404 : 400;
}

export class ServerPathRoutesController {
  private readonly searchService = new ServerPathSearchService();

  readonly browse = async (c: Context) => {
    try {
      const payload: ServerPathBrowseView = await browseServerPath({
        path: c.req.query("path"),
        basePath: c.req.query("basePath"),
        includeFiles: readIncludeFilesFlag(c.req.query("includeFiles")),
      });
      return c.json(ok(payload));
    } catch (error) {
      if (isServerPathBrowseError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };

  readonly search = async (c: Context) => {
    try {
      const payload: ServerPathSearchView = await this.searchService.search({
        basePath: c.req.query("basePath"),
        query: c.req.query("query"),
        limit: readPositiveInteger(c.req.query("limit")),
      });
      return c.json(ok(payload));
    } catch (error) {
      if (isServerPathSearchError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };

  readonly createDirectory = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(err("INVALID_SERVER_PATH_DIRECTORY", "directory input is required"), 400);
    }
    try {
      return c.json(ok(await createServerPathDirectory({
        parentPath: body.data.parentPath,
        name: body.data.name,
      })), 201);
    } catch (error) {
      if (isServerPathDirectoryCreateError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };

  readonly read = async (c: Context) => {
    try {
      const payload: ServerPathReadView = await readServerPath({
        path: c.req.query("path"),
        basePath: c.req.query("basePath"),
        line: readPositiveInteger(c.req.query("line")),
      });
      return c.json(ok(payload));
    } catch (error) {
      if (isServerPathReadError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };

  private readonly sendContent = async (
    c: Context,
    options: Parameters<typeof readServerPathContent>[0],
  ): Promise<Response> => {
    try {
      const payload = await readServerPathContent(options);
      return new Response(payload.content, {
        headers: {
          "content-type": payload.contentType,
          "cache-control": "no-store",
          "content-disposition": `inline; filename*=UTF-8''${encodeContentDispositionFileName(payload.fileName)}`,
        },
      });
    } catch (error) {
      if (isServerPathContentError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForServerPathContentError(error.code),
        );
      }
      throw error;
    }
  };

  readonly content = async (c: Context): Promise<Response> =>
    this.sendContent(c, { url: c.req.raw.url });

  readonly contentByPath = async (c: Context): Promise<Response> =>
    this.sendContent(c, {
      path: c.req.query("path"),
      basePath: c.req.query("basePath"),
    });
}

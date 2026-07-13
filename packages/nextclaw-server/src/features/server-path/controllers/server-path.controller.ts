import type { Context } from "hono";
import type { ServerPathBrowseView, ServerPathReadView } from "@nextclaw-server/shared/types/server-api.types.js";
import {
  browseServerPath,
  isServerPathBrowseError,
} from "@nextclaw-server/features/server-path/utils/server-path-browse.utils.js";
import {
  isServerPathReadError,
  readServerPath,
} from "@nextclaw-server/features/server-path/utils/server-path-read.utils.js";
import {
  isServerPathContentError,
  readServerPathContent,
} from "@nextclaw-server/features/server-path/utils/server-path-content.utils.js";
import { err, ok } from "@nextclaw-server/shared/utils/http-response.utils.js";

function readIncludeFilesFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function encodeContentDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/\*/g, "%2A");
}

function statusForServerPathContentError(code: string): 400 | 404 {
  return code === "SERVER_PATH_NOT_FOUND" ? 404 : 400;
}

export class ServerPathRoutesController {
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

  readonly read = async (c: Context) => {
    try {
      const payload: ServerPathReadView = await readServerPath({
        path: c.req.query("path"),
        basePath: c.req.query("basePath"),
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

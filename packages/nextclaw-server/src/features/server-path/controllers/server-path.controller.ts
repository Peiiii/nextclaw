import type { Context } from "hono";
import type { ServerPathBrowseView, ServerPathReadView } from "@/shared/types/server-api.types.js";
import {
  browseServerPath,
  isServerPathBrowseError,
} from "@/features/server-path/utils/server-path-browse.utils.js";
import {
  isServerPathReadError,
  readServerPath,
} from "@/features/server-path/utils/server-path-read.utils.js";
import { err, ok } from "@/shared/utils/http-response.utils.js";

function readIncludeFilesFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export class ServerPathRoutesController {
  readonly browse = async (c: Context) => {
    try {
      const payload: ServerPathBrowseView = await browseServerPath({
        path: c.req.query("path"),
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
}

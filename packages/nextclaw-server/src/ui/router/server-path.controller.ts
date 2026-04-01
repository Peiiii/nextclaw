import type { Context } from "hono";
import type { ServerPathBrowseView } from "../types.js";
import {
  browseServerPath,
  isServerPathBrowseError,
} from "../server-path/server-path-browse.utils.js";
import { err, ok } from "./response.js";

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
}

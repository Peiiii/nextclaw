import type { Context } from "hono";
import {
  isAppDataError,
  type AppDataManager,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

export class AppDataRoutesController {
  constructor(private readonly manager: AppDataManager) {}

  readonly list = async (c: Context) => {
    return c.json(ok(await this.manager.list()));
  };

  readonly deleteRetained = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (
      !body.ok ||
      !isRecord(body.data) ||
      typeof body.data.confirmAppId !== "string" ||
      !body.data.confirmAppId.trim()
    ) {
      return c.json(
        err("INVALID_APP_DATA_DELETE_REQUEST", "confirmAppId is required."),
        400,
      );
    }
    try {
      return c.json(ok(await this.manager.deleteRetained(
        c.req.param("dataId"),
        body.data.confirmAppId.trim(),
      )));
    } catch (error) {
      if (!isAppDataError(error)) {
        throw error;
      }
      const status = error.code === "APP_DATA_NOT_FOUND"
        ? 404
        : error.code === "APP_DATA_ACTIVE"
          ? 409
          : 400;
      return c.json(err(error.code, error.message), status);
    }
  };
}

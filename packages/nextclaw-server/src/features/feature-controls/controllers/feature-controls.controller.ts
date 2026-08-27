import type { Context } from "hono";
import type { FeatureControlsService } from "@nextclaw/kernel";
import { ok } from "@nextclaw-server/shared/utils/http-response.utils.js";

export class FeatureControlsRoutesController {
  constructor(private readonly featureControls: Pick<FeatureControlsService, "get">) {}

  readonly get = async (c: Context) => c.json(ok(await this.featureControls.get()));
}

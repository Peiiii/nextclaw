import { Hono } from "hono";
import { DomainValidationError, ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceItemType } from "../../domain/model";
import type { MarketplaceController } from "./marketplace-controller";
import type { ApiResponseFactory } from "./response";

export class MarketplaceRouter {
  private readonly app = new Hono();
  private readonly typedRoutes: ReadonlyArray<{ segment: "plugins" | "skills"; type: MarketplaceItemType }> = [
    { segment: "plugins", type: "plugin" },
    { segment: "skills", type: "skill" }
  ];

  constructor(
    private readonly controller: MarketplaceController,
    private readonly responses: ApiResponseFactory
  ) {}

  register() {
    this.app.notFound((c) => this.responses.error(c, "NOT_FOUND", "endpoint not found", 404));

    this.app.onError((error, c) => {
      if (error instanceof ResourceNotFoundError) {
        return this.responses.error(c, "NOT_FOUND", error.message, 404);
      }

      if (error instanceof DomainValidationError) {
        return this.responses.error(c, "INVALID_QUERY", error.message, 400);
      }

      return this.responses.error(c, "INTERNAL_ERROR", error.message || "internal error", 500);
    });

    this.app.use("/api/v1/*", async (c, next) => {
      if (c.req.method !== "GET") {
        return this.responses.error(c, "READ_ONLY_API", "marketplace api is read-only", 405);
      }
      await next();
      return undefined;
    });

    this.app.get("/health", (c) => this.controller.health(c));
    for (const route of this.typedRoutes) {
      this.app.get(`/api/v1/${route.segment}/items`, (c) => this.controller.listItems(c, route.type));
      this.app.get(`/api/v1/${route.segment}/items/:slug`, (c) => this.controller.getItem(c, route.type));
      this.app.get(`/api/v1/${route.segment}/recommendations`, (c) => this.controller.listRecommendations(c, route.type));
    }

    return this.app;
  }
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  ApiEnvelope,
  ItemsQuery,
  ItemsResponse,
  PortalOverview,
  PublicItemDetail,
  UpdatesResponse
} from "../shared/public-roadmap-feedback-portal.types.js";
import { PortalQueryService } from "./portal-query.service.js";

const queryService = new PortalQueryService();

function okEnvelope<T>(data: T): ApiEnvelope<T> {
  return {
    ok: true,
    data
  };
}

function errorEnvelope(code: string, message: string): ApiEnvelope<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export const publicRoadmapFeedbackPortalApp = new Hono();

publicRoadmapFeedbackPortalApp.use("/api/*", cors());

publicRoadmapFeedbackPortalApp.get("/health", (c) => {
  return c.json(okEnvelope({
    status: "ok"
  }));
});

publicRoadmapFeedbackPortalApp.get("/api/overview", (c) => {
  try {
    const overview: PortalOverview = queryService.getOverview();
    return c.json(okEnvelope(overview));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load portal overview.";
    return c.json(errorEnvelope("OVERVIEW_FAILED", message), 500);
  }
});

publicRoadmapFeedbackPortalApp.get("/api/items", (c) => {
  try {
    const query: ItemsQuery = {
      phase: queryService.isKnownPhase(`${c.req.query("phase") ?? ""}`)
        ? c.req.query("phase") as ItemsQuery["phase"]
        : "all",
      type: queryService.isKnownType(`${c.req.query("type") ?? ""}`)
        ? c.req.query("type") as ItemsQuery["type"]
        : "all",
      sort: c.req.query("sort") === "hot" ? "hot" : "recent",
      view: c.req.query("view") === "list" ? "list" : "board"
    };
    const items: ItemsResponse = queryService.listItems(query);
    return c.json(okEnvelope(items));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load roadmap items.";
    return c.json(errorEnvelope("ITEMS_FAILED", message), 500);
  }
});

publicRoadmapFeedbackPortalApp.get("/api/items/:itemId", (c) => {
  try {
    const detail: PublicItemDetail = queryService.getItemDetail(c.req.param("itemId"));
    return c.json(okEnvelope(detail));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load roadmap item.";
    const status = message.startsWith("Unknown public roadmap item") ? 404 : 500;
    return c.json(errorEnvelope(status === 404 ? "ITEM_NOT_FOUND" : "ITEM_DETAIL_FAILED", message), status);
  }
});

publicRoadmapFeedbackPortalApp.get("/api/updates", (c) => {
  try {
    const updates: UpdatesResponse = queryService.getUpdates();
    return c.json(okEnvelope(updates));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load product updates.";
    return c.json(errorEnvelope("UPDATES_FAILED", message), 500);
  }
});

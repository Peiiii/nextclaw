import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  ApiEnvelope,
  LeaderboardOverview,
  ProductDetail
} from "../shared/competitive-leaderboard.types.js";
import { CompetitiveLeaderboardDataService } from "./leaderboard-data.service.js";
import { CompetitiveLeaderboardScoringService } from "./leaderboard-scoring.service.js";

const dataService = new CompetitiveLeaderboardDataService();
const scoringService = new CompetitiveLeaderboardScoringService(dataService);

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

export const competitiveLeaderboardApp = new Hono();

competitiveLeaderboardApp.use("/api/*", cors());

competitiveLeaderboardApp.get("/health", (c) => {
  return c.json(okEnvelope({
    status: "ok"
  }));
});

competitiveLeaderboardApp.get("/api/leaderboard", (c) => {
  try {
    const overview: LeaderboardOverview = scoringService.createOverview();
    return c.json(okEnvelope(overview));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leaderboard overview.";
    return c.json(errorEnvelope("OVERVIEW_FAILED", message), 500);
  }
});

competitiveLeaderboardApp.get("/api/products/:productId", (c) => {
  try {
    const detail: ProductDetail = scoringService.getProductDetail(c.req.param("productId"));
    return c.json(okEnvelope(detail));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load product detail.";
    const status = message.startsWith("Unknown leaderboard product") ? 404 : 400;
    return c.json(errorEnvelope(status === 404 ? "PRODUCT_NOT_FOUND" : "PRODUCT_DETAIL_FAILED", message), status);
  }
});

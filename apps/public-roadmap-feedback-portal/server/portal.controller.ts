import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type {
  ApiEnvelope,
  CreateCommentInput,
  CreateCommentResponse,
  CreateFeedbackInput,
  CreateFeedbackResponse,
  CreateVoteResponse,
  FeedbackQuery,
  FeedbackResponse,
  ItemsQuery,
  ItemsResponse,
  PortalOverview,
  PublicItemDetail,
  UpdatesResponse
} from "../shared/public-roadmap-feedback-portal.types.js";
import {
  COMMUNITY_FEEDBACK_STATUSES,
  PUBLIC_ITEM_TYPES as PORTAL_ITEM_TYPES,
  PUBLIC_PHASES
} from "../shared/public-roadmap-feedback-portal.types.js";
import type { PortalWorkerEnv } from "./portal-env.types.js";
import { PortalRequestError } from "./portal-request-error.utils.js";
import { PortalRuntimeService } from "./portal-runtime.service.js";
import { supportController } from "./support/support.controller.js";
import { discussionController } from "./discussion/discussion.controller.js";

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

export const publicRoadmapFeedbackPortalApp = new Hono<{
  Bindings: PortalWorkerEnv;
}>();

publicRoadmapFeedbackPortalApp.use("/api/*", cors());
publicRoadmapFeedbackPortalApp.route("/api/support", supportController);
publicRoadmapFeedbackPortalApp.route("/api/discussions", discussionController);

publicRoadmapFeedbackPortalApp.get("/health", (c) => {
  return c.json(okEnvelope({
    status: "ok"
  }));
});

publicRoadmapFeedbackPortalApp.get("/api/overview", (c) => {
  return runJson(c, async () => {
    const overview: PortalOverview = await createRuntime(c.env).getOverview();
    return overview;
  }, "OVERVIEW_FAILED", "Failed to load portal overview.");
});

publicRoadmapFeedbackPortalApp.get("/api/items", (c) => {
  return runJson(c, async () => {
    const runtime = createRuntime(c.env);
    const query: ItemsQuery = {
      phase: isKnownPhase(`${c.req.query("phase") ?? ""}`) ? c.req.query("phase") as ItemsQuery["phase"] : "all",
      type: isKnownType(`${c.req.query("type") ?? ""}`) ? c.req.query("type") as ItemsQuery["type"] : "all",
      sort: c.req.query("sort") === "hot" ? "hot" : "recent",
      view: c.req.query("view") === "list" ? "list" : "board"
    };
    const items: ItemsResponse = await runtime.listItems(query);
    return items;
  }, "ITEMS_FAILED", "Failed to load roadmap items.");
});

publicRoadmapFeedbackPortalApp.get("/api/items/:itemId", (c) => {
  return runJson(c, async () => {
    const detail: PublicItemDetail = await createRuntime(c.env).getItemDetail(c.req.param("itemId"));
    return detail;
  }, "ITEM_DETAIL_FAILED", "Failed to load roadmap item.");
});

publicRoadmapFeedbackPortalApp.post("/api/items/:itemId/votes", (c) => {
  return runJson(c, async () => {
    const response: CreateVoteResponse = await createRuntime(c.env).createVote("item", c.req.param("itemId"));
    return response;
  }, "ITEM_VOTE_FAILED", "Failed to create item vote.");
});

publicRoadmapFeedbackPortalApp.post("/api/items/:itemId/comments", (c) => {
  return runJson(c, async () => {
    const input = await readJsonBody<CreateCommentInput>(c);
    const response: CreateCommentResponse = await createRuntime(c.env).createComment("item", c.req.param("itemId"), input);
    return response;
  }, "ITEM_COMMENT_FAILED", "Failed to create item comment.");
});

publicRoadmapFeedbackPortalApp.get("/api/feedback", (c) => {
  return runJson(c, async () => {
    const query: FeedbackQuery = {
      status: isKnownFeedbackStatus(`${c.req.query("status") ?? ""}`) ? c.req.query("status") as FeedbackQuery["status"] : "all",
      linkedItemId: c.req.query("linkedItemId")?.trim() ? c.req.query("linkedItemId") as FeedbackQuery["linkedItemId"] : "all",
      sort: c.req.query("sort") === "hot" ? "hot" : "recent"
    };
    const response: FeedbackResponse = await createRuntime(c.env).listFeedback(query);
    return response;
  }, "FEEDBACK_FAILED", "Failed to load community feedback.");
});

publicRoadmapFeedbackPortalApp.post("/api/feedback", (c) => {
  return runJson(c, async () => {
    const input = await readJsonBody<CreateFeedbackInput>(c);
    const response: CreateFeedbackResponse = await createRuntime(c.env).createFeedback(input);
    return response;
  }, "FEEDBACK_CREATE_FAILED", "Failed to create community feedback.");
});

publicRoadmapFeedbackPortalApp.post("/api/feedback/:feedbackId/votes", (c) => {
  return runJson(c, async () => {
    const response: CreateVoteResponse = await createRuntime(c.env).createVote("feedback", c.req.param("feedbackId"));
    return response;
  }, "FEEDBACK_VOTE_FAILED", "Failed to create feedback vote.");
});

publicRoadmapFeedbackPortalApp.post("/api/feedback/:feedbackId/comments", (c) => {
  return runJson(c, async () => {
    const input = await readJsonBody<CreateCommentInput>(c);
    const response: CreateCommentResponse = await createRuntime(c.env).createComment("feedback", c.req.param("feedbackId"), input);
    return response;
  }, "FEEDBACK_COMMENT_FAILED", "Failed to create feedback comment.");
});

publicRoadmapFeedbackPortalApp.get("/api/updates", (c) => {
  return runJson(c, async () => {
    const updates: UpdatesResponse = await createRuntime(c.env).getUpdates();
    return updates;
  }, "UPDATES_FAILED", "Failed to load product updates.");
});

publicRoadmapFeedbackPortalApp.post("/internal/sync/linear", (c) => {
  return runJson(c, async () => {
    const runtime = createRuntime(c.env);
    runtime.assertInternalToken(c.req.header("authorization") ?? c.req.header("x-portal-internal-token") ?? null);
    return await runtime.syncLinearRoadmap();
  }, "SYNC_FAILED", "Failed to sync Linear roadmap.");
});

function createRuntime(env: PortalWorkerEnv): PortalRuntimeService {
  return new PortalRuntimeService(env);
}

function isKnownPhase(phase: string): boolean {
  return PUBLIC_PHASES.includes(phase as never);
}

function isKnownType(type: string): boolean {
  return PORTAL_ITEM_TYPES.includes(type as never);
}

function isKnownFeedbackStatus(status: string): boolean {
  return COMMUNITY_FEEDBACK_STATUSES.includes(status as never);
}

async function readJsonBody<T>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw new PortalRequestError(400, "INVALID_JSON_BODY", "请求体不是合法的 JSON。");
  }
}

async function runJson<T>(
  c: Context,
  action: () => Promise<T>,
  code: string,
  defaultMessage: string
): Promise<Response> {
  try {
    const data = await action();
    return c.json(okEnvelope(data));
  } catch (error) {
    if (error instanceof PortalRequestError) {
      return c.json(errorEnvelope(error.code, error.message), error.status as 400 | 404 | 500);
    }
    const message = error instanceof Error ? error.message : defaultMessage;
    const status = getStatusFromMessage(message);
    const errorCode = status === 404
      ? getMissingResourceCode(message)
      : code;
    return c.json(errorEnvelope(errorCode, message), status as 404 | 500);
  }
}

function getStatusFromMessage(message: string): number {
  if (message.startsWith("Unknown public roadmap item") || message.startsWith("Unknown feedback entry")) {
    return 404;
  }
  return 500;
}

function getMissingResourceCode(message: string): string {
  if (message.startsWith("Unknown feedback entry")) {
    return "FEEDBACK_NOT_FOUND";
  }
  return "ITEM_NOT_FOUND";
}

import type { Hono } from "hono";
import {
  adminOverviewHandler,
  adminProfitOverviewHandler,
  adminProvidersHandler,
  adminRechargeIntentsHandler,
  adminUsersHandler,
  adminModelsHandler,
  confirmRechargeIntentHandler,
  createAdminProviderHandler,
  patchAdminSettingsHandler,
  patchAdminProviderHandler,
  patchAdminUserHandler,
  putAdminModelHandler,
  rejectRechargeIntentHandler
} from "./controllers/admin-controller";
import { loginHandler, meHandler, registerHandler } from "./controllers/auth-controller";
import {
  billingLedgerHandler,
  billingOverviewHandler,
  billingRechargeIntentsHandler,
  createRechargeIntentHandler
} from "./controllers/billing-controller";
import { chatCompletionsHandler, healthHandler, modelsHandler, usageHandler } from "./controllers/openai-controller";
import type { Env } from "./types/platform";

export function registerRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/health", healthHandler);

  app.get("/v1/models", modelsHandler);
  app.get("/v1/usage", usageHandler);
  app.post("/v1/chat/completions", chatCompletionsHandler);

  app.post("/platform/auth/register", registerHandler);
  app.post("/platform/auth/login", loginHandler);
  app.get("/platform/auth/me", meHandler);

  app.get("/platform/billing/overview", billingOverviewHandler);
  app.get("/platform/billing/ledger", billingLedgerHandler);
  app.get("/platform/billing/recharge-intents", billingRechargeIntentsHandler);
  app.post("/platform/billing/recharge-intents", createRechargeIntentHandler);

  app.get("/platform/admin/overview", adminOverviewHandler);
  app.get("/platform/admin/profit/overview", adminProfitOverviewHandler);
  app.get("/platform/admin/users", adminUsersHandler);
  app.patch("/platform/admin/users/:userId", patchAdminUserHandler);
  app.get("/platform/admin/providers", adminProvidersHandler);
  app.post("/platform/admin/providers", createAdminProviderHandler);
  app.patch("/platform/admin/providers/:providerId", patchAdminProviderHandler);
  app.get("/platform/admin/models", adminModelsHandler);
  app.put("/platform/admin/models/:publicModelId", putAdminModelHandler);
  app.get("/platform/admin/recharge-intents", adminRechargeIntentsHandler);
  app.post("/platform/admin/recharge-intents/:intentId/confirm", confirmRechargeIntentHandler);
  app.post("/platform/admin/recharge-intents/:intentId/reject", rejectRechargeIntentHandler);
  app.patch("/platform/admin/settings", patchAdminSettingsHandler);
}

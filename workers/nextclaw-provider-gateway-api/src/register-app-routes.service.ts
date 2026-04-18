import type { Hono } from "hono";
import {
  completeBrowserPasswordResetHandler,
  completeBrowserRegisterHandler,
  browserAuthPageHandler,
  loginBrowserAuthHandler,
  pollBrowserAuthHandler,
  sendBrowserPasswordResetCodeHandler,
  sendBrowserRegisterCodeHandler,
  startBrowserAuthHandler,
} from "./auth-browser-route.controller";
import {
  completePasswordResetHandler,
  completeRegisterHandler,
  sendPasswordResetCodeHandler,
  sendRegisterCodeHandler,
} from "./auth-email-code-route-handlers";
import {
  adminOverviewHandler,
  adminProfitOverviewHandler,
  adminProvidersHandler,
  adminRechargeIntentsHandler,
  adminUsersHandler,
  adminModelsHandler,
  createAdminProviderHandler,
  patchAdminSettingsHandler,
  patchAdminProviderHandler,
  patchAdminUserHandler,
  putAdminModelHandler,
} from "./controllers/admin-controller";
import {
  confirmRechargeIntentHandler,
  rejectRechargeIntentHandler,
} from "./controllers/admin-recharge-controller";
import {
  adminMarketplaceSkillDetailHandler,
  adminMarketplaceSkillsHandler,
  reviewAdminMarketplaceSkillHandler,
} from "./controllers/marketplace/admin-marketplace-controller";
import { loginHandler, meHandler, patchProfileHandler } from "./controllers/auth-controller";
import {
  billingLedgerHandler,
  billingOverviewHandler,
  billingRechargeIntentsHandler,
  createRechargeIntentHandler,
} from "./controllers/billing-controller";
import { chatCompletionsHandler, healthHandler, modelsHandler, usageHandler } from "./controllers/openai-controller";
import {
  createRemoteShareGrantHandler,
  listRemoteShareGrantsHandler,
  openRemoteShareSessionHandler,
  openRemoteSessionRedirectHandler,
  remoteBrowserRuntimeHandler,
  remoteBrowserWebSocketHandler,
  revokeRemoteShareGrantHandler,
  remoteConnectorWebSocketHandler,
} from "./controllers/remote-controller";
import {
  archiveRemoteInstanceHandler,
  deleteRemoteInstanceHandler,
  listRemoteDevicesHandler,
  listRemoteInstancesHandler,
  openRemoteDeviceHandler,
  openRemoteInstanceHandler,
  registerRemoteDeviceHandler,
  registerRemoteInstanceHandler,
  unarchiveRemoteInstanceHandler,
} from "./controllers/remote-instance-controller";
import { adminRemoteQuotaSummaryHandler, remoteQuotaSummaryHandler } from "./controllers/remote-quota-controller";
import type { Env } from "./types/platform";

function registerPlatformAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post("/platform/auth/login", loginHandler);
  app.post("/platform/auth/register/send-code", sendRegisterCodeHandler);
  app.post("/platform/auth/register/complete", completeRegisterHandler);
  app.post("/platform/auth/password/reset/send-code", sendPasswordResetCodeHandler);
  app.post("/platform/auth/password/reset/complete", completePasswordResetHandler);
  app.get("/platform/auth/me", meHandler);
  app.patch("/platform/auth/profile", patchProfileHandler);
  app.post("/platform/auth/browser/start", startBrowserAuthHandler);
  app.post("/platform/auth/browser/poll", pollBrowserAuthHandler);
  app.get("/platform/auth/browser", browserAuthPageHandler);
  app.post("/platform/auth/browser/login", loginBrowserAuthHandler);
  app.post("/platform/auth/browser/register/send-code", sendBrowserRegisterCodeHandler);
  app.post("/platform/auth/browser/register/complete", completeBrowserRegisterHandler);
  app.post("/platform/auth/browser/reset-password/send-code", sendBrowserPasswordResetCodeHandler);
  app.post("/platform/auth/browser/reset-password/complete", completeBrowserPasswordResetHandler);
}

function registerRemoteAccessRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/_remote/runtime", remoteBrowserRuntimeHandler);
  app.get("/_remote/ws", remoteBrowserWebSocketHandler);
  app.get("/platform/remote/instances", listRemoteInstancesHandler);
  app.get("/platform/remote/quota", remoteQuotaSummaryHandler);
  app.post("/platform/remote/instances/register", registerRemoteInstanceHandler);
  app.post("/platform/remote/instances/:instanceId/open", openRemoteInstanceHandler);
  app.post("/platform/remote/instances/:instanceId/archive", archiveRemoteInstanceHandler);
  app.post("/platform/remote/instances/:instanceId/unarchive", unarchiveRemoteInstanceHandler);
  app.post("/platform/remote/instances/:instanceId/delete", deleteRemoteInstanceHandler);
  app.get("/platform/remote/instances/:instanceId/shares", listRemoteShareGrantsHandler);
  app.post("/platform/remote/instances/:instanceId/shares", createRemoteShareGrantHandler);
  app.post("/platform/remote/shares/:grantId/revoke", revokeRemoteShareGrantHandler);
  app.get("/platform/remote/devices", listRemoteDevicesHandler);
  app.post("/platform/remote/devices/register", registerRemoteDeviceHandler);
  app.post("/platform/remote/devices/:deviceId/open", openRemoteDeviceHandler);
  app.post("/platform/share/:grantToken/open", openRemoteShareSessionHandler);
  app.get("/platform/remote/open", openRemoteSessionRedirectHandler);
  app.get("/platform/remote/connect", remoteConnectorWebSocketHandler);
}

export function registerAppRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/health", healthHandler);

  app.get("/v1/models", modelsHandler);
  app.get("/v1/usage", usageHandler);
  app.post("/v1/chat/completions", chatCompletionsHandler);

  registerPlatformAuthRoutes(app);
  registerRemoteAccessRoutes(app);

  app.get("/platform/billing/overview", billingOverviewHandler);
  app.get("/platform/billing/ledger", billingLedgerHandler);
  app.get("/platform/billing/recharge-intents", billingRechargeIntentsHandler);
  app.post("/platform/billing/recharge-intents", createRechargeIntentHandler);

  app.get("/platform/admin/overview", adminOverviewHandler);
  app.get("/platform/admin/remote/quota", adminRemoteQuotaSummaryHandler);
  app.get("/platform/admin/profit/overview", adminProfitOverviewHandler);
  app.get("/platform/admin/marketplace/skills", adminMarketplaceSkillsHandler);
  app.get("/platform/admin/marketplace/skills/:selector", adminMarketplaceSkillDetailHandler);
  app.post("/platform/admin/marketplace/skills/:selector/review", reviewAdminMarketplaceSkillHandler);
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

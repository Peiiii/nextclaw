import type { Hono } from "hono";
import {
  authorizeBrowserAuthHandler,
  browserAuthPageHandler,
  pollBrowserAuthHandler,
  startBrowserAuthHandler
} from "./controllers/auth-browser-controller";
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
  putAdminModelHandler
} from "./controllers/admin-controller";
import {
  confirmRechargeIntentHandler,
  rejectRechargeIntentHandler
} from "./controllers/admin-recharge-controller";
import {
  adminMarketplaceAppDetailHandler,
  adminMarketplaceAppsHandler,
  reviewAdminMarketplaceAppHandler
} from "./controllers/marketplace/admin-marketplace-app-controller";
import {
  adminMarketplaceSkillDetailHandler,
  adminMarketplaceSkillsHandler,
  reviewAdminMarketplaceSkillHandler
} from "./controllers/marketplace/admin-marketplace-controller";
import { loginHandler, meHandler, patchProfileHandler, registerHandler } from "./controllers/auth-controller";
import {
  manageOwnerMarketplaceAppHandler,
  ownerMarketplaceAppDetailHandler,
  ownerMarketplaceAppsHandler
} from "./controllers/marketplace/user-marketplace-app-controller";
import {
  billingLedgerHandler,
  billingOverviewHandler,
  billingRechargeIntentsHandler,
  createRechargeIntentHandler
} from "./controllers/billing-controller";
import { chatCompletionsHandler, healthHandler, modelsHandler, usageHandler } from "./controllers/openai-controller";
import {
  createRemoteShareGrantHandler,
  listRemoteShareGrantsHandler,
  openRemoteShareSessionHandler,
  openRemoteSessionRedirectHandler,
  revokeRemoteShareGrantHandler,
  remoteConnectorWebSocketHandler
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
  unarchiveRemoteInstanceHandler
} from "./controllers/remote-instance-controller";
import { adminRemoteQuotaSummaryHandler, remoteQuotaSummaryHandler } from "./controllers/remote-quota-controller";
import type { Env } from "./types/platform";

function registerPlatformAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post("/platform/auth/register", registerHandler);
  app.post("/platform/auth/login", loginHandler);
  app.get("/platform/auth/me", meHandler);
  app.patch("/platform/auth/profile", patchProfileHandler);
  app.post("/platform/auth/browser/start", startBrowserAuthHandler);
  app.post("/platform/auth/browser/poll", pollBrowserAuthHandler);
  app.get("/platform/auth/browser", browserAuthPageHandler);
  app.post("/platform/auth/browser/authorize", authorizeBrowserAuthHandler);
}

function registerRemoteAccessRoutes(app: Hono<{ Bindings: Env }>): void {
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

function registerPublicRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/health", healthHandler);
  app.get("/v1/models", modelsHandler);
  app.get("/v1/usage", usageHandler);
  app.post("/v1/chat/completions", chatCompletionsHandler);
}

function registerBillingRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/platform/billing/overview", billingOverviewHandler);
  app.get("/platform/billing/ledger", billingLedgerHandler);
  app.get("/platform/billing/recharge-intents", billingRechargeIntentsHandler);
  app.post("/platform/billing/recharge-intents", createRechargeIntentHandler);
}

function registerMarketplaceRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/platform/admin/marketplace/skills", adminMarketplaceSkillsHandler);
  app.get("/platform/admin/marketplace/skills/:selector", adminMarketplaceSkillDetailHandler);
  app.post("/platform/admin/marketplace/skills/:selector/review", reviewAdminMarketplaceSkillHandler);
  app.get("/platform/admin/marketplace/apps", adminMarketplaceAppsHandler);
  app.get("/platform/admin/marketplace/apps/:selector", adminMarketplaceAppDetailHandler);
  app.post("/platform/admin/marketplace/apps/:selector/review", reviewAdminMarketplaceAppHandler);
  app.get("/platform/marketplace/apps", ownerMarketplaceAppsHandler);
  app.get("/platform/marketplace/apps/:selector", ownerMarketplaceAppDetailHandler);
  app.post("/platform/marketplace/apps/:selector/manage", manageOwnerMarketplaceAppHandler);
}

function registerAdminRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get("/platform/admin/overview", adminOverviewHandler);
  app.get("/platform/admin/remote/quota", adminRemoteQuotaSummaryHandler);
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

export function registerRoutes(app: Hono<{ Bindings: Env }>): void {
  registerPublicRoutes(app);
  registerPlatformAuthRoutes(app);
  registerRemoteAccessRoutes(app);
  registerBillingRoutes(app);
  registerMarketplaceRoutes(app);
  registerAdminRoutes(app);
}

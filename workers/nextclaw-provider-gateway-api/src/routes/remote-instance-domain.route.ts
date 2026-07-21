import { Hono } from "hono";
import {
  releaseRemoteInstanceDomainHandler,
  updateRemoteInstanceDomainHandler,
} from "@/controllers/remote-instance-configuration.controller.js";
import type { Env } from "@/types/platform.js";

export const remoteInstanceDomainRoutes = new Hono<{ Bindings: Env }>();

remoteInstanceDomainRoutes.put(
  "/platform/remote/instances/:instanceId/domain",
  updateRemoteInstanceDomainHandler,
);
remoteInstanceDomainRoutes.delete(
  "/platform/remote/instances/:instanceId/domain",
  releaseRemoteInstanceDomainHandler,
);

import { createNextClawAppClient } from "../nextclaw-app-client.utils.js";
import { NextClawClient } from "../nextclaw-client.manager.js";
import { NextClawClientError } from "../services/request.service.js";

type PanelAppClientGlobal = typeof globalThis & {
  createNextClawAppClient?: typeof createNextClawAppClient;
  NextClawClient?: typeof NextClawClient;
  NextClawClientError?: typeof NextClawClientError;
};

const target = globalThis as PanelAppClientGlobal;

Object.defineProperty(target, "createNextClawAppClient", {
  configurable: true,
  value: createNextClawAppClient,
});

Object.defineProperty(target, "NextClawClient", {
  configurable: true,
  value: NextClawClient,
});

Object.defineProperty(target, "NextClawClientError", {
  configurable: true,
  value: NextClawClientError,
});

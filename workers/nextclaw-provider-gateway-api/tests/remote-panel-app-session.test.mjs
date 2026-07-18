import assert from "node:assert/strict";
import {
  isPanelAppSandboxProxyRequest,
  readRemoteSessionIdFromHost,
} from "../dist/utils/remote-panel-app-request.utils.js";

function createRequest(path, options = {}) {
  return new Request(new URL(path, "https://r-session-id.claw.cool"), {
    method: options.method ?? "GET",
    headers: options.headers,
  });
}

assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/panel-app-assets/signed-asset-token/styles.css")),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/panel-app-client-sdk.js")),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/service-actions/demo.invoke", {
    method: "POST",
    headers: {
      origin: "null",
      "x-nextclaw-panel-bridge-session": "panel-runtime-token",
    },
  })),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/service-actions/demo.invoke", {
    method: "OPTIONS",
    headers: {
      origin: "null",
      "access-control-request-headers": "content-type, x-nextclaw-panel-bridge-session",
    },
  })),
  true,
);

assert.equal(isPanelAppSandboxProxyRequest(createRequest("/api/health")), false);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/health", {
    headers: {
      origin: "https://attacker.example",
      "x-nextclaw-panel-bridge-session": "panel-runtime-token",
    },
  })),
  false,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/chat/session", {
    headers: {
      origin: "null",
      "x-nextclaw-panel-bridge-session": "panel-runtime-token",
    },
  })),
  false,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/health", {
    method: "OPTIONS",
    headers: {
      origin: "null",
      "access-control-request-headers": "content-type",
    },
  })),
  false,
);

assert.equal(readRemoteSessionIdFromHost("r-session-id.claw.cool", "claw.cool"), "session-id");
assert.equal(readRemoteSessionIdFromHost("claw.cool", "claw.cool"), null);
assert.equal(readRemoteSessionIdFromHost("attacker.r-session-id.claw.cool", "claw.cool"), null);
assert.equal(readRemoteSessionIdFromHost("r-session-id.attacker.example", "claw.cool"), null);

console.log("[remote-panel-app-session] passed");

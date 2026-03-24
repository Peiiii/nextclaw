import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchRemoteStaticAssetResponse,
  isRemoteStaticAssetRequest,
} from "../dist/services/remote-static-assets-service.js";

test("remote static asset filter only admits safe browser shell requests", () => {
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/", { method: "GET" })), true);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/chat", { method: "GET" })), true);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/assets/app.js", { method: "HEAD" })), true);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/platform/remote/open", { method: "GET" })), false);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/_remote/runtime", { method: "GET" })), false);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/v1/models", { method: "GET" })), false);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/health", { method: "GET" })), false);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/", {
    method: "GET",
    headers: { upgrade: "websocket" }
  })), false);
  assert.equal(isRemoteStaticAssetRequest(new Request("https://r-session.claw.cool/", { method: "POST" })), false);
});

test("remote static assets fall back to index.html for spa routes", async () => {
  const requested = [];
  const response = await fetchRemoteStaticAssetResponse({
    assets: {
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(String(input));
        requested.push(new URL(request.url).pathname);
        if (new URL(request.url).pathname === "/chat") {
          return new Response("not found", { status: 404 });
        }
        if (new URL(request.url).pathname === "/index.html") {
          return new Response("<html>shell</html>", {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        }
        return new Response("unexpected", { status: 500 });
      }
    },
    request: new Request("https://r-session.claw.cool/chat")
  });

  assert.deepEqual(requested, ["/chat", "/index.html"]);
  assert.equal(response?.status, 200);
  assert.equal(await response?.text(), "<html>shell</html>");
});

test("remote static assets do not mask missing real files", async () => {
  const requested = [];
  const response = await fetchRemoteStaticAssetResponse({
    assets: {
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(String(input));
        requested.push(new URL(request.url).pathname);
        return new Response("not found", { status: 404 });
      }
    },
    request: new Request("https://r-session.claw.cool/assets/app.js")
  });

  assert.deepEqual(requested, ["/assets/app.js"]);
  assert.equal(response, null);
});

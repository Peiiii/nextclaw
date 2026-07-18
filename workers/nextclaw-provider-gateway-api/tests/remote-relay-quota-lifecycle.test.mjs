import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { NextclawRemoteRelayDurableObject } from "../dist/controllers/remote-relay-durable-object.controller.js";

globalThis.WebSocket = WebSocket;

test("browser quota lease survives burst ordering and relay durable object reactivation", async () => {
  const leaseRequests = [];
  const forwardedFrames = [];
  let concurrencyGate = Promise.resolve();
  let attachment = {
    type: "client",
    clientId: "client-a",
    userId: "user-a",
    sessionId: "session-a",
    instanceId: "instance-a",
    quotaTicket: "ticket-a",
    connectedAt: new Date(0).toISOString(),
    remainingQuotaMessages: 10,
    unsettledQuotaMessages: 0,
    quotaReleased: false
  };

  const browserSocket = {
    readyState: WebSocket.OPEN,
    deserializeAttachment: () => attachment,
    serializeAttachment: (value) => {
      attachment = value;
    },
    send: () => {}
  };
  const connectorSocket = {
    readyState: WebSocket.OPEN,
    deserializeAttachment: () => ({
      type: "connector",
      deviceId: "instance-a",
      userId: "user-a",
      connectedAt: new Date(0).toISOString(),
      unsettledQuotaMessages: 0
    }),
    send: (value) => {
      forwardedFrames.push(JSON.parse(value));
    }
  };
  const state = {
    getWebSockets: (tag) => tag === "connector" ? [connectorSocket] : [browserSocket],
    blockConcurrencyWhile: (callback) => {
      const current = concurrencyGate.catch(() => undefined).then(callback);
      concurrencyGate = current;
      return current;
    },
    waitUntil: () => {}
  };
  const env = {
    NEXTCLAW_REMOTE_QUOTA: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (_url, init) => {
          leaseRequests.push(JSON.parse(init.body));
          return new Response(JSON.stringify({
            ok: true,
            data: { grantedMessages: 10 }
          }), {
            headers: { "content-type": "application/json" }
          });
        }
      })
    }
  };

  const firstRelayActivation = new NextclawRemoteRelayDurableObject(state, env);
  const burst = [];
  for (let index = 0; index < 6; index += 1) {
    burst.push(firstRelayActivation.webSocketMessage(browserSocket, JSON.stringify({
      type: "request",
      id: `request-${index}`,
      target: { method: "GET", path: "/api/health" }
    })));
  }
  await Promise.all(burst);

  for (let index = 6; index < 11; index += 1) {
    const relay = new NextclawRemoteRelayDurableObject(state, env);
    await relay.webSocketMessage(browserSocket, JSON.stringify({
      type: "request",
      id: `request-${index}`,
      target: { method: "GET", path: "/api/health" }
    }));
  }

  assert.equal(leaseRequests.length, 1);
  assert.equal(leaseRequests[0].requestedMessages, 10);
  assert.equal(leaseRequests[0].settledMessages, 11);
  assert.equal(leaseRequests[0].ticket, "ticket-a");
  assert.equal(attachment.remainingQuotaMessages, 10);
  assert.equal(attachment.unsettledQuotaMessages, 0);
  assert.equal(forwardedFrames.length, 11);
  assert.deepEqual(forwardedFrames.map((frame) => frame.id), Array.from(
    { length: 11 },
    (_value, index) => `request-${index}`
  ));
});

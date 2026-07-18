import assert from "node:assert/strict";
import test from "node:test";
import { NextclawRemoteQuotaDurableObject } from "../dist/controllers/remote-quota-durable-object.controller.js";

test("quota durable object exposes the v2 acquire, settlement, report, and summary contract", async () => {
  let storedState;
  const durableObject = new NextclawRemoteQuotaDurableObject({
    storage: {
      get: async () => storedState,
      put: async (_key, value) => {
        storedState = structuredClone(value);
      }
    }
  }, {
    REMOTE_CLOUDFLARE_PLAN_PROFILE: "workers-free",
    REMOTE_QUOTA_INSTANCE_CONNECTIONS: "10000",
    REMOTE_PLATFORM_DAILY_RESERVE_PERCENT: "20",
    REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS: "20000",
    REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS: "20000",
    REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE: "10",
    REMOTE_QUOTA_WS_USAGE_REPORT_SIZE: "100"
  });

  const acquired = await post(durableObject, "/browser-connection/acquire", {
    userId: "user-a",
    ticket: "ticket-a",
    clientId: "client-a",
    sessionId: "session-a",
    instanceId: "instance-a"
  });
  assert.equal(acquired.response.status, 200);
  assert.deepEqual(acquired.payload.data, { ticket: "ticket-a", grantedMessages: 10 });

  const settled = await post(durableObject, "/ws-message/settle-and-lease", {
    userId: "user-a",
    ticket: "ticket-a",
    settledMessages: 10,
    requestedMessages: 10
  });
  assert.equal(settled.response.status, 200);
  assert.equal(settled.payload.data.grantedMessages, 10);

  const reported = await post(durableObject, "/ws-message/report", {
    userId: "user-a",
    messages: 20
  });
  assert.equal(reported.response.status, 200);
  assert.equal(reported.payload.data.recordedMessages, 20);

  const response = await durableObject.fetch(new Request(
    "https://remote-quota.internal/summary/user?userId=user-a"
  ));
  const summary = await response.json();
  assert.equal(response.status, 200);
  assert.equal(summary.data.costModel.version, 2);
  assert.equal(summary.data.day.workerRequests.actualUsed, 1);
  assert.equal(summary.data.day.durableObjectRequests.actualUsed, 5.5);
  assert.equal(summary.data.day.durableObjectRequests.reserved, 1.5);
  assert.equal("sessionRequestsPerMinute" in summary.data, false);
});

test("quota durable object rejects deployment without an explicit Cloudflare plan profile", async () => {
  const durableObject = new NextclawRemoteQuotaDurableObject({
    storage: {
      get: async () => undefined,
      put: async () => undefined
    }
  }, {});
  await assert.rejects(
    durableObject.fetch(new Request("https://remote-quota.internal/summary/platform")),
    /REMOTE_CLOUDFLARE_PLAN_PROFILE/
  );
});

async function post(durableObject, path, body) {
  const response = await durableObject.fetch(new Request(`https://remote-quota.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }));
  return {
    response,
    payload: await response.json()
  };
}

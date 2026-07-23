import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  isPanelAppSandboxProxyRequest,
  readRemoteSessionIdFromHost,
} from "../dist/utils/remote-panel-app-request.utils.js";
import { RemoteAccessService } from "../dist/services/remote-access.service.js";
import { renderRemoteAccessErrorPage } from "../dist/utils/remote-access-error-page-renderer.utils.js";
import { getActiveOwnerRemoteAccessSessionByInstanceId } from "../dist/repositories/remote.repository.js";

class LocalD1Statement {
  constructor(database, sql) {
    this.statement = database.prepare(sql);
    this.bindings = [];
  }

  bind = (...bindings) => {
    this.bindings = bindings;
    return this;
  };

  first = async () => this.statement.get(...this.bindings) ?? null;
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare = (sql) => new LocalD1Statement(this.database, sql);
}

function createRequest(path, options = {}) {
  return new Request(new URL(path, "https://r-session-id.claw.cool"), {
    method: options.method ?? "GET",
    headers: options.headers,
  });
}

const reconnectingPage = renderRemoteAccessErrorPage({
  status: 503,
  message: "Remote device connector is offline.",
  incidentId: "incident-a",
  retryAfterSeconds: 7,
});
const reconnectingHtml = await reconnectingPage.text();
assert.equal(reconnectingPage.headers.get("retry-after"), "7");
assert.equal(
  reconnectingPage.headers.get("x-nextclaw-incident-id"),
  "incident-a",
);
assert.match(reconnectingHtml, /Remote connector is reconnecting/);
assert.match(reconnectingHtml, /http-equiv="refresh" content="7"/);
assert.match(reconnectingHtml, /Incident ID: <code>incident-a<\/code>/);
assert.match(reconnectingHtml, /href="">Retry now<\/a>/);

const expiredPage = renderRemoteAccessErrorPage({
  status: 410,
  message: "Remote access session expired.",
  incidentId: null,
});
const expiredHtml = await expiredPage.text();
assert.equal(expiredPage.headers.get("retry-after"), null);
assert.doesNotMatch(expiredHtml, /http-equiv="refresh"/);

assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/api/panel-app-assets/signed-asset-token/styles.css"),
  ),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/panel-app-client-sdk.js")),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/api/service-actions/demo.invoke", {
      method: "POST",
      headers: {
        origin: "null",
        "x-nextclaw-panel-bridge-session": "panel-runtime-token",
      },
    }),
  ),
  true,
);
assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/api/service-actions/demo.invoke", {
      method: "OPTIONS",
      headers: {
        origin: "null",
        "access-control-request-headers":
          "content-type, x-nextclaw-panel-bridge-session",
      },
    }),
  ),
  true,
);

assert.equal(
  isPanelAppSandboxProxyRequest(createRequest("/api/health")),
  false,
);
assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/api/health", {
      headers: {
        origin: "https://attacker.example",
        "x-nextclaw-panel-bridge-session": "panel-runtime-token",
      },
    }),
  ),
  false,
);
assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/chat/session", {
      headers: {
        origin: "null",
        "x-nextclaw-panel-bridge-session": "panel-runtime-token",
      },
    }),
  ),
  false,
);
assert.equal(
  isPanelAppSandboxProxyRequest(
    createRequest("/api/health", {
      method: "OPTIONS",
      headers: {
        origin: "null",
        "access-control-request-headers": "content-type",
      },
    }),
  ),
  false,
);

assert.equal(
  readRemoteSessionIdFromHost("r-session-id.claw.cool", "claw.cool"),
  "session-id",
);
assert.equal(readRemoteSessionIdFromHost("claw.cool", "claw.cool"), null);
assert.equal(
  readRemoteSessionIdFromHost("attacker.r-session-id.claw.cool", "claw.cool"),
  null,
);
assert.equal(
  readRemoteSessionIdFromHost("r-session-id.attacker.example", "claw.cool"),
  null,
);

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE remote_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_install_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    local_origin TEXT NOT NULL,
    domain_prefix TEXT UNIQUE,
    domain_claimed_at TEXT,
    domain_expires_at TEXT,
    status TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE remote_sessions (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_grant_id TEXT,
    opened_by_user_id TEXT,
    expires_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE remote_instance_domains (
    prefix TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(instance_id, kind)
  );
`);
const timestamp = "2026-07-20T12:00:00.000Z";
database
  .prepare(
    `
  INSERT INTO remote_devices (
    id, user_id, device_install_id, display_name, platform, app_version, local_origin,
    domain_prefix, domain_claimed_at, domain_expires_at, status, last_seen_at, archived_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)
`,
  )
  .run(
    "instance-a",
    "user-a",
    "install-a",
    "Mac A",
    "darwin",
    "0.25.27",
    "http://127.0.0.1:55667",
    "my-mac",
    timestamp,
    "online",
    timestamp,
    timestamp,
    timestamp,
  );
const insertDomain = database.prepare(`
  INSERT INTO remote_instance_domains (
    prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, NULL, ?, ?)
`);
for (const [prefix, instanceId, kind] of [
  ["i-system-a", "instance-a", "system"],
  ["my-mac", "instance-a", "custom"],
  ["i-system-b", "instance-b", "system"],
  ["other-mac", "instance-b", "custom"],
]) {
  insertDomain.run(prefix, instanceId, kind, timestamp, timestamp, timestamp);
}
database
  .prepare(
    `
  INSERT INTO remote_devices (
    id, user_id, device_install_id, display_name, platform, app_version, local_origin,
    domain_prefix, domain_claimed_at, domain_expires_at, status, last_seen_at, archived_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)
`,
  )
  .run(
    "instance-b",
    "user-b",
    "install-b",
    "Mac B",
    "darwin",
    "0.25.27",
    "http://127.0.0.1:55668",
    "other-mac",
    timestamp,
    "online",
    timestamp,
    timestamp,
    timestamp,
  );
database
  .prepare(
    `
  INSERT INTO remote_sessions (
    id, token, user_id, device_id, status, source_type, source_grant_id, opened_by_user_id,
    expires_at, last_used_at, revoked_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'active', 'owner_open', NULL, ?, ?, ?, NULL, ?, ?)
`,
  )
  .run(
    "session-a",
    "token-a",
    "user-a",
    "instance-a",
    "user-a",
    "2099-07-20T12:00:00.000Z",
    timestamp,
    timestamp,
    timestamp,
  );

const d1 = new LocalD1Database(database);
function createAccessContext(hostname, cookie = "") {
  return {
    env: {
      NEXTCLAW_PLATFORM_DB: d1,
      REMOTE_ACCESS_BASE_DOMAIN: "claw.cool",
      REMOTE_ACCESS_FIXED_DOMAIN: "remote.claw.cool",
    },
    req: {
      url: `https://${hostname}/_remote/runtime`,
      header: (name) => {
        if (name.toLowerCase() === "host") return hostname;
        if (name.toLowerCase() === "cookie") return cookie;
        return undefined;
      },
    },
  };
}

const urls = new RemoteAccessService(
  createAccessContext("ai-gateway-api.nextclaw.io"),
).buildAccessUrlSet("session-a", "token-a", {
  systemDomainPrefix: "i-system-a",
  customDomainPrefix: "my-mac",
});
assert.equal(
  urls.openUrl,
  "https://r-session-a.claw.cool/platform/remote/open?token=token-a",
);
assert.equal(
  urls.fixedDomainOpenUrl,
  "https://remote.claw.cool/platform/remote/open?token=token-a",
);
assert.equal(
  urls.systemDomainOpenUrl,
  "https://i-system-a.claw.cool/platform/remote/open?token=token-a",
);
assert.equal(
  urls.customDomainOpenUrl,
  "https://my-mac.claw.cool/platform/remote/open?token=token-a",
);

const cookie = "nextclaw_remote_session=token-a";
assert.equal(
  (
    await new RemoteAccessService(
      createAccessContext("i-system-a.claw.cool", cookie),
    ).resolveAccessSession()
  )?.id,
  "session-a",
);
assert.equal(
  (
    await new RemoteAccessService(
      createAccessContext("my-mac.claw.cool", cookie),
    ).resolveAccessSession()
  )?.id,
  "session-a",
);
assert.equal(
  await new RemoteAccessService(
    createAccessContext("other-mac.claw.cool", cookie),
  ).resolveAccessSession(),
  null,
);
assert.equal(
  await new RemoteAccessService(
    createAccessContext("unknown.claw.cool", cookie),
  ).resolveAccessSession(),
  null,
);
assert.equal(
  (
    await new RemoteAccessService(
      createAccessContext("r-session-a.claw.cool", cookie),
    ).resolveAccessSession()
  )?.id,
  "session-a",
);
assert.equal(
  (
    await new RemoteAccessService(
      createAccessContext("remote.claw.cool", cookie),
    ).resolveAccessSession()
  )?.id,
  "session-a",
);
assert.equal(
  (
    await getActiveOwnerRemoteAccessSessionByInstanceId(
      d1,
      "instance-a",
      timestamp,
    )
  )?.id,
  "session-a",
);

database.close();

console.log("[remote-panel-app-session] passed");

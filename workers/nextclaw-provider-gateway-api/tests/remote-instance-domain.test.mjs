import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { getRemoteInstanceById } from "../dist/repositories/remote-instance.repository.js";
import { RemoteInstanceDomainService } from "../dist/services/remote-instance-domain.service.js";
import { RemoteInstanceRegistrationService } from "../dist/services/remote-instance-registration.service.js";

const gatewayAppSource = readFileSync(
  new URL("../src/app/gateway-api.app.ts", import.meta.url),
  "utf-8",
);
assert.match(gatewayAppSource, /allowMethods:\s*\[[^\]]*"DELETE"[^\]]*\]/);

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
  all = async () => ({ results: this.statement.all(...this.bindings) });
  run = async () => {
    const result = this.statement.run(...this.bindings);
    return { meta: { changes: result.changes } };
  };
}

class LocalD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare = (sql) => new LocalD1Statement(this.database, sql);
}

function createLegacyDatabase() {
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
      status TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

const database = createLegacyDatabase();
const legacyInsert = database.prepare(`
  INSERT INTO remote_devices (
    id, user_id, device_install_id, display_name, platform, app_version,
    local_origin, status, last_seen_at, archived_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
legacyInsert.run(
  "instance-a",
  "user-a",
  "legacy-a",
  "Mac A",
  "darwin",
  "0.25.27",
  "http://127.0.0.1:55667",
  "offline",
  "2026-07-20T00:00:00.000Z",
  null,
  "2026-07-20T00:00:00.000Z",
  "2026-07-20T00:00:00.000Z",
);
legacyInsert.run(
  "instance-b",
  "user-b",
  "legacy-b",
  "Mac B",
  "darwin",
  "0.25.27",
  "http://127.0.0.1:55668",
  "offline",
  "2026-07-20T00:00:00.000Z",
  "2026-07-20T00:00:00.000Z",
  "2026-07-20T00:00:00.000Z",
  "2026-07-20T00:00:00.000Z",
);

for (const migrationName of [
  "0013_remote_instance_identity_domains.sql",
  "0014_remote_instance_domain_claims.sql",
]) {
  database.exec(
    readFileSync(
      new URL(`../migrations/${migrationName}`, import.meta.url),
      "utf-8",
    ),
  );
}
assert.equal(
  database
    .prepare(
      "SELECT COUNT(*) AS count FROM remote_instance_domains WHERE kind = 'system'",
    )
    .get().count,
  2,
);
assert.equal(
  database
    .prepare(
      "SELECT COUNT(*) AS count FROM remote_instance_domains WHERE kind = 'custom'",
    )
    .get().count,
  0,
);

const d1 = new LocalD1Database(database);
const now = new Date("2026-07-20T12:00:00.000Z");
const domains = new RemoteInstanceDomainService(d1, {
  baseDomain: "claw.cool",
  fixedDomain: "remote.claw.cool",
  now: () => now,
});

const instanceA = await getRemoteInstanceById(d1, "instance-a");
const instanceB = await getRemoteInstanceById(d1, "instance-b");
assert.ok(instanceA);
assert.ok(instanceB);
assert.equal(
  domains.buildDomain(instanceA.system_domain_prefix),
  `${instanceA.system_domain_prefix}.claw.cool`,
);
assert.equal(instanceA.custom_domain_prefix, null);

assert.deepEqual(await domains.claimCustom(instanceA, "bad_name"), {
  ok: false,
  reason: "invalid",
});
assert.deepEqual(await domains.claimCustom(instanceA, "remote"), {
  ok: false,
  reason: "reserved",
});
assert.deepEqual(await domains.claimCustom(instanceA, "r-owner-session"), {
  ok: false,
  reason: "reserved",
});
assert.deepEqual(await domains.claimCustom(instanceA, "i-system-name"), {
  ok: false,
  reason: "reserved",
});
assert.deepEqual(await domains.claimCustom(instanceA, "nc-legacy-name"), {
  ok: false,
  reason: "reserved",
});

const renamedA = await domains.claimCustom(instanceA, "  My-Mac  ");
assert.equal(renamedA.ok, true);
assert.equal(renamedA.instance.custom_domain_prefix, "my-mac");
assert.equal(renamedA.instance.custom_domain_expires_at, null);
assert.equal(
  renamedA.instance.system_domain_prefix,
  instanceA.system_domain_prefix,
);

assert.deepEqual(await domains.claimCustom(instanceB, "my-mac"), {
  ok: false,
  reason: "taken",
});
const releasedA = await domains.releaseCustom(renamedA.instance);
assert.equal(releasedA.custom_domain_prefix, null);
assert.equal(releasedA.system_domain_prefix, instanceA.system_domain_prefix);
const claimedAfterRelease = await domains.claimCustom(instanceB, "my-mac");
assert.equal(claimedAfterRelease.ok, true);
assert.equal(claimedAfterRelease.instance.custom_domain_prefix, "my-mac");

database
  .prepare(
    `
  INSERT INTO remote_devices (
    id, user_id, device_install_id, display_name, platform, app_version, local_origin,
    domain_prefix, domain_claimed_at, domain_expires_at, status, last_seen_at, archived_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
`,
  )
  .run(
    "instance-expired",
    "user-c",
    "legacy-expired",
    "Expired",
    "linux",
    "0.25.27",
    "http://127.0.0.1:55669",
    "old-name",
    "2026-07-01T00:00:00.000Z",
    "2026-07-19T00:00:00.000Z",
    "offline",
    "2026-07-20T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
  );
database
  .prepare(
    `INSERT INTO remote_instance_domains (
      prefix, instance_id, kind, claimed_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, 'system', ?, NULL, ?, ?),
             (?, ?, 'custom', ?, ?, ?, ?)`,
  )
  .run(
    "i-expired-system",
    "instance-expired",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    "old-name",
    "instance-expired",
    "2026-07-01T00:00:00.000Z",
    "2026-07-19T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
    "2026-07-01T00:00:00.000Z",
  );
const reclaimedExpired = await domains.claimCustom(
  claimedAfterRelease.instance,
  "old-name",
);
assert.equal(reclaimedExpired.ok, true);
assert.equal(reclaimedExpired.instance.custom_domain_prefix, "old-name");
assert.equal(
  database
    .prepare(
      "SELECT COUNT(*) AS count FROM remote_instance_domains WHERE instance_id = ? AND kind = 'custom'",
    )
    .get("instance-expired").count,
  0,
);

const registration = await new RemoteInstanceRegistrationService(
  d1,
  "user-b",
  domains,
).register({
  legacyInstanceInstallId: "legacy-b",
  instanceInstallId: "v2-stable-device-port",
  displayName: "Mac B restarted",
  platform: "darwin",
  appVersion: "0.25.28",
  localOrigin: "http://127.0.0.1:55668",
  nowIso: now.toISOString(),
});
assert.equal(registration.ok, true);
assert.equal(registration.instance.id, "instance-b");
assert.equal(registration.instance.custom_domain_prefix, "old-name");
assert.equal(
  database
    .prepare(
      "SELECT COUNT(*) AS count FROM remote_devices WHERE device_install_id = ?",
    )
    .get("v2-stable-device-port").count,
  1,
);
assert.equal(
  database
    .prepare("SELECT id FROM remote_devices WHERE device_install_id = ?")
    .get("v2-stable-device-port").id,
  "instance-b",
);
const stolenRegistration = await new RemoteInstanceRegistrationService(
  d1,
  "user-a",
  domains,
).register({
  legacyInstanceInstallId: "",
  instanceInstallId: "v2-stable-device-port",
  displayName: "Stolen name",
  platform: "linux",
  appVersion: "0.0.0",
  localOrigin: "http://127.0.0.1:1",
  nowIso: now.toISOString(),
});
assert.deepEqual(stolenRegistration, { ok: false, reason: "owned" });
assert.equal(
  database
    .prepare("SELECT display_name FROM remote_devices WHERE id = ?")
    .get("instance-b").display_name,
  "Mac B restarted",
);

const newRegistration = await new RemoteInstanceRegistrationService(
  d1,
  "user-new",
  domains,
).register({
  legacyInstanceInstallId: "",
  instanceInstallId: "v2-new-device-port",
  displayName: "New Device",
  platform: "linux",
  appVersion: "0.25.28",
  localOrigin: "http://127.0.0.1:55700",
  nowIso: now.toISOString(),
});
assert.equal(newRegistration.ok, true);
assert.match(newRegistration.instance.system_domain_prefix, /^i-[a-f0-9]{20}$/);
assert.equal(newRegistration.instance.custom_domain_prefix, null);

database.close();
console.log("[remote-instance-domain] passed");

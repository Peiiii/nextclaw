import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import gateway from "../../workers/nextclaw-provider-gateway-api/src/index.ts";
import { hashPassword } from "../../workers/nextclaw-provider-gateway-api/src/utils/platform.utils.ts";
import { SupportLocalDatabaseService } from "../../apps/public-roadmap-feedback-portal/dist/server/support/support-local-database.service.js";

// Run with tsx and the gateway tsconfig: this hosts the actual platform routes.
const require = createRequire(new URL("../../apps/public-roadmap-feedback-portal/package.json", import.meta.url));
const { serve } = require("@hono/node-server");
const state = new URL("../../.local/feedback-acceptance/", import.meta.url);
await mkdir(state, { recursive: true, mode: 0o700 });
const accountFile = new URL("platform-account.json", state);
let account;
try { account = JSON.parse(await readFile(accountFile, "utf8")); } catch (error) {
  if (error.code !== "ENOENT") throw error;
  account = { email: "admin@feedback.test", password: randomBytes(24).toString("hex"), secret: randomBytes(32).toString("hex") };
  await writeFile(accountFile, JSON.stringify(account), { mode: 0o600, flag: "wx" });
}
const db = new SupportLocalDatabaseService(fileURLToPath(new URL("platform.sqlite", state)), new URL("../../workers/nextclaw-provider-gateway-api/migrations/", import.meta.url));
db.batch = async statements => Promise.all(statements.map(statement => statement.run()));
const password = await hashPassword(account.password);
for (const [id, email, role] of [["acceptance-admin", account.email, "admin"], ["acceptance-user", "user@feedback.test", "user"]]) {
  await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,password_salt,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id, email, password.hash, password.salt, role, new Date().toISOString(), new Date().toISOString()).run();
}
const env = {
  NEXTCLAW_PLATFORM_DB: db, AUTH_TOKEN_SECRET: account.secret,
  SUPPORT_API_BASE: "http://127.0.0.1:3197",
  SUPPORT_ADMIN_TOKEN: (await readFile(new URL("administrator-token", state), "utf8")).trim()
};
const server = serve({ hostname: "127.0.0.1", port: 8787, fetch: request => gateway.fetch(request, env) });
console.log("Local platform API: http://127.0.0.1:8787; credentials remain in the private acceptance directory.");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));

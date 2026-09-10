#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const state = resolve(root, ".local/feedback-acceptance");
await mkdir(state, { recursive: true, mode: 0o700 });
const credential = resolve(state, "participant-token");
let token;
try { token = (await readFile(credential, "utf8")).trim(); } catch (error) {
  if (error.code !== "ENOENT") throw error;
  token = randomBytes(32).toString("hex"); await writeFile(credential, token, { mode: 0o600, flag: "wx" });
}
const port = process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_PORT ?? "3197";
const adminFile = resolve(state, "administrator-token");
let adminToken;
try { adminToken = (await readFile(adminFile, "utf8")).trim(); } catch (error) {
  if (error.code !== "ENOENT") throw error;
  adminToken = randomBytes(32).toString("hex"); await writeFile(adminFile, adminToken, { mode: 0o600, flag: "wx" });
}
const child = spawn(process.execPath, ["dist/server/index.js"], {
  cwd: resolve(root, "apps/public-roadmap-feedback-portal"),
  env: { ...process.env, SUPPORT_DATABASE_PATH: resolve(state, "feedback.sqlite"), DISCUSSION_PARTICIPANT_TOKEN: token,
    SUPPORT_ADMIN_TOKEN: adminToken,
    SUPPORT_MAX_AUTHORITY: "deliver", PUBLIC_ROADMAP_FEEDBACK_PORTAL_HOST: "127.0.0.1", PUBLIC_ROADMAP_FEEDBACK_PORTAL_PORT: port },
  stdio: "inherit"
});
console.log(`Feedback acceptance: http://127.0.0.1:${port}/support`);
console.log("Discussion participant credential is stored privately in .local/feedback-acceptance/participant-token; it is never logged.");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });

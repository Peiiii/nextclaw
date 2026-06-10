#!/usr/bin/env node
import { writeFileSync } from "node:fs";

if (process.env.NEXTCLAW_STDIO_PID_FILE) {
  writeFileSync(process.env.NEXTCLAW_STDIO_PID_FILE, String(process.pid));
}

await import("./echo-agent.utils.mjs");

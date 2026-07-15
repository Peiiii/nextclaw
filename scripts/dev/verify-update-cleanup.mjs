#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const processExitTimeoutMs = 5_000;

class LocalUpdateVerificationCleanup {
  constructor(parentPid, rootDir) {
    this.parentPid = parentPid;
    this.rootDir = rootDir;
    this.keepMarkerPath = join(rootDir, ".keep");
    this.serviceStatePath = join(rootDir, "run/service.json");
    this.servicePid = null;
  }

  run = async () => {
    while (this.isProcessRunning(this.parentPid)) {
      this.servicePid = this.readServicePid() ?? this.servicePid;
      await delay(250);
    }

    const servicePid = this.readServicePid() ?? this.servicePid;
    if (servicePid) {
      this.signalProcess(servicePid, "SIGTERM");
      const deadline = Date.now() + processExitTimeoutMs;
      while (Date.now() < deadline && this.isProcessRunning(servicePid)) {
        await delay(250);
      }
      if (this.isProcessRunning(servicePid)) {
        this.signalProcess(servicePid, "SIGKILL");
      }
    }

    if (existsSync(this.rootDir) && !existsSync(this.keepMarkerPath)) {
      rmSync(this.rootDir, { recursive: true, force: true });
    }
  };

  readServicePid = () => {
    if (!existsSync(this.serviceStatePath)) {
      return null;
    }
    try {
      const state = JSON.parse(readFileSync(this.serviceStatePath, "utf8"));
      return Number.isInteger(state.pid) && state.pid > 0 ? state.pid : null;
    } catch {
      return null;
    }
  };

  isProcessRunning = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  signalProcess = (pid, signal) => {
    try {
      process.kill(pid, signal);
    } catch {
      // The isolated process has already stopped.
    }
  };
}

const parentPid = Number(process.argv[2]);
const rootDir = process.argv[3]?.trim();
if (!Number.isInteger(parentPid) || parentPid < 1 || !rootDir) {
  console.error("Usage: verify-update-cleanup.mjs <parent-pid> <verification-root>");
  process.exit(1);
}

new LocalUpdateVerificationCleanup(parentPid, rootDir).run().catch(() => {
  process.exitCode = 1;
});

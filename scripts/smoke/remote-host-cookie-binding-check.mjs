#!/usr/bin/env node
import process from "node:process";

const modulePath = new URL("../workers/nextclaw-provider-gateway-api/dist/services/remote-access-session-binding.js", import.meta.url);
const { resolveHostBoundRemoteAccessSession } = await import(modulePath);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createSession(id) {
  return { id };
}

const ownerSession = createSession("owner-session");
const shareSession = createSession("share-session");

assert(
  resolveHostBoundRemoteAccessSession({
    hostSessionId: "owner-session",
    cookieSession: null
  }) === null,
  "host-routed request must reject missing cookie session"
);

assert(
  resolveHostBoundRemoteAccessSession({
    hostSessionId: "owner-session",
    cookieSession: shareSession
  }) === null,
  "host-routed request must reject mismatched cookie session"
);

assert(
  resolveHostBoundRemoteAccessSession({
    hostSessionId: "owner-session",
    cookieSession: ownerSession
  }) === ownerSession,
  "host-routed request must accept matching cookie session"
);

assert(
  resolveHostBoundRemoteAccessSession({
    hostSessionId: null,
    cookieSession: shareSession
  }) === shareSession,
  "non-host-routed request should keep cookie-based session resolution"
);

console.log("[remote-host-cookie-binding-check] all checks passed.");
process.exitCode = 0;

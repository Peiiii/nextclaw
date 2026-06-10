import { parentPort } from "node:worker_threads";
import { SessionSearchWorkerRuntimeService } from "./services/session-search-worker-runtime.service.js";
import type { SessionSearchWorkerRequest } from "./session-search-worker-protocol.types.js";

const runtime = new SessionSearchWorkerRuntimeService((event) => {
  parentPort?.postMessage(event);
});

parentPort?.on("message", (message: SessionSearchWorkerRequest) => {
  void runtime.handleRequest(message);
});

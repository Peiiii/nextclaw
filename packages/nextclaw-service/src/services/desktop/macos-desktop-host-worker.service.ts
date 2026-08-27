import { parentPort } from "node:worker_threads";
import { MacosDesktopHostOperations } from "@nextclaw-service/services/desktop/macos-desktop-host.service.js";

const port = parentPort;
if (!port) throw new Error("Desktop Worker requires a parent port.");

const host = new MacosDesktopHostOperations();
host.onEvent((event) => port.postMessage({ type: "event", event }));
port.on("message", async (request: {
  type: "invoke";
  requestId: string;
  method: Parameters<typeof host.invoke>[0];
  payload: Record<string, unknown>;
  caller: Parameters<typeof host.invoke>[2];
}) => {
  if (request.type !== "invoke") return;
  try {
    port.postMessage({
      type: "result",
      requestId: request.requestId,
      result: await host.invoke(request.method, request.payload, request.caller),
    });
  } catch (error) {
    const value = error as { code?: unknown; message?: unknown; recovery?: unknown };
    port.postMessage({
      type: "error",
      requestId: request.requestId,
      error: {
        code: typeof value.code === "string" ? value.code : "host_operation_failed",
        message: typeof value.message === "string" ? value.message : "Desktop operation failed.",
        ...(value.recovery ? { recovery: value.recovery } : {}),
      },
    });
  }
});

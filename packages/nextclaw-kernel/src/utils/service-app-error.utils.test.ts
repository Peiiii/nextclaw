import { describe, expect, it } from "vitest";
import { PortableServiceRunnerError } from "@kernel/services/portable-service-runner-client.service.js";
import { toServiceAppRuntimeError } from "@kernel/utils/service-app-error.utils.js";

describe("toServiceAppRuntimeError", () => {
  it("preserves stable WASI diagnostics", () => {
    const result = toServiceAppRuntimeError(
      new PortableServiceRunnerError(
        "WASI_CAPABILITY_DENIED",
        "storage is not allowed",
        { logs: ["storage denied"] },
      ),
      "notes",
      "read",
    );

    expect(result).toMatchObject({
      code: "WASI_CAPABILITY_DENIED",
      message: "storage is not allowed",
      details: { logs: ["storage denied"] },
    });
  });

  it("maps unrelated failures to the generic runtime contract", () => {
    const result = toServiceAppRuntimeError(
      new Error("spawn ENOENT"),
      "notes",
      "read",
    );

    expect(result).toMatchObject({
      code: "SERVICE_APP_RUNTIME_FAILED",
      message: "Service App notes action read failed: spawn ENOENT",
    });
  });
});

import { ConfigSchema } from "@nextclaw/core";
import { describe, expect, it } from "vitest";
import { createManagedRemoteModule } from "./service-remote-runtime.js";

describe("createManagedRemoteModule", () => {
  it("creates the remote module when the effective UI runtime is enabled", () => {
    const config = ConfigSchema.parse({
      ui: {
        enabled: false
      },
      remote: {
        enabled: true
      }
    });

    const module = createManagedRemoteModule({
      config,
      uiEnabled: true,
      localOrigin: "http://127.0.0.1:18888"
    });

    expect(module).not.toBeNull();
  });

  it("does not create the remote module when the effective UI runtime is disabled", () => {
    const config = ConfigSchema.parse({
      ui: {
        enabled: true
      },
      remote: {
        enabled: true
      }
    });

    const module = createManagedRemoteModule({
      config,
      uiEnabled: false,
      localOrigin: "http://127.0.0.1:18888"
    });

    expect(module).toBeNull();
  });
});

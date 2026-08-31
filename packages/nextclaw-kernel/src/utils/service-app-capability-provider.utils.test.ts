import { describe, expect, it } from "vitest";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import { projectCapabilityProviders } from "./service-app-capability-provider.utils.js";

const manifest = {
  lifecycle: { mode: "provider" },
  provides: {
    capabilities: [{
      id: "contacts.normalize",
      version: "1",
      resourceTypes: ["contacts"],
      wit: { package: "nextclaw:contacts", interface: "normalize", version: "1.0.0" },
    }],
  },
} as ServiceAppManifest;

function record(overrides: Partial<ServiceAppRecord> = {}): ServiceAppRecord {
  return {
    id: "contacts-provider",
    packageId: "example.contacts",
    enabled: true,
    status: "running",
    ...overrides,
  } as ServiceAppRecord;
}

describe("projectCapabilityProviders", () => {
  it("projects only enabled and running Provider Services", () => {
    expect(projectCapabilityProviders([
      { manifest, record: record() },
      { manifest, record: record({ id: "stopped", status: "stopped" }) },
      { manifest, record: record({ id: "disabled", enabled: false }) },
    ])).toEqual([{
      providerId: "contacts-provider",
      appId: "example.contacts",
      componentId: "contacts-provider",
      capabilities: [{
        id: "contacts.normalize",
        version: "1",
        resourceTypes: ["contacts"],
        wit: { package: "nextclaw:contacts", interface: "normalize", version: "1.0.0" },
      }],
    }]);
  });
});

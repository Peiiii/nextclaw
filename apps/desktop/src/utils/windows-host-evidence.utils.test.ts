import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectWindowsHostEvidence, parseWindowsEventXml } from "./windows-host-evidence.utils";

const applicationCrashXml = `<Events><Event><System><Provider Name="Application Error"/><EventID>1000</EventID><TimeCreated SystemTime="2026-08-22T10:00:00.000Z"/></System><EventData><Data>NextClaw Desktop.exe</Data></EventData></Event></Events>`;

describe("windows host evidence", () => {
  it("parses rendered event XML", () => {
    const records = parseWindowsEventXml(applicationCrashXml);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      eventId: 1000,
      observedAt: "2026-08-22T10:00:00.000Z",
      provider: "Application Error",
      text: "1000 NextClaw Desktop.exe"
    });
  });

  it("collects matching application crashes without requiring Windows in tests", () => {
    const evidence = collectWindowsHostEvidence({
      platform: "win32",
      startedAt: "2026-08-22T09:59:00.000Z",
      observedEndedAt: "2026-08-22T10:01:00.000Z",
      applicationNames: ["NextClaw Desktop.exe"],
      runCommand: () => ({ status: 0, stdout: applicationCrashXml, stderr: "" })
    });

    assert.equal(evidence.some((entry) => entry.kind === "windows.application-crash" && entry.source === "windows"), true);
  });
});

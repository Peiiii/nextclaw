import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { ExtensionRuntimeStatus } from "@kernel/features/extension-runtime/types/extension-runtime.types.js";

export function readExtensionProcessMemory(
  pid: number,
): ExtensionRuntimeStatus["memory"] {
  try {
    if (process.platform === "linux") {
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
      return {
        rssBytes: toBytes(readMemoryKilobytes(status, "VmRSS")),
        pssBytes: toBytes(readMemoryKilobytes(rollup, "Pss")),
      };
    }
    if (process.platform === "win32") {
      const rssBytes = Number(
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `(Get-Process -Id ${pid}).WorkingSet64`,
          ],
          { encoding: "utf8" },
        ).trim(),
      );
      return {
        rssBytes: Number.isFinite(rssBytes) ? rssBytes : null,
        pssBytes: null,
      };
    }
    const rssKilobytes = Number(
      execFileSync("ps", ["-o", "rss=", "-p", String(pid)], {
        encoding: "utf8",
      }).trim(),
    );
    return {
      rssBytes: Number.isFinite(rssKilobytes) ? rssKilobytes * 1024 : null,
      pssBytes: null,
    };
  } catch {
    return {
      rssBytes: null,
      pssBytes: null,
    };
  }
}

function readMemoryKilobytes(text: string, field: string): number | null {
  const value = Number(
    text.match(new RegExp(`^${field}:\\s+(\\d+)\\s+kB$`, "m"))?.[1],
  );
  return Number.isFinite(value) ? value : null;
}

function toBytes(kilobytes: number | null): number | null {
  return kilobytes === null ? null : kilobytes * 1024;
}

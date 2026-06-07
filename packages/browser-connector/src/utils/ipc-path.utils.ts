import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const resolveBrowserConnectorIpcPath = (homeDir: string): string => {
  const suffix = createHash("sha256").update(homeDir).digest("hex").slice(0, 16);

  if (process.platform === "win32") {
    return `\\\\.\\pipe\\browser-connector-${suffix}`;
  }

  return join(tmpdir(), `browser-connector-${suffix}.sock`);
};

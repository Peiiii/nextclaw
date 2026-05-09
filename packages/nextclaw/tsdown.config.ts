import { defineConfig } from "tsdown/config";
import { resolve } from "node:path";

export default defineConfig({
  alias: {
    "@nextclaw-service": resolve(import.meta.dirname, "../nextclaw-service/src")
  },
  deps: {
    alwaysBundle: ["@nextclaw/remote", /^@nextclaw-service(?:\/.*)?$/],
    onlyBundle: false
  }
});

import { defineConfig } from "tsdown/config";

export default defineConfig({
  deps: {
    alwaysBundle: ["@nextclaw/remote"],
    onlyBundle: false
  }
});

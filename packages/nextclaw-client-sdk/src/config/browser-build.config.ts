import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  cwd: "../..",
  deps: {
    alwaysBundle: ["@nextclaw/shared"],
    onlyBundle: false,
  },
  entry: ["src/utils/browser-global-registration.utils.ts"],
  format: "iife",
  minify: true,
  outDir: "dist/browser",
  platform: "browser",
  target: "es2022",
  tsconfig: "tsconfig.json",
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/codex-model-provider.ts",
    "src/codex-session-type.ts",
    "src/codex-openai-responses-bridge.ts",
    "src/codex-openai-responses-bridge-shared.ts",
    "src/codex-openai-responses-bridge-request.ts",
    "src/codex-openai-responses-bridge-stream.ts",
    "src/codex-responses-capability.ts",
    "src/codex-input-builder.ts",
  ],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  bundle: false,
  target: "es2022",
  clean: true
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@nextclaw-server/", replacement: new URL("./src/", import.meta.url).pathname },
      { find: "@/", replacement: new URL("./src/", import.meta.url).pathname },
      { find: "@core/", replacement: new URL("../nextclaw-core/src/", import.meta.url).pathname },
      { find: "@core", replacement: new URL("../nextclaw-core/src", import.meta.url).pathname },
      { find: "@kernel/", replacement: new URL("../nextclaw-kernel/src/", import.meta.url).pathname },
      { find: "@kernel", replacement: new URL("../nextclaw-kernel/src", import.meta.url).pathname },
      { find: /^@nextclaw\/core$/, replacement: new URL("../nextclaw-core/src/index.ts", import.meta.url).pathname },
      { find: /^@nextclaw\/kernel$/, replacement: new URL("../nextclaw-kernel/src/index.ts", import.meta.url).pathname },
      { find: "@stdio-runtime-client", replacement: new URL("../nextclaw-ncp-runtime-stdio-client/src", import.meta.url).pathname },
      { find: /^@nextclaw\/shared$/, replacement: new URL("../nextclaw-shared/src/index.ts", import.meta.url).pathname },
    ]
  }
});

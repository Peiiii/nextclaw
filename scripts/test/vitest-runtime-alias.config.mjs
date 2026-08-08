import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default {
  resolve: {
    alias: {
      "@": resolve("src"),
      "@claude-code-sdk": resolve("src"),
      "@core": resolve(repositoryRoot, "packages/nextclaw-core/src"),
      "@opencode-narp": resolve("src"),
    },
  },
};

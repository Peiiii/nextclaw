import { resolve } from "node:path";

export default {
  resolve: {
    alias: {
      "@": resolve("src"),
      "@claude-code-sdk": resolve("src"),
    },
  },
};

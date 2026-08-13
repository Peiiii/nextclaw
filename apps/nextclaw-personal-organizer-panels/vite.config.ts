import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.resolve(
  workspaceRoot,
  "../../packages/nextclaw/resources/apps/nextclaw-personal-organizer/panels",
);

const panels = {
  todos: {
    source: "src/features/todos",
    output: "nextclaw-personal-organizer-todos.panel",
  },
  calendar: {
    source: "src/features/calendar",
    output: "nextclaw-personal-organizer-calendar.panel",
  },
} as const;

export default defineConfig(({ mode }) => {
  const sharedConfig = {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(workspaceRoot, "src"),
        "@shared": path.resolve(workspaceRoot, "src/shared"),
        "@todos": path.resolve(workspaceRoot, "src/features/todos"),
        "@calendar": path.resolve(workspaceRoot, "src/features/calendar"),
      },
    },
  };

  if (mode === "test") {
    return sharedConfig;
  }

  if (!(mode in panels)) {
    throw new Error(`Unknown personal organizer panel mode: ${mode}`);
  }
  const panel = panels[mode as keyof typeof panels];
  const root = path.resolve(workspaceRoot, panel.source);

  return {
    base: "./",
    root,
    publicDir: path.resolve(root, "public"),
    ...sharedConfig,
    build: {
      outDir: path.resolve(packageRoot, panel.output),
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          entryFileNames: "assets/app.js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: ({ names }) => names.includes("style.css")
            ? "assets/style.css"
            : "assets/[name][extname]",
        },
      },
    },
  };
});

import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const nativeModulesDir =
  process.env.NEXTCLAW_DESKTOP_NATIVE_MODULES_DIR?.trim();

export async function resolve(specifier, context, nextResolve) {
  if (specifier !== "better-sqlite3" || !nativeModulesDir) {
    return await nextResolve(specifier, context);
  }

  const entrypoint = resolvePath(
    nativeModulesDir,
    "better-sqlite3",
    "lib",
    "index.js",
  );
  if (!existsSync(entrypoint)) {
    throw new Error(
      `Desktop native better-sqlite3 module is missing: ${entrypoint}`,
    );
  }

  return { url: pathToFileURL(entrypoint).href, shortCircuit: true };
}

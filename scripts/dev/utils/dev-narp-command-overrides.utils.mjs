import { dirname, resolve } from "node:path";

function readOverrides(serializedOverrides) {
  if (typeof serializedOverrides !== "string" || !serializedOverrides.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(serializedOverrides);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function registerSourceOverride(params) {
  const { backendBin, commands, controllerPath, devRuntimeTsconfigPath, overrides, rootDir } = params;
  const override = {
    command: backendBin,
    args: ["--tsconfig", devRuntimeTsconfigPath, controllerPath],
    cwd: rootDir,
  };
  for (const command of commands) {
    overrides[command] = override;
  }
}

export function createDevNarpCommandOverrides(params) {
  const {
    backendBin,
    claudeNarpControllerPath,
    claudeRuntimeSourceEnabled,
    codexNarpControllerPath,
    devRuntimeTsconfigPath,
    nextclawHome,
    nodeExecutable,
    rootDir,
    serializedOverrides,
  } = params;
  const overrides = readOverrides(serializedOverrides);
  registerSourceOverride({
    backendBin,
    controllerPath: codexNarpControllerPath,
    devRuntimeTsconfigPath,
    overrides,
    rootDir,
    commands: [
      resolve(nextclawHome, "bin", "nextclaw-codex-narp"),
      resolve(dirname(nodeExecutable), "nextclaw-codex-narp"),
      "nextclaw-codex-narp",
    ],
  });
  if (claudeRuntimeSourceEnabled) {
    registerSourceOverride({
      backendBin,
      controllerPath: claudeNarpControllerPath,
      devRuntimeTsconfigPath,
      overrides,
      rootDir,
      commands: [
        resolve(nextclawHome, "bin", "nextclaw-claude-code-narp"),
        resolve(dirname(nodeExecutable), "nextclaw-claude-code-narp"),
        resolve(
          rootDir,
          "packages/extensions/nextclaw-narp-runtime-claude-code-sdk/dist/controllers/claude-code-narp.controller.js",
        ),
        "nextclaw-claude-code-narp",
      ],
    });
  }
  return JSON.stringify(overrides);
}

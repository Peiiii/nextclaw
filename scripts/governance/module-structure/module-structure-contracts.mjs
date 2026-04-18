import path from "node:path";

const normalizePath = (value) => `${value ?? ""}`
  .trim()
  .replace(/\\/g, "/")
  .replace(/^\.\/+/, "")
  .replace(/\/+$/, "");

const defineContract = (contract) => ({
  ...contract,
  modulePath: normalizePath(contract.modulePath),
  allowedRootDirectories: new Set((contract.allowedRootDirectories ?? []).map(normalizePath)),
  allowedRootFiles: new Set(contract.allowedRootFiles ?? []),
  sharedDirectories: new Set(contract.sharedDirectories ?? []),
  rootPolicy: contract.rootPolicy ?? "legacy-frozen"
});

export const SHARED_CONTAINER_DIRECTORY_NAMES = new Set([
  "shared",
  "utils",
  "types",
  "support",
  "common",
  "helpers",
  "lib"
]);

export const MODULE_STRUCTURE_CONTRACTS = [
  defineContract({
    modulePath: "packages/nextclaw-ui/src/components/chat",
    organizationModel: "feature-root-frontend",
    rootPolicy: "legacy-frozen",
    allowedRootDirectories: [
      "adapters",
      "chat-input",
      "chat-stream",
      "containers",
      "hooks",
      "managers",
      "ncp",
      "nextclaw",
      "presenter",
      "session-header",
      "stores",
      "workspace"
    ],
    allowedRootFiles: ["index.ts"],
    sharedDirectories: ["adapters"]
  }),
  defineContract({
    modulePath: "packages/nextclaw-ui/src/components/config",
    organizationModel: "feature-root-frontend",
    rootPolicy: "legacy-frozen",
    allowedRootDirectories: [
      "channels",
      "providers",
      "runtime",
      "search",
      "security",
      "sessions",
      "shared",
      "hooks",
      "utils"
    ],
    allowedRootFiles: [],
    sharedDirectories: ["shared", "utils"]
  }),
  defineContract({
    modulePath: "packages/nextclaw-server/src/ui",
    organizationModel: "feature-root-backend",
    rootPolicy: "legacy-frozen",
    allowedRootDirectories: [
      "auth",
      "providers",
      "server-path",
      "session-project",
      "shared",
      "ui-routes",
      "utils"
    ],
    allowedRootFiles: ["router.ts", "server.ts"],
    sharedDirectories: ["shared", "utils"]
  }),
  defineContract({
    modulePath: "workers/nextclaw-provider-gateway-api/src",
    organizationModel: "layer-first-backend",
    rootPolicy: "legacy-frozen",
    allowedRootDirectories: ["controllers", "repositories", "services", "types", "utils"],
    allowedRootFiles: ["index.ts", "main.ts", "routes.ts"],
    sharedDirectories: ["types", "utils"]
  }),
  defineContract({
    modulePath: "apps/platform-admin/src",
    organizationModel: "app-root-frontend",
    rootPolicy: "contract-only",
    allowedRootDirectories: ["api", "components", "lib", "pages", "store"],
    allowedRootFiles: ["App.tsx", "main.tsx"],
    sharedDirectories: ["lib"]
  }),
  defineContract({
    modulePath: "apps/platform-console/src",
    organizationModel: "app-root-frontend",
    rootPolicy: "contract-only",
    allowedRootDirectories: ["api", "components", "i18n", "lib", "pages", "store"],
    allowedRootFiles: ["App.tsx", "main.tsx"],
    sharedDirectories: ["lib", "i18n"]
  })
];

export const findModuleStructureContract = (filePath) => {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return null;
  }

  return MODULE_STRUCTURE_CONTRACTS
    .filter((contract) => normalized === contract.modulePath || normalized.startsWith(`${contract.modulePath}/`))
    .sort((left, right) => right.modulePath.length - left.modulePath.length)[0] ?? null;
};

export const toModuleRelativePath = (filePath, contract) => {
  const normalized = normalizePath(filePath);
  if (!contract || normalized === contract.modulePath || !normalized.startsWith(`${contract.modulePath}/`)) {
    return "";
  }
  return normalized.slice(contract.modulePath.length + 1);
};

export const splitModuleRelativePath = (filePath, contract) => {
  const relativePath = toModuleRelativePath(filePath, contract);
  return relativePath ? relativePath.split("/").filter(Boolean) : [];
};

export const getModuleRootEntryPath = (filePath, contract) => {
  const parts = splitModuleRelativePath(filePath, contract);
  if (parts.length <= 1) {
    return null;
  }
  return path.posix.join(contract.modulePath, parts[0]);
};

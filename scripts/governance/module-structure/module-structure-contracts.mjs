import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { resolveRepoPath } from "../../shared/repo-paths.mjs";

export const normalizePath = (value) => `${value ?? ""}`
  .trim()
  .replace(/\\/g, "/")
  .replace(/^\.\/+/, "")
  .replace(/\/+$/, "");

const toNormalizedSet = (values) => new Set((values ?? []).map(normalizePath).filter(Boolean));
const repoRootDir = resolveRepoPath(import.meta.url);

export const MODULE_STRUCTURE_CONFIG_FILE_NAME = "module-structure.config.json";

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

const readJsonFile = (repoPath) => {
  const source = readFileSync(path.resolve(repoRootDir, repoPath), "utf8");
  const parsed = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Module-structure config '${repoPath}' must export a JSON object.`);
  }
  return parsed;
};

const normalizeStringArrayField = (value, fieldName, repoPath) => {
  if (value === undefined) {
    return [];
  }
  if (!isStringArray(value)) {
    throw new Error(`Module-structure config '${repoPath}' field '${fieldName}' must be a string array.`);
  }
  return value;
};

const LEGACY_ORGANIZATION_MODEL_PATTERN = /^legacy-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const defineLegacyContract = ({
  modulePath,
  organizationModel,
  allowedRootDirectories,
  allowedRootFiles,
  sharedDirectories,
  rootPolicy,
  enforcement
}) => ({
  contractKind: "legacy",
  modulePath: normalizePath(modulePath),
  organizationModel,
  allowedRootDirectories: toNormalizedSet(allowedRootDirectories),
  allowedRootFiles: new Set(allowedRootFiles ?? []),
  sharedDirectories: new Set(sharedDirectories ?? []),
  rootPolicy: rootPolicy ?? "legacy-frozen",
  enforcement: enforcement ?? "error"
});

export const FIXED_ROLE_DIRECTORY_NAMES = new Set([
  "components",
  "configs",
  "hooks",
  "presenters",
  "stores",
  "managers",
  "services",
  "pages",
  "types",
  "utils",
  "providers",
  "controllers",
  "repositories",
  "routes"
]);

export const FLAT_ROLE_DIRECTORY_NAMES = new Set([
  "configs", "hooks",
  "presenters",
  "stores",
  "managers",
  "services",
  "types",
  "utils",
  "providers",
  "controllers",
  "repositories",
  "routes"
]);

export const PACKAGE_STRUCTURE_SKELETON_DIRECTORIES = new Set([
  "app",
  "commands",
  "features",
  "shared",
  "platforms"
]);

export const FEATURE_LOCAL_DIRECTORY_NAMES = new Set([
  "features",
  "shared",
  ...FIXED_ROLE_DIRECTORY_NAMES
]);

export const COMMAND_LOCAL_DIRECTORY_NAMES = FEATURE_LOCAL_DIRECTORY_NAMES;

export const SHARED_CONTAINER_DIRECTORY_NAMES = new Set([
  "shared",
  "utils",
  "types",
  "support",
  "common",
  "helpers",
  "lib"
]);

export const RESERVED_PROTOCOL_DIRECTORY_NAMES = new Set([
  ...PACKAGE_STRUCTURE_SKELETON_DIRECTORIES,
  ...FIXED_ROLE_DIRECTORY_NAMES,
  "lib"
]);

const FRONTEND_L3_PROTOCOL = {
  protocolName: "frontend-l3",
  organizationModel: "protocol-frontend-l3",
  governedRoot: "src",
  allowedRootDirectories: ["app", "features", "shared", "platforms"],
  allowedRootFiles: [],
  sharedDirectories: ["shared"],
  importAliasPrefixes: ["@/"]
};

const PACKAGE_L1_PROTOCOL = {
  protocolName: "package-l1",
  organizationModel: "protocol-package-l1",
  governedRoot: "src",
  allowedRootDirectories: ["app", ...FIXED_ROLE_DIRECTORY_NAMES],
  allowedRootFiles: [],
  sharedDirectories: [],
  importAliasPrefixes: ["@/"]
};

const CLI_COMMAND_FIRST_PROTOCOL = {
  protocolName: "cli-command-first",
  organizationModel: "protocol-cli-command-first",
  governedRoot: "src/cli",
  allowedRootDirectories: ["app", "commands", "shared"],
  allowedRootFiles: [],
  sharedDirectories: ["shared"],
  importAliasPrefixes: ["@/"]
};

export const MODULE_STRUCTURE_PROTOCOLS = new Map([
  [PACKAGE_L1_PROTOCOL.protocolName, PACKAGE_L1_PROTOCOL],
  [FRONTEND_L3_PROTOCOL.protocolName, FRONTEND_L3_PROTOCOL],
  [CLI_COMMAND_FIRST_PROTOCOL.protocolName, CLI_COMMAND_FIRST_PROTOCOL]
]);

const defineProtocolDeclaration = (declaration) => {
  const protocol = MODULE_STRUCTURE_PROTOCOLS.get(declaration.protocol);
  if (!protocol) {
    throw new Error(`Unknown module-structure protocol '${declaration.protocol}'.`);
  }

  return {
    contractKind: "protocol",
    modulePath: normalizePath(declaration.modulePath),
    protocol: declaration.protocol,
    organizationModel: protocol.organizationModel,
    rootPolicy: declaration.rootPolicy ?? "legacy-frozen",
    allowedRootDirectories: toNormalizedSet(protocol.allowedRootDirectories),
    allowedRootFiles: new Set([
      ...(protocol.allowedRootFiles ?? []),
      ...(declaration.allowedRootFiles ?? [])
    ]),
    sharedDirectories: new Set([
      ...(protocol.sharedDirectories ?? []),
      ...(declaration.sharedDirectories ?? [])
    ]),
    importAliasPrefixes: new Set([
      ...(protocol.importAliasPrefixes ?? []),
      ...(declaration.importAliasPrefixes ?? [])
    ]),
    enforcement: declaration.enforcement ?? "error"
  };
};

export const isProtocolContract = (contract) => contract?.contractKind === "protocol";

const contractCache = new Map();

const getModuleLookupStartDirectory = (normalizedPath) => {
  if (!normalizedPath) {
    return "";
  }
  if (
    normalizedPath === MODULE_STRUCTURE_CONFIG_FILE_NAME ||
    normalizedPath.endsWith(`/${MODULE_STRUCTURE_CONFIG_FILE_NAME}`)
  ) {
    return normalizePath(path.posix.dirname(normalizedPath));
  }
  if (path.posix.extname(normalizedPath)) {
    return normalizePath(path.posix.dirname(normalizedPath));
  }
  return normalizedPath;
};

const findNearestModuleStructureConfigPath = (filePath) => {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return null;
  }

  let currentDirectory = getModuleLookupStartDirectory(normalized);
  while (true) {
    const candidate = currentDirectory
      ? path.posix.join(currentDirectory, MODULE_STRUCTURE_CONFIG_FILE_NAME)
      : MODULE_STRUCTURE_CONFIG_FILE_NAME;
    if (existsSync(path.resolve(repoRootDir, candidate))) {
      return candidate;
    }
    if (!currentDirectory) {
      return null;
    }
    const parentDirectory = normalizePath(path.posix.dirname(currentDirectory));
    if (parentDirectory === currentDirectory) {
      return null;
    }
    currentDirectory = parentDirectory === "." ? "" : parentDirectory;
  }
};

const buildContractFromConfigFile = (configRepoPath) => {
  const cached = contractCache.get(configRepoPath);
  if (cached) {
    return cached;
  }

  const config = readJsonFile(configRepoPath);
  const configDirectory = normalizePath(path.posix.dirname(configRepoPath));
  const contractKind = config.contractKind ?? (typeof config.protocol === "string" ? "protocol" : "legacy");
  const organizationModel = typeof config.organizationModel === "string" ? config.organizationModel.trim() : "";

  let contract;
  if (contractKind === "protocol") {
    const protocol = MODULE_STRUCTURE_PROTOCOLS.get(config.protocol);
    if (!protocol) {
      throw new Error(`Unknown module-structure protocol '${config.protocol}'.`);
    }
    if (organizationModel && organizationModel !== protocol.organizationModel) {
      throw new Error(
        `Module-structure config '${configRepoPath}' declares protocol '${config.protocol}' but organizationModel '${config.organizationModel}' does not match '${protocol.organizationModel}'.`,
      );
    }
    contract = defineProtocolDeclaration({
      modulePath: normalizePath(path.posix.join(configDirectory, protocol.governedRoot ?? "")),
      protocol: config.protocol,
      rootPolicy: config.rootPolicy,
      enforcement: config.enforcement,
      allowedRootFiles: normalizeStringArrayField(config.allowedRootFiles, "allowedRootFiles", configRepoPath),
      sharedDirectories: normalizeStringArrayField(config.sharedDirectories, "sharedDirectories", configRepoPath),
      importAliasPrefixes: normalizeStringArrayField(config.importAliasPrefixes, "importAliasPrefixes", configRepoPath)
    });
  } else if (contractKind === "legacy") {
    if (!organizationModel) {
      throw new Error(`Module-structure config '${configRepoPath}' must define a non-empty 'organizationModel'.`);
    }
    if (typeof config.protocol === "string" && config.protocol.trim()) {
      throw new Error(
        `Module-structure config '${configRepoPath}' cannot declare protocol '${config.protocol}' when contractKind is 'legacy'.`,
      );
    }
    if (organizationModel.startsWith("protocol-")) {
      throw new Error(
        `Module-structure config '${configRepoPath}' cannot reuse protocol organizationModel '${organizationModel}' in a legacy contract; switch to contractKind 'protocol' or rename it into the reserved legacy-* namespace.`,
      );
    }
    if (!LEGACY_ORGANIZATION_MODEL_PATTERN.test(organizationModel)) {
      throw new Error(
        `Module-structure config '${configRepoPath}' legacy organizationModel '${organizationModel}' must use the reserved legacy-* namespace.`,
      );
    }
    contract = defineLegacyContract({
      modulePath: configDirectory,
      organizationModel,
      rootPolicy: config.rootPolicy,
      enforcement: config.enforcement,
      allowedRootDirectories: normalizeStringArrayField(config.allowedRootDirectories, "allowedRootDirectories", configRepoPath),
      allowedRootFiles: normalizeStringArrayField(config.allowedRootFiles, "allowedRootFiles", configRepoPath),
      sharedDirectories: normalizeStringArrayField(config.sharedDirectories, "sharedDirectories", configRepoPath)
    });
  } else {
    throw new Error(`Unknown module-structure contract kind '${contractKind}' in '${configRepoPath}'.`);
  }

  contractCache.set(configRepoPath, contract);
  return contract;
};

export const findModuleStructureContract = (filePath) => {
  const configRepoPath = findNearestModuleStructureConfigPath(filePath);
  return configRepoPath ? buildContractFromConfigFile(configRepoPath) : null;
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

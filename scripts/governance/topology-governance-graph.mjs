import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  STRICT_LOW_LAYERS,
  collectImportSpecifiers,
  collectPackageEntrypoints,
  collectWorkspaceInfo,
  findWorkspaceForFile,
  inferLayer,
  isTestSupportFile,
  resolveImport,
  walkRepoFiles
} from "./topology-governance-shared.mjs";

function buildGraph() {
  const { workspaces, byName: packageByName } = collectWorkspaceInfo();
  const modulePaths = walkRepoFiles();
  const moduleMap = new Map();

  for (const repoPath of modulePaths) {
    const workspace = findWorkspaceForFile(repoPath, workspaces);
    moduleMap.set(repoPath, {
      repoPath,
      workspace,
      workspacePath: workspace?.workspacePath ?? (repoPath.startsWith("scripts/") ? "scripts" : "bridge"),
      layer: inferLayer(repoPath, workspace),
      imports: new Set(),
      importedBy: new Set(),
      isEntryRoot: false
    });
  }

  for (const workspace of workspaces) {
    for (const repoPath of collectPackageEntrypoints(workspace, moduleMap)) {
      const module = moduleMap.get(repoPath);
      if (!module) {
        continue;
      }
      module.importedBy.add("[entry]");
      module.isEntryRoot = true;
    }
  }

  const bridgeEntry = moduleMap.get("bridge/src/index.ts");
  if (bridgeEntry) {
    bridgeEntry.importedBy.add("[entry]");
    bridgeEntry.isEntryRoot = true;
  }

  for (const module of moduleMap.values()) {
    const sourceText = fs.readFileSync(path.resolve(ROOT, module.repoPath), "utf8");
    for (const specifier of collectImportSpecifiers(sourceText)) {
      const resolved = resolveImport(specifier, module, module.workspace, moduleMap, packageByName);
      if (!resolved || resolved === module.repoPath) {
        continue;
      }
      module.imports.add(resolved);
      moduleMap.get(resolved)?.importedBy.add(module.repoPath);
    }
  }

  return moduleMap;
}

function createCrossLayerViolation(sourceModule, targetModule) {
  if (sourceModule.workspacePath !== targetModule.workspacePath) {
    return null;
  }

  const sourceLayer = sourceModule.layer;
  const targetLayer = targetModule.layer;
  if (!sourceLayer || !targetLayer || sourceLayer.rank == null || targetLayer.rank == null) {
    return null;
  }
  if (!STRICT_LOW_LAYERS.has(sourceLayer.name) || targetLayer.rank <= sourceLayer.rank) {
    return null;
  }

  return {
    workspace: sourceModule.workspacePath,
    sourcePath: sourceModule.repoPath,
    sourceLayer: sourceLayer.name,
    targetPath: targetModule.repoPath,
    targetLayer: targetLayer.name,
    reason: `${sourceLayer.name} -> ${targetLayer.name}`
  };
}

export function buildTopologyReport(topLimit) {
  const moduleMap = buildGraph();
  const modules = [...moduleMap.values()].sort((left, right) => left.repoPath.localeCompare(right.repoPath));
  const crossLayerViolations = [];
  const suspectedOrphans = [];

  for (const module of modules) {
    for (const targetPath of module.imports) {
      const targetModule = moduleMap.get(targetPath);
      const violation = targetModule ? createCrossLayerViolation(module, targetModule) : null;
      if (violation) {
        crossLayerViolations.push(violation);
      }
    }

    const isSourceModule =
      module.repoPath.includes("/src/") || module.repoPath.startsWith("bridge/src/") || module.repoPath.startsWith("apps/landing/src/");
    if (isTestSupportFile(module.repoPath) || !isSourceModule || module.isEntryRoot) {
      continue;
    }

    const hasOnlyEntryImports = [...module.importedBy].every((entry) => entry === "[entry]");
    if (module.importedBy.size === 0 || (hasOnlyEntryImports && module.importedBy.size > 0)) {
      suspectedOrphans.push({
        workspace: module.workspacePath,
        path: module.repoPath,
        layer: module.layer.name
      });
    }
  }

  const toFanEntry = (module, count) => ({
    path: module.repoPath,
    workspace: module.workspacePath,
    layer: module.layer.name,
    count
  });

  crossLayerViolations.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath) || left.targetPath.localeCompare(right.targetPath));
  suspectedOrphans.sort((left, right) => left.path.localeCompare(right.path));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      modules: modules.length,
      internalEdges: modules.reduce((sum, module) => sum + module.imports.size, 0),
      crossLayerViolations: crossLayerViolations.length,
      suspectedOrphans: suspectedOrphans.length
    },
    topFanIn: modules
      .map((module) => toFanEntry(module, [...module.importedBy].filter((entry) => entry !== "[entry]").length))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path))
      .slice(0, topLimit),
    topFanOut: modules
      .map((module) => toFanEntry(module, module.imports.size))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path))
      .slice(0, topLimit),
    crossLayerViolations,
    suspectedOrphans
  };
}

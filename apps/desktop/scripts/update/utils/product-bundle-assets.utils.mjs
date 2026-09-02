import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import JSZip from "jszip";
import { resolveDesktopNativeResourcePackageNames } from "../../prepare-native-app-resources.mjs";
import {
  PACKAGED_EXTENSION_PACKAGE_DIRS,
  PRODUCT_BUNDLE_ASSET_CONTRACT,
  PRODUCT_BUNDLE_ASSET_CONTRACT_SCHEMA_VERSION,
  PRODUCT_BUNDLE_INVENTORY_SCHEMA_VERSION
} from "../configs/product-bundle-assets.config.mjs";

const SUPPORTED_ASSET_KINDS = new Set(["file", "tree", "pattern", "prepared-tree"]);

function normalizeRelativePath(value, context) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} must be a non-empty relative path.`);
  }
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (isAbsolute(value) || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`${context} must stay inside its declared root: ${value}`);
  }
  return posix.normalize(normalized);
}

function assetAppliesToTarget(asset, platform, arch) {
  return (!asset.platforms || asset.platforms.includes(platform)) && (!asset.arches || asset.arches.includes(arch));
}

export function validateProductBundleAssetContract(contract = PRODUCT_BUNDLE_ASSET_CONTRACT) {
  if (contract?.schemaVersion !== PRODUCT_BUNDLE_ASSET_CONTRACT_SCHEMA_VERSION) {
    throw new Error(`Unsupported product bundle asset contract schema: ${String(contract?.schemaVersion)}`);
  }
  if (!Array.isArray(contract.assets) || contract.assets.length === 0) {
    throw new Error("Product bundle asset contract must declare at least one asset.");
  }
  if (!Number.isInteger(contract.runtimeFileBudget) || contract.runtimeFileBudget < 1) {
    throw new Error("Product bundle asset contract must declare a positive runtimeFileBudget.");
  }
  if (!Array.isArray(contract.generatedRequiredPaths) || !Array.isArray(contract.packagedExtensions)) {
    throw new Error("Product bundle asset contract must declare generatedRequiredPaths and packagedExtensions arrays.");
  }
  const ids = new Set();
  for (const asset of contract.assets) {
    validateAssetDeclaration(asset);
    if (ids.has(asset.id)) throw new Error(`Duplicate product bundle asset id: ${asset.id}`);
    ids.add(asset.id);
  }
  for (const requiredPath of contract.generatedRequiredPaths ?? []) {
    normalizeRelativePath(requiredPath, "Generated product bundle required path");
  }
  for (const extensionName of contract.packagedExtensions) {
    normalizeRelativePath(extensionName, "Packaged extension directory");
  }
  return contract;
}

function validateAssetDeclaration(asset) {
  if (typeof asset?.id !== "string" || !asset.id.trim()) throw new Error("Product bundle asset id is required.");
  if (!SUPPORTED_ASSET_KINDS.has(asset.kind)) {
    throw new Error(`Unsupported product bundle asset kind for ${asset.id}: ${String(asset.kind)}`);
  }
  if (typeof asset.sourceRoot !== "string" || !asset.sourceRoot.trim()) {
    throw new Error(`Product bundle asset ${asset.id} must declare sourceRoot.`);
  }
  normalizeRelativePath(asset.sourcePath, `Product bundle asset ${asset.id} sourcePath`);
  if (!Array.isArray(asset.targetPaths) || asset.targetPaths.length === 0) {
    throw new Error(`Product bundle asset ${asset.id} must declare targetPaths.`);
  }
  for (const targetPath of asset.targetPaths) {
    normalizeRelativePath(targetPath, `Product bundle asset ${asset.id} targetPath`);
  }
  if (asset.kind === "pattern") {
    if (!(asset.match instanceof RegExp)) throw new Error(`Pattern asset ${asset.id} must declare a RegExp match.`);
    if (!Number.isInteger(asset.minimumMatches) || asset.minimumMatches < 1) {
      throw new Error(`Pattern asset ${asset.id} must require at least one match.`);
    }
  }
  for (const requiredEntry of asset.requiredEntries ?? []) {
    normalizeRelativePath(requiredEntry, `Product bundle asset ${asset.id} requiredEntry`);
  }
}

async function listFilesRecursively(rootPath, relativeRoot = "") {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelativePath = relativeRoot ? join(relativeRoot, entry.name) : entry.name;
    const entryPath = join(rootPath, entry.name);
    const entryStat = await stat(entryPath);
    if (entryStat.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath, entryRelativePath)));
      continue;
    }
    if (entryStat.isFile()) files.push(entryRelativePath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function resolveAssetSourceFiles(asset, sourceRoot) {
  const sourcePath = resolve(sourceRoot, asset.sourcePath);
  if (!existsSync(sourcePath)) {
    throw new Error(`Product bundle asset ${asset.id} source is missing: ${sourcePath}`);
  }
  if (asset.kind === "file") {
    if (!(await stat(sourcePath)).isFile()) throw new Error(`Product bundle asset ${asset.id} source is not a file: ${sourcePath}`);
    return [{ relativePath: "", sourcePath }];
  }
  if (!(await stat(sourcePath)).isDirectory()) {
    throw new Error(`Product bundle asset ${asset.id} source is not a directory: ${sourcePath}`);
  }
  if (asset.kind === "pattern") {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    const matches = entries
      .filter((entry) => {
        asset.match.lastIndex = 0;
        return entry.isFile() && asset.match.test(entry.name);
      })
      .map((entry) => ({ relativePath: entry.name, sourcePath: join(sourcePath, entry.name) }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    if (matches.length < asset.minimumMatches) {
      throw new Error(
        `Product bundle asset ${asset.id} matched ${matches.length} file(s), expected at least ${asset.minimumMatches}: ${sourcePath}`
      );
    }
    return matches;
  }
  const relativePaths = await listFilesRecursively(sourcePath);
  if (relativePaths.length === 0) throw new Error(`Product bundle asset ${asset.id} source tree is empty: ${sourcePath}`);
  for (const requiredEntry of asset.requiredEntries ?? []) {
    const normalizedRequiredEntry = normalizeRelativePath(requiredEntry, `Product bundle asset ${asset.id} requiredEntry`);
    if (!relativePaths.some((entry) => entry.replaceAll(sep, "/") === normalizedRequiredEntry)) {
      throw new Error(`Product bundle asset ${asset.id} is missing required source entry: ${normalizedRequiredEntry}`);
    }
  }
  return relativePaths.map((relativePath) => ({ relativePath, sourcePath: join(sourcePath, relativePath) }));
}

export async function resolveProductBundleAssetFiles(options) {
  const {
    sourceRoots,
    platform = process.platform,
    arch = process.arch,
    contract = PRODUCT_BUNDLE_ASSET_CONTRACT
  } = options;
  validateProductBundleAssetContract(contract);
  const resolvedAssets = [];
  const claimedTargets = new Map();
  for (const asset of contract.assets.filter((entry) => assetAppliesToTarget(entry, platform, arch))) {
    const sourceRoot = sourceRoots[asset.sourceRoot];
    if (!sourceRoot) throw new Error(`Product bundle asset ${asset.id} has no source root binding: ${asset.sourceRoot}`);
    const sourceFiles = await resolveAssetSourceFiles(asset, sourceRoot);
    const files = [];
    for (const targetRoot of asset.targetPaths) {
      const normalizedTargetRoot = normalizeRelativePath(targetRoot, `Product bundle asset ${asset.id} targetPath`);
      for (const sourceFile of sourceFiles) {
        const targetPath = sourceFile.relativePath
          ? posix.join(normalizedTargetRoot, sourceFile.relativePath.replaceAll(sep, "/"))
          : normalizedTargetRoot;
        const existingOwner = claimedTargets.get(targetPath);
        if (existingOwner) {
          throw new Error(`Product bundle asset target collision: ${targetPath} (${existingOwner}, ${asset.id})`);
        }
        claimedTargets.set(targetPath, asset.id);
        files.push({ sourcePath: sourceFile.sourcePath, targetPath });
      }
    }
    resolvedAssets.push({ id: asset.id, files });
  }
  const targetPaths = Array.from(claimedTargets.keys()).sort((left, right) => left.localeCompare(right));
  for (let index = 0; index < targetPaths.length - 1; index += 1) {
    const targetPath = targetPaths[index];
    const nextTargetPath = targetPaths[index + 1];
    if (nextTargetPath.startsWith(`${targetPath}/`)) {
      throw new Error(
        `Product bundle asset target collision: ${targetPath} is both a file and a parent of ${nextTargetPath}`
      );
    }
  }
  return resolvedAssets;
}

export async function copyProductBundleAssets(options) {
  const { bundleRoot } = options;
  const resolvedAssets = await resolveProductBundleAssetFiles(options);
  for (const asset of resolvedAssets) {
    for (const file of asset.files) {
      const targetPath = resolve(bundleRoot, file.targetPath);
      const relativeTarget = relative(bundleRoot, targetPath);
      if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`) || isAbsolute(relativeTarget)) {
        throw new Error(`Product bundle asset ${asset.id} target escapes bundle root: ${file.targetPath}`);
      }
      await mkdir(dirname(targetPath), { recursive: true });
      await cp(file.sourcePath, targetPath, { dereference: true });
    }
  }
  return resolvedAssets.map((asset) => ({
    id: asset.id,
    paths: asset.files.map((file) => file.targetPath).sort((left, right) => left.localeCompare(right))
  }));
}

function listDirectoryFiles(rootPath, relativeRoot = "") {
  return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = relativeRoot ? posix.join(relativeRoot, entry.name) : entry.name;
    const entryPath = join(rootPath, entry.name);
    const entryStat = statSync(entryPath);
    return entryStat.isDirectory() ? listDirectoryFiles(entryPath, relativePath) : [{ path: relativePath, filePath: entryPath }];
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createProductBundleAssetInventory(bundleRoot) {
  const files = listDirectoryFiles(bundleRoot)
    .filter((entry) => entry.path !== "manifest.json")
    .map((entry) => {
      const bytes = readFileSync(entry.filePath);
      return { path: entry.path, bytes: bytes.length, sha256: sha256(bytes) };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  return { schemaVersion: PRODUCT_BUNDLE_INVENTORY_SCHEMA_VERSION, files };
}

function readNativeDependencyPackageNames(paths) {
  const packageNames = new Set();
  const prefix = "node_modules/";
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const segments = path.slice(prefix.length).split("/").filter(Boolean);
    if (segments.length === 0) continue;
    packageNames.add(segments[0].startsWith("@") ? `${segments[0]}/${segments[1] ?? ""}` : segments[0]);
  }
  return Array.from(packageNames).filter((packageName) => !packageName.endsWith("/")).sort();
}

function assertNativeRuntimeContract(paths, platform, arch, manifestPackageNames) {
  const expectedPackageNames = resolveDesktopNativeResourcePackageNames(platform, arch).sort();
  const actualPackageNames = readNativeDependencyPackageNames(paths);
  if (JSON.stringify(actualPackageNames) !== JSON.stringify(expectedPackageNames)) {
    throw new Error(
      `Product bundle native dependency mismatch for ${platform}-${arch}: expected=${expectedPackageNames.join(",")} actual=${actualPackageNames.join(",")}`
    );
  }
  if (JSON.stringify([...manifestPackageNames].sort()) !== JSON.stringify(expectedPackageNames)) {
    throw new Error(`Product bundle manifest native dependency mismatch for ${platform}-${arch}.`);
  }
  const target = `${platform}-${arch}`;
  const sharpRoot = `node_modules/@img/sharp-${target}/`;
  if (!paths.some((path) => path.startsWith(sharpRoot) && path.endsWith(".node"))) {
    throw new Error(`Product bundle is missing the sharp native binary for ${target}.`);
  }
  const libvipsPackage = `@img/sharp-libvips-${target}`;
  if (expectedPackageNames.includes(libvipsPackage)) {
    const libvipsRoot = `node_modules/${libvipsPackage}/`;
    if (!paths.some((path) => path.startsWith(libvipsRoot) && path.includes("libvips"))) {
      throw new Error(`Product bundle is missing the sharp libvips runtime for ${target}.`);
    }
  }
}

function assertRequiredBundlePaths(
  paths,
  assetContract,
  contract = PRODUCT_BUNDLE_ASSET_CONTRACT,
  platform = process.platform,
  arch = process.arch
) {
  const availablePaths = new Set(paths);
  const missingGeneratedPaths = contract.generatedRequiredPaths.filter((path) => !availablePaths.has(path));
  if (missingGeneratedPaths.length > 0) {
    throw new Error(`Product bundle is missing generated required files: ${missingGeneratedPaths.join(", ")}`);
  }
  const expectedAssetIds = contract.assets
    .filter((asset) => assetAppliesToTarget(asset, platform, arch))
    .map((asset) => asset.id);
  const declaredAssetIds = assetContract.declaredAssets.map((asset) => asset.id);
  if (JSON.stringify(declaredAssetIds) !== JSON.stringify(expectedAssetIds)) {
    throw new Error(
      `Product bundle declared asset contract mismatch: expected=${expectedAssetIds.join(",")} actual=${declaredAssetIds.join(",")}`
    );
  }
  for (const asset of assetContract.declaredAssets) {
    if (!Array.isArray(asset.paths) || asset.paths.length === 0) {
      throw new Error(`Product bundle declared asset has no files: ${asset.id}`);
    }
    const missingPaths = asset.paths.filter((path) => !availablePaths.has(path));
    if (missingPaths.length > 0) throw new Error(`Product bundle asset ${asset.id} is missing files: ${missingPaths.join(", ")}`);
  }
  const expectedExtensions = [...(contract.packagedExtensions ?? [])];
  if (JSON.stringify(assetContract.packagedExtensions) !== JSON.stringify(expectedExtensions)) {
    throw new Error("Product bundle packaged extension contract does not match the active configuration.");
  }
  const missingExtensionPaths = expectedExtensions.flatMap((name) =>
    [`plugins/${name}/nextclaw.extension.json`, `plugins/${name}/dist/main.mjs`].filter((path) => !availablePaths.has(path))
  );
  if (missingExtensionPaths.length > 0) {
    throw new Error(`Product bundle is missing packaged extension files: ${missingExtensionPaths.join(", ")}`);
  }
}

function assertRuntimeBundlePolicy(paths, runtimeFileBudget) {
  const forbiddenNodeModules = paths.filter(
    (path) => path.startsWith("runtime/node_modules/") || /^plugins\/[^/]+\/(?:dist\/)?node_modules\//.test(path)
  );
  if (forbiddenNodeModules.length > 0) {
    throw new Error(`Product bundle contains forbidden nested node_modules: ${forbiddenNodeModules[0]}`);
  }
  const runtimeFileCount = paths.filter((path) => path.startsWith("runtime/")).length;
  if (runtimeFileCount > runtimeFileBudget) {
    throw new Error(`Product bundle runtime file count ${runtimeFileCount} exceeds budget ${runtimeFileBudget}.`);
  }
  return runtimeFileCount;
}

export function assertPreparedProductBundle(options) {
  const {
    bundleRoot,
    platform,
    arch,
    declaredAssets,
    nativeRuntimeDependencies,
    packagedExtensions = PACKAGED_EXTENSION_PACKAGE_DIRS,
    contract = PRODUCT_BUNDLE_ASSET_CONTRACT
  } = options;
  const paths = listDirectoryFiles(bundleRoot).map((entry) => entry.path).filter((path) => path !== "manifest.json");
  const assetContract = { declaredAssets, nativeRuntimeDependencies, packagedExtensions };
  assertRequiredBundlePaths(paths, assetContract, contract, platform, arch);
  assertNativeRuntimeContract(paths, platform, arch, nativeRuntimeDependencies);
  return {
    runtimeFileCount: assertRuntimeBundlePolicy(paths, contract.runtimeFileBudget),
    pluginFileCount: paths.filter((path) => path.startsWith("plugins/")).length
  };
}

function validateInventory(inventory) {
  if (inventory?.schemaVersion !== PRODUCT_BUNDLE_INVENTORY_SCHEMA_VERSION || !Array.isArray(inventory.files)) {
    throw new Error("Product bundle asset inventory is missing or invalid.");
  }
  const paths = inventory.files.map((entry) => entry.path);
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify(sortedPaths)) {
    throw new Error("Product bundle asset inventory paths must be unique and sorted.");
  }
  for (const entry of inventory.files) {
    normalizeRelativePath(entry.path, "Product bundle inventory path");
    if (!Number.isInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) {
      throw new Error(`Product bundle inventory entry is invalid: ${JSON.stringify(entry)}`);
    }
  }
  return paths;
}

export async function verifyProductBundleArchive(archivePath, options = {}) {
  const archive = await JSZip.loadAsync(readFileSync(archivePath));
  const manifestEntry = archive.file("bundle/manifest.json");
  if (!manifestEntry) throw new Error(`Product bundle manifest is missing: ${archivePath}`);
  const manifest = JSON.parse(await manifestEntry.async("string"));
  const platform = options.platform ?? manifest.platform;
  const arch = options.arch ?? manifest.arch;
  if (manifest.platform !== platform || manifest.arch !== arch) {
    throw new Error(`Product bundle target mismatch: manifest=${manifest.platform}-${manifest.arch} expected=${platform}-${arch}`);
  }
  if (manifest.assetContract?.schemaVersion !== PRODUCT_BUNDLE_ASSET_CONTRACT_SCHEMA_VERSION) {
    throw new Error("Product bundle manifest asset contract is missing or invalid.");
  }
  const inventoryPaths = validateInventory(manifest.assetContract.inventory);
  const archivePaths = Object.values(archive.files)
    .filter((entry) => !entry.dir && entry.name !== "bundle/manifest.json")
    .map((entry) => entry.name.replace(/^bundle\//, ""))
    .sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(archivePaths) !== JSON.stringify(inventoryPaths)) {
    const inventorySet = new Set(inventoryPaths);
    const archiveSet = new Set(archivePaths);
    const missing = inventoryPaths.filter((path) => !archiveSet.has(path));
    const unexpected = archivePaths.filter((path) => !inventorySet.has(path));
    throw new Error(`Product bundle archive inventory mismatch: missing=${missing.join(",")} unexpected=${unexpected.join(",")}`);
  }
  for (const inventoryEntry of manifest.assetContract.inventory.files) {
    const bytes = await archive.file(`bundle/${inventoryEntry.path}`).async("nodebuffer");
    if (bytes.length !== inventoryEntry.bytes || sha256(bytes) !== inventoryEntry.sha256) {
      throw new Error(`Product bundle archive asset integrity mismatch: ${inventoryEntry.path}`);
    }
  }
  assertRequiredBundlePaths(
    inventoryPaths,
    manifest.assetContract,
    options.contract ?? PRODUCT_BUNDLE_ASSET_CONTRACT,
    platform,
    arch
  );
  assertNativeRuntimeContract(inventoryPaths, platform, arch, manifest.assetContract.nativeRuntimeDependencies);
  const runtimeFileCount = assertRuntimeBundlePolicy(
    inventoryPaths,
    (options.contract ?? PRODUCT_BUNDLE_ASSET_CONTRACT).runtimeFileBudget
  );
  return {
    manifest,
    runtimeFileCount,
    pluginFileCount: inventoryPaths.filter((path) => path.startsWith("plugins/")).length,
    nativeRuntimeDependencies: manifest.assetContract.nativeRuntimeDependencies
  };
}

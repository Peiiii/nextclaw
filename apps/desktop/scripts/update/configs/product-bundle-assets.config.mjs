export const PRODUCT_BUNDLE_ASSET_CONTRACT_SCHEMA_VERSION = 1;
export const PRODUCT_BUNDLE_INVENTORY_SCHEMA_VERSION = 1;
export const RUNTIME_ENTRYPOINT = "runtime/dist/cli/app/index.js";

export const PACKAGED_EXTENSION_PACKAGE_DIRS = Object.freeze([
  "nextclaw-channel-extension-dingtalk",
  "nextclaw-channel-extension-discord",
  "nextclaw-channel-extension-email",
  "nextclaw-channel-extension-feishu",
  "nextclaw-channel-extension-qq",
  "nextclaw-channel-extension-slack",
  "nextclaw-channel-extension-telegram",
  "nextclaw-channel-extension-wecom",
  "nextclaw-channel-extension-whatsapp",
  "nextclaw-channel-extension-weixin",
  "nextclaw-desktop-extension-wechat"
]);

export const PRODUCT_BUNDLE_ASSET_CONTRACT = Object.freeze({
  schemaVersion: PRODUCT_BUNDLE_ASSET_CONTRACT_SCHEMA_VERSION,
  generatedRequiredPaths: Object.freeze([
    "runtime/dist/cli/app/index.js",
    "runtime/dist/cli/app/index.mjs",
    "runtime/package.json"
  ]),
  packagedExtensions: PACKAGED_EXTENSION_PACKAGE_DIRS,
  assets: Object.freeze([
    Object.freeze({
      id: "runtime-ui",
      kind: "tree",
      sourceRoot: "nextclaw-package",
      sourcePath: "ui-dist",
      targetPaths: Object.freeze(["runtime/ui-dist", "ui"]),
      requiredEntries: Object.freeze(["index.html"])
    }),
    Object.freeze({
      id: "runtime-templates",
      kind: "tree",
      sourceRoot: "nextclaw-package",
      sourcePath: "templates",
      targetPaths: Object.freeze(["runtime/templates"])
    }),
    Object.freeze({
      id: "runtime-resources",
      kind: "tree",
      sourceRoot: "nextclaw-package",
      sourcePath: "resources",
      targetPaths: Object.freeze(["runtime/resources"]),
      requiredEntries: Object.freeze(["USAGE.md"])
    }),
    Object.freeze({
      id: "app-runtime-resources",
      kind: "tree",
      sourceRoot: "app-runtime-package",
      sourcePath: "resources",
      targetPaths: Object.freeze(["runtime/dist/resources"]),
      requiredEntries: Object.freeze(["wit/portable-service.wit", "rust-wasi/Cargo.lock"])
    }),
    Object.freeze({
      id: "runtime-bridge",
      kind: "tree",
      sourceRoot: "nextclaw-package",
      sourcePath: "bridge",
      targetPaths: Object.freeze(["runtime/bridge"])
    }),
    Object.freeze({
      id: "sqljs-wasm",
      kind: "file",
      sourceRoot: "kernel-sqljs",
      sourcePath: "dist/sql-wasm.wasm",
      targetPaths: Object.freeze(["runtime/dist/cli/app/sql-wasm.wasm"])
    }),
    Object.freeze({
      id: "session-search-worker",
      kind: "file",
      sourceRoot: "core-dist",
      sourcePath: "features/session-search/worker/session-search-worker-host.utils.js",
      targetPaths: Object.freeze([
        "runtime/dist/cli/app/features/session-search/worker/session-search-worker-host.utils.js"
      ])
    }),
    Object.freeze({
      id: "session-search-worker-chunks",
      kind: "pattern",
      sourceRoot: "core-dist",
      sourcePath: ".",
      targetPaths: Object.freeze(["runtime/dist/cli/app"]),
      match: /^session-search\.types-.+\.js$/,
      minimumMatches: 1
    }),
    Object.freeze({
      id: "runtime-skills",
      kind: "tree",
      sourceRoot: "core-dist",
      sourcePath: "skills",
      targetPaths: Object.freeze(["runtime/dist/cli/app/skills"]),
      requiredEntries: Object.freeze(["nextclaw-self-manage/SKILL.md"])
    }),
    Object.freeze({
      id: "native-runtime-dependencies",
      kind: "prepared-tree",
      sourceRoot: "native-resources",
      sourcePath: "node_modules",
      targetPaths: Object.freeze(["node_modules"])
    })
  ])
});

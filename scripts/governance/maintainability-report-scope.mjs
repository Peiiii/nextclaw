import path from "node:path";

export const MAINTAINABILITY_REPORT_DEFERRED_WORKSPACES = [
  {
    workspace: "packages/extensions/nextclaw-channel-plugin-feishu",
    reason: "非核心渠道插件，近期更新频率较低；当前先把治理注意力集中在核心运行链路。"
  }
];

function normalizeScopePath(pathText) {
  const normalized = `${pathText ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  return normalized
    .split(path.sep)
    .join(path.posix.sep)
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

export function findDeferredMaintainabilityWorkspace(pathText) {
  const normalized = normalizeScopePath(pathText);
  if (!normalized) {
    return null;
  }

  return MAINTAINABILITY_REPORT_DEFERRED_WORKSPACES.find((entry) => {
    const workspace = normalizeScopePath(entry.workspace);
    return normalized === workspace || normalized.startsWith(`${workspace}/`);
  }) ?? null;
}

export function isDeferredMaintainabilityWorkspace(pathText) {
  return Boolean(findDeferredMaintainabilityWorkspace(pathText));
}

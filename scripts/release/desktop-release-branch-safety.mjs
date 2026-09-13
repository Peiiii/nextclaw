export function assertDesktopBranchRelationship({ ahead, allowRemoteAhead, behind, upstreamRef }) {
  if (allowRemoteAhead && ahead > 0) {
    throw new Error(`Current branch diverges from ${upstreamRef}; orchestrated releases may only use its ancestor.`);
  }
  if (behind > 0 && !allowRemoteAhead) {
    throw new Error(`Current branch is behind ${upstreamRef} by ${behind} commit(s). Pull/rebase first.`);
  }
}

export function assertRemoteAheadOption(options, env = process.env) {
  if (options.allowRemoteAhead && (!options.target || env.GITHUB_ACTIONS !== "true")) {
    throw new Error("--allow-remote-ahead requires GitHub Actions and an explicit immutable --target.");
  }
}

export function formatRemoteAheadWarning({ behind, target, upstreamRef }) {
  return `[desktop:release] frozen control plane is behind ${upstreamRef} by ${behind} commit(s); continuing with immutable product target ${target}.`;
}

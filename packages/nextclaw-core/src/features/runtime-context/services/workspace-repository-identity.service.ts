import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export type WorkspaceRepositoryIdentity = {
  workspace: string;
  repoRoot: string | null;
  canonicalRemoteName: string | null;
  canonicalRemoteUrl: string | null;
  canonicalWebUrl: string | null;
};

type ParsedRemote = {
  name: string;
  url: string;
  webUrl: string | null;
};

const REMOTE_PRIORITY = ["origin", "origin-https", "upstream"];

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class WorkspaceRepositoryIdentityResolver {
  resolve = (workspace: string): WorkspaceRepositoryIdentity => {
    const resolvedWorkspace = resolve(workspace);
    const repoRoot = this.findRepoRoot(resolvedWorkspace);
    if (!repoRoot) {
      return {
        workspace: resolvedWorkspace,
        repoRoot: null,
        canonicalRemoteName: null,
        canonicalRemoteUrl: null,
        canonicalWebUrl: null,
      };
    }

    const gitConfig = this.readGitConfig(repoRoot);
    const remotes = gitConfig ? this.parseRemotes(gitConfig) : [];
    const canonicalRemote = this.selectCanonicalRemote(remotes);

    return {
      workspace: resolvedWorkspace,
      repoRoot,
      canonicalRemoteName: canonicalRemote?.name ?? null,
      canonicalRemoteUrl: canonicalRemote?.url ?? null,
      canonicalWebUrl: canonicalRemote?.webUrl ?? null,
    };
  };

  private findRepoRoot = (workspace: string): string | null => {
    let current = resolve(workspace);
    while (true) {
      if (existsSync(join(current, ".git"))) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  };

  private readGitConfig = (repoRoot: string): string | null => {
    const configPath = this.resolveGitConfigPath(repoRoot);
    if (!configPath || !existsSync(configPath)) {
      return null;
    }
    const raw = readFileSync(configPath, "utf-8");
    return raw.trim().length > 0 ? raw : null;
  };

  private resolveGitConfigPath = (repoRoot: string): string | null => {
    const gitPath = join(repoRoot, ".git");
    if (!existsSync(gitPath)) {
      return null;
    }

    const gitStats = lstatSync(gitPath);
    if (gitStats.isDirectory()) {
      const configPath = join(gitPath, "config");
      return existsSync(configPath) ? configPath : null;
    }

    if (!gitStats.isFile()) {
      return null;
    }

    const pointerFile = readFileSync(gitPath, "utf-8");
    const match = pointerFile.match(/gitdir:\s*(.+)/i);
    const gitDir = normalizeOptionalString(match?.[1]);
    if (!gitDir) {
      return null;
    }

    const resolvedGitDir = isAbsolute(gitDir) ? gitDir : resolve(repoRoot, gitDir);
    const configPath = join(resolvedGitDir, "config");
    return existsSync(configPath) ? configPath : null;
  };

  private parseRemotes = (gitConfig: string): ParsedRemote[] => {
    const remotes: ParsedRemote[] = [];
    const seenNames = new Set<string>();
    let currentRemoteName: string | null = null;

    for (const line of gitConfig.split(/\r?\n/g)) {
      const remoteMatch = line.match(/^\s*\[remote\s+"([^"]+)"\]\s*$/);
      if (remoteMatch) {
        currentRemoteName = remoteMatch[1]?.trim() || null;
        continue;
      }

      if (/^\s*\[/.test(line)) {
        currentRemoteName = null;
        continue;
      }

      if (!currentRemoteName || seenNames.has(currentRemoteName)) {
        continue;
      }

      const urlMatch = line.match(/^\s*url\s*=\s*(.+?)\s*$/);
      const remoteUrl = normalizeOptionalString(urlMatch?.[1]);
      if (!remoteUrl) {
        continue;
      }

      remotes.push({
        name: currentRemoteName,
        url: remoteUrl,
        webUrl: this.normalizeRemoteToWebUrl(remoteUrl),
      });
      seenNames.add(currentRemoteName);
    }

    return remotes;
  };

  private selectCanonicalRemote = (remotes: ParsedRemote[]): ParsedRemote | null => {
    for (const remoteName of REMOTE_PRIORITY) {
      const matchedRemote = remotes.find((remote) => remote.name === remoteName);
      if (matchedRemote) {
        return matchedRemote;
      }
    }
    return remotes.find((remote) => Boolean(remote.webUrl)) ?? remotes[0] ?? null;
  };

  private normalizeRemoteToWebUrl = (remoteUrl: string): string | null => {
    const normalizedUrl = remoteUrl.startsWith("git+") ? remoteUrl.slice(4) : remoteUrl;
    const scpMatch =
      !normalizedUrl.includes("://")
        ? normalizedUrl.match(/^(?:[^@]+@)?([^:]+):(.+)$/)
        : null;

    if (scpMatch) {
      return this.buildWebUrl({
        host: scpMatch[1] ?? "",
        repoPath: scpMatch[2] ?? "",
      });
    }

    try {
      const parsed = new URL(normalizedUrl);
      return this.buildWebUrl({
        host: parsed.hostname,
        repoPath: parsed.pathname,
      });
    } catch {
      return null;
    }
  };

  private buildWebUrl = (params: {
    host: string;
    repoPath: string;
  }): string | null => {
    const normalizedHost = this.normalizeRepositoryHost(params.host);
    const normalizedPath = params.repoPath
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");

    if (!normalizedHost || !normalizedPath) {
      return null;
    }

    const pathSegments = normalizedPath.split("/").filter(Boolean);
    if (pathSegments.length < 2) {
      return null;
    }

    return `https://${normalizedHost}/${pathSegments.join("/")}`;
  };

  private normalizeRepositoryHost = (host: string): string | null => {
    const normalizedHost = normalizeOptionalString(host)?.toLowerCase();
    if (!normalizedHost) {
      return null;
    }
    return normalizedHost === "ssh.github.com" ? "github.com" : normalizedHost;
  };
}

export const DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER =
  new WorkspaceRepositoryIdentityResolver();

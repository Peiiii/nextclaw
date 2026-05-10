import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type StoredWeixinAccount = {
  accountId: string;
  token: string;
  baseUrl?: string;
  userId?: string;
  savedAt?: string;
};

export type WeixinAccountStore = {
  listAccountIds: () => string[];
  loadAccount: (accountId: string) => StoredWeixinAccount | null;
  loadCursor: (accountId: string) => string | undefined;
  saveCursor: (accountId: string, cursor: string | undefined) => void;
  deleteCursor: (accountId: string) => void;
};

function resolveNextclawHome(): string {
  const override = process.env.NEXTCLAW_HOME?.trim();
  return resolve(override || join(homedir(), ".nextclaw"));
}

function resolveWeixinDataDir(): string {
  return join(resolveNextclawHome(), "channels", "weixin");
}

function resolveAccountsDir(): string {
  return join(resolveWeixinDataDir(), "accounts");
}

function resolveCursorsDir(): string {
  return join(resolveWeixinDataDir(), "cursors");
}

function toFileName(accountId: string): string {
  return `${encodeURIComponent(accountId)}.json`;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export class FileWeixinAccountStore implements WeixinAccountStore {
  readonly listAccountIds = (): string[] => {
    if (!existsSync(resolveAccountsDir())) {
      return [];
    }
    return readdirSync(resolveAccountsDir())
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => decodeURIComponent(entry.slice(0, -5)))
      .filter(Boolean);
  };

  readonly loadAccount = (accountId: string): StoredWeixinAccount | null => {
    return readJsonFile<StoredWeixinAccount>(join(resolveAccountsDir(), toFileName(accountId)));
  };

  readonly loadCursor = (accountId: string): string | undefined => {
    const payload = readJsonFile<{ cursor?: string }>(join(resolveCursorsDir(), toFileName(accountId)));
    return payload?.cursor?.trim() || undefined;
  };

  readonly saveCursor = (accountId: string, cursor: string | undefined): void => {
    mkdirSync(resolveCursorsDir(), { recursive: true });
    writeFileSync(
      join(resolveCursorsDir(), toFileName(accountId)),
      JSON.stringify({ cursor: cursor ?? "" }, null, 2),
    );
  };

  readonly deleteCursor = (accountId: string): void => {
    rmSync(join(resolveCursorsDir(), toFileName(accountId)), { force: true });
  };
}

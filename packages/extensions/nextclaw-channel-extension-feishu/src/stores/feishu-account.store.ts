import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { FeishuDomain } from "../types/feishu-extension.types.js";

export type StoredFeishuAccount = {
  accountId: string;
  appId: string;
  appSecret: string;
  domain: FeishuDomain;
  botName?: string;
  botOpenId?: string;
  ownerOpenId?: string;
  savedAt?: string;
};

export type FeishuAccountStore = {
  listAccountIds: () => string[];
  loadAccount: (accountId: string) => StoredFeishuAccount | null;
  saveAccount: (account: StoredFeishuAccount) => void;
  deleteAccount: (accountId: string) => void;
};

const NEXTCLAW_HOME_ENV_KEY = "NEXTCLAW_HOME";
const NEXTCLAW_DEFAULT_HOME_DIR = ".nextclaw";

function resolveNextclawHome(): string {
  const override = process.env[NEXTCLAW_HOME_ENV_KEY]?.trim();
  return resolve(override || join(homedir(), NEXTCLAW_DEFAULT_HOME_DIR));
}

function resolveAccountsDir(): string {
  return join(resolveNextclawHome(), "channels", "feishu", "accounts");
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

export class FileFeishuAccountStore implements FeishuAccountStore {
  readonly listAccountIds = (): string[] => {
    if (!existsSync(resolveAccountsDir())) {
      return [];
    }
    return readdirSync(resolveAccountsDir())
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => decodeURIComponent(entry.slice(0, -5)))
      .filter(Boolean);
  };

  readonly loadAccount = (accountId: string): StoredFeishuAccount | null => {
    return readJsonFile<StoredFeishuAccount>(join(resolveAccountsDir(), toFileName(accountId)));
  };

  readonly saveAccount = (account: StoredFeishuAccount): void => {
    mkdirSync(resolveAccountsDir(), { recursive: true });
    writeFileSync(
      join(resolveAccountsDir(), toFileName(account.accountId)),
      JSON.stringify(account, null, 2),
    );
  };

  readonly deleteAccount = (accountId: string): void => {
    rmSync(join(resolveAccountsDir(), toFileName(accountId)), { force: true });
  };
}

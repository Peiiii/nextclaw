import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";

export type RuntimeCliOptions = {
  host: string;
  port: number;
  json: boolean;
  documentGrantMap: AppDocumentGrantMap;
};

export type CreateCliOptions = {
  json: boolean;
};

export type PackCliOptions = {
  json: boolean;
  outputPath?: string;
};

export type JsonOnlyCliOptions = {
  json: boolean;
};

export type InstallCliOptions = {
  json: boolean;
  registryUrl?: string;
};

export type UpdateCliOptions = {
  json: boolean;
  registryUrl?: string;
  version?: string;
};

export type UninstallCliOptions = {
  json: boolean;
  purgeData: boolean;
};

export type GrantCliOptions = {
  json: boolean;
  documentGrantMap: AppDocumentGrantMap;
};

export type RevokeCliOptions = {
  json: boolean;
  documentScopeIds: string[];
};

export type PublishCliOptions = {
  json: boolean;
  metadataPath?: string;
  apiBaseUrl?: string;
  token?: string;
};

export class AppRuntimeOptionsService {
  readTarget = (
    command: string,
    rawArgs: string[],
  ): {
    target: string;
    optionArgs: string[];
  } => {
    const [target, ...optionArgs] = rawArgs;
    if (!target || target.startsWith("--")) {
      throw new Error(`${command} 缺少目标参数。`);
    }
    return {
      target,
      optionArgs,
    };
  };

  readCreateOptions = (rawArgs: string[]): CreateCliOptions => {
    const options: CreateCliOptions = {
      json: false,
    };

    for (const current of rawArgs) {
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      switch (current) {
        case "--json":
          options.json = true;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }

    return options;
  };

  readPackOptions = (rawArgs: string[]): PackCliOptions => {
    const options: PackCliOptions = {
      json: false,
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--out":
          options.outputPath = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  readJsonOnlyOptions = (rawArgs: string[]): JsonOnlyCliOptions => {
    const options: JsonOnlyCliOptions = {
      json: false,
    };
    for (const current of rawArgs) {
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      switch (current) {
        case "--json":
          options.json = true;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  readInstallOptions = (rawArgs: string[]): InstallCliOptions => {
    const options: InstallCliOptions = {
      json: false,
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--registry":
          options.registryUrl = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  readUpdateOptions = (rawArgs: string[]): UpdateCliOptions => {
    const options: UpdateCliOptions = {
      json: false,
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--registry":
          options.registryUrl = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        case "--version":
          options.version = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  readUninstallOptions = (rawArgs: string[]): UninstallCliOptions => {
    const options: UninstallCliOptions = {
      json: false,
      purgeData: false,
    };
    for (const current of rawArgs) {
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--purge-data":
          options.purgeData = true;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  readRuntimeOptions = (rawArgs: string[]): RuntimeCliOptions => {
    const options: RuntimeCliOptions = {
      host: "127.0.0.1",
      port: 3100,
      json: false,
      documentGrantMap: {},
    };

    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--host":
          options.host = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        case "--port":
          options.port = Number.parseInt(this.requireOptionValue(current, nextValue), 10);
          if (Number.isNaN(options.port) || options.port < 0) {
            throw new Error("--port 必须是非负整数。");
          }
          index += 1;
          break;
        case "--json":
          options.json = true;
          break;
        case "--document":
          this.assignDocumentGrant(
            options.documentGrantMap,
            this.requireOptionValue(current, nextValue),
          );
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }

    return options;
  };

  readGrantOptions = (rawArgs: string[]): GrantCliOptions => {
    const options: GrantCliOptions = {
      json: false,
      documentGrantMap: {},
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--document":
          this.assignDocumentGrant(
            options.documentGrantMap,
            this.requireOptionValue(current, nextValue),
          );
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    if (Object.keys(options.documentGrantMap).length === 0) {
      throw new Error("grant 至少需要一个 --document scope=/path。");
    }
    return options;
  };

  readRevokeOptions = (rawArgs: string[]): RevokeCliOptions => {
    const options: RevokeCliOptions = {
      json: false,
      documentScopeIds: [],
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--document":
          options.documentScopeIds.push(
            this.readDocumentScopeId(this.requireOptionValue(current, nextValue)),
          );
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    if (options.documentScopeIds.length === 0) {
      throw new Error("revoke 至少需要一个 --document scope。");
    }
    return options;
  };

  readPublishOptions = (rawArgs: string[]): PublishCliOptions => {
    const options: PublishCliOptions = {
      json: false,
    };
    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        throw new Error(`未知参数：${current}`);
      }
      const nextValue = rawArgs[index + 1];
      switch (current) {
        case "--json":
          options.json = true;
          break;
        case "--meta":
          options.metadataPath = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        case "--api-base":
          options.apiBaseUrl = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        case "--token":
          options.token = this.requireOptionValue(current, nextValue);
          index += 1;
          break;
        default:
          throw new Error(`未知参数：${current}`);
      }
    }
    return options;
  };

  private assignDocumentGrant = (
    documentGrantMap: AppDocumentGrantMap,
    rawGrant: string,
  ): void => {
    const delimiterIndex = rawGrant.indexOf("=");
    if (delimiterIndex < 1) {
      throw new Error("--document 必须使用 scopeId=/absolute/or/relative/path 格式。");
    }
    const scopeId = rawGrant.slice(0, delimiterIndex).trim();
    const directoryPath = rawGrant.slice(delimiterIndex + 1).trim();
    if (!scopeId || !directoryPath) {
      throw new Error("--document 缺少 scopeId 或 path。");
    }
    documentGrantMap[scopeId] = directoryPath;
  };

  private readDocumentScopeId = (scopeId: string): string => {
    const normalized = scopeId.trim();
    if (!normalized || normalized.includes("=")) {
      throw new Error("--document 必须使用 scopeId 格式。");
    }
    return normalized;
  };

  private requireOptionValue = (flag: string, nextValue: string | undefined): string => {
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`${flag} 缺少值。`);
    }
    return nextValue;
  };
}

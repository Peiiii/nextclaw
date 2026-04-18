#!/usr/bin/env node

import { DevCommand } from "./commands/dev.controller.js";
import { InspectCommand } from "./commands/inspect.controller.js";
import { RunCommand } from "./commands/run.controller.js";
import type { AppDocumentGrantMap } from "./permissions/app-permissions.types.js";

type CliOptions = {
  host: string;
  port: number;
  json: boolean;
  documentGrantMap: AppDocumentGrantMap;
};

class AppRuntimeCli {
  run = async (): Promise<void> => {
    const [command, appDirectory, ...restArgs] = process.argv.slice(2);
    if (!command || !appDirectory) {
      this.writeUsage();
      process.exit(1);
    }

    const options = this.readOptions(restArgs);
    if (command === "inspect") {
      await new InspectCommand().run({
        appDirectory,
        json: options.json,
        write: this.write,
      });
      return;
    }
    if (command === "run") {
      await new RunCommand().run({
        appDirectory,
        host: options.host,
        port: options.port,
        json: options.json,
        documentGrantMap: options.documentGrantMap,
        write: this.write,
      });
      return;
    }
    if (command === "dev") {
      await new DevCommand().run({
        appDirectory,
        host: options.host,
        port: options.port,
        json: options.json,
        documentGrantMap: options.documentGrantMap,
        write: this.write,
      });
      return;
    }

    this.writeUsage();
    process.exit(1);
  };

  private readOptions = (rawArgs: string[]): CliOptions => {
    const options: CliOptions = {
      host: "127.0.0.1",
      port: 3100,
      json: false,
      documentGrantMap: {},
    };

    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (!current?.startsWith("--")) {
        continue;
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
          this.assignDocumentGrant(options.documentGrantMap, this.requireOptionValue(current, nextValue));
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

  private requireOptionValue = (flag: string, nextValue: string | undefined): string => {
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`${flag} 缺少值。`);
    }
    return nextValue;
  };

  private writeUsage = (): void => {
    this.write("Usage: napp <inspect|run|dev> <app-dir> [--host 127.0.0.1] [--port 3100] [--json] [--document scope=/path]\n");
  };

  private write = (text: string): void => {
    process.stdout.write(text);
  };
}

void new AppRuntimeCli().run();

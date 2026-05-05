import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type WindowBounds = {
  x?: number;
  y?: number;
};

export class CompanionWindowPositionStore {
  constructor(private readonly filePath: string) {}

  readonly read = (): WindowBounds | null => {
    if (!existsSync(this.filePath)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(this.filePath, "utf-8")) as WindowBounds;
    } catch {
      return null;
    }
  };

  readonly write = (bounds: WindowBounds): void => {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(bounds, null, 2));
  };

  static readonly fromUserData = (userDataPath: string): CompanionWindowPositionStore => {
    return new CompanionWindowPositionStore(resolve(userDataPath, "companion-window.json"));
  };
}

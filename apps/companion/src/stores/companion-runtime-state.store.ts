import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type CompanionRuntimeState = {
  pid: number;
  startedAt: string;
  baseUrl: string;
};

export class CompanionRuntimeStateStore {
  constructor(private readonly filePath: string) {}

  readonly write = (state: CompanionRuntimeState): void => {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  };

  readonly clear = (): void => {
    if (existsSync(this.filePath)) {
      rmSync(this.filePath, { force: true });
    }
  };
}

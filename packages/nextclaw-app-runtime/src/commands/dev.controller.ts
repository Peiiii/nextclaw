import { RunCommand, type RunCommandInput } from "./run.controller.js";

export class DevCommand {
  constructor(private readonly runCommand: RunCommand = new RunCommand()) {}

  run = async (params: RunCommandInput): Promise<void> => {
    await this.runCommand.run(params);
  };
}

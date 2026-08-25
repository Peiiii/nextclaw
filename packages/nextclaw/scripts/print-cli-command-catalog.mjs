import { NextclawDistributionService } from "@nextclaw/service";
import { createNextclawDistribution } from "../src/cli/shared/lib/distribution/index.ts";

NextclawDistributionService.configureRuntime(
  createNextclawDistribution(
    new URL("../src/cli/app/index.ts", import.meta.url).href,
  ),
);

const { nextclawCliProgram } =
  await import("../src/cli/app/nextclaw-cli-app.ts");

function collectLeafCommandPaths(command, prefix = []) {
  return command.commands.flatMap((child) => {
    const path = [...prefix, child.name()];
    return child.commands.length > 0
      ? collectLeafCommandPaths(child, path)
      : [`nextclaw ${path.join(" ")}`];
  });
}

console.log(JSON.stringify(collectLeafCommandPaths(nextclawCliProgram).sort()));

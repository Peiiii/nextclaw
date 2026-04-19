import type { SelfUpdateResult } from "../services/self-update.service.js";

type SelfUpdateReportParams = {
  appName: string;
  currentVersion: string;
  result: SelfUpdateResult;
  readInstalledVersion: () => string;
};

export function reportSelfUpdateResult(params: SelfUpdateReportParams): {
  ok: boolean;
  shouldSuggestRestart: boolean;
} {
  const { appName, currentVersion, result, readInstalledVersion } = params;

  const printSteps = () => {
    for (const step of result.steps) {
      console.log(`- ${step.cmd} ${step.args.join(" ")} (code ${step.code ?? "?"})`);
      if (step.stderr) {
        console.log(`  stderr: ${step.stderr}`);
      }
      if (step.stdout) {
        console.log(`  stdout: ${step.stdout}`);
      }
    }
  };

  if (!result.ok) {
    console.error(`Update failed: ${result.error ?? "unknown error"}`);
    if (result.steps.length > 0) {
      printSteps();
    }
    return { ok: false, shouldSuggestRestart: false };
  }

  if (result.strategy === "noop") {
    console.log(`✓ ${appName} is already up to date (${result.latestVersion ?? currentVersion})`);
    return { ok: true, shouldSuggestRestart: false };
  }

  const versionAfter = result.latestVersion ?? readInstalledVersion();
  console.log(`✓ Update complete (${result.strategy})`);
  if (versionAfter === currentVersion) {
    console.log(`Version unchanged: ${currentVersion}`);
  } else {
    console.log(`Version updated: ${currentVersion} -> ${versionAfter}`);
  }
  return { ok: true, shouldSuggestRestart: true };
}

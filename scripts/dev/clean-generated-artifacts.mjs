import { execFileSync } from "node:child_process";

const GENERATED_PATHS = ["packages/nextclaw/ui-dist"];
const isCheckMode = process.argv.includes("--check");

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  });
}

function readStatus() {
  return runGit(["status", "--short", "--", ...GENERATED_PATHS]).trim();
}

const beforeStatus = readStatus();

if (!beforeStatus) {
  console.log("[clean:generated] generated artifacts are clean.");
  process.exit(0);
}

console.log("[clean:generated] generated artifact drift:");
console.log(beforeStatus);

if (isCheckMode) {
  console.error("[clean:generated] generated artifacts are dirty.");
  process.exit(1);
}

runGit(["restore", "--", ...GENERATED_PATHS], { stdio: "inherit" });
runGit(["clean", "-fd", "--", ...GENERATED_PATHS], { stdio: "inherit" });

const afterStatus = readStatus();
if (afterStatus) {
  console.error("[clean:generated] generated artifacts are still dirty:");
  console.error(afterStatus);
  process.exit(1);
}

console.log("[clean:generated] generated artifacts restored to git state.");

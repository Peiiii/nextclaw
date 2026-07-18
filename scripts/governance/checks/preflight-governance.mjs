#!/usr/bin/env node

import {
  printViolations as printFileRoleViolations,
  runPlannedFileRoleBoundaryCheck
} from "./structure/lint-new-code-file-role-boundaries.mjs";
import {
  printViolations as printModuleStructureViolations,
  runPlannedModuleStructureCheck
} from "../module-structure/lint-new-code-module-structure.mjs";

const plannedPaths = process.argv.slice(2).filter((arg) => arg !== "--");
if (plannedPaths.length === 0) {
  throw new Error("preflight:governance requires at least one repository-relative path.");
}

console.log("[preflight] file roles");
const fileRoleExitCode = printFileRoleViolations(runPlannedFileRoleBoundaryCheck(plannedPaths));

console.log("\n[preflight] module structure");
const moduleStructureExitCode = printModuleStructureViolations(runPlannedModuleStructureCheck(plannedPaths));

process.exit(fileRoleExitCode || moduleStructureExitCode ? 1 : 0);

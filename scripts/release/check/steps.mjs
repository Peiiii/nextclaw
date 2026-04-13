const TYPECHECK_TOKEN_PATTERN = /(^|[;&|()]\s*|\s+)(tsc|vue-tsc)\b/;

export function normalizeTypecheckCommand(command) {
  const trimmed = command.trim();
  if (!trimmed.startsWith("tsc") || trimmed.includes("--noEmit")) {
    return command;
  }
  return `${command} --noEmit`;
}

export function buildCommandProvidesTypecheck(command) {
  if (!command) {
    return false;
  }
  return TYPECHECK_TOKEN_PATTERN.test(command);
}

export function resolveReleaseCheckStepSpecs(entry, options = {}) {
  const includeLint = options.includeLint === true;
  const buildCommand = entry.pkg.scripts?.build;
  const tscCommand = entry.pkg.scripts?.tsc;
  const lintCommand = entry.pkg.scripts?.lint;
  const buildProvidesTypecheck = buildCommandProvidesTypecheck(buildCommand);
  const stepSpecs = [];

  if (buildCommand) {
    stepSpecs.push({
      stepName: "build",
      requiresDependencyGate: true,
      command: buildCommand
    });
  }

  if (tscCommand && !buildProvidesTypecheck) {
    stepSpecs.push({
      stepName: "tsc",
      requiresDependencyGate: true,
      command: normalizeTypecheckCommand(tscCommand)
    });
  }

  if (includeLint && lintCommand) {
    stepSpecs.push({
      stepName: "lint",
      requiresDependencyGate: false,
      command: lintCommand
    });
  }

  return stepSpecs;
}

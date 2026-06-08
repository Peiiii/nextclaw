import assert from "node:assert/strict";
import test from "node:test";

import { collectViolationsForTouchedFunctionParamMutations } from "./lint-new-code-param-mutations.mjs";

test("flags property assignment and delete on a touched ordinary function parameter", () => {
  const source = `
export function applyProfile(profile: AgentProfile, avatar?: string) {
  if (!avatar) {
    delete profile.avatar;
    return;
  }
  profile.avatar = avatar;
}
`.trim();

  const violations = collectViolationsForTouchedFunctionParamMutations({
    filePath: "packages/demo/src/profile-utils.ts",
    source,
    addedLines: new Set([2])
  });

  assert.deepEqual(
    violations.map((item) => `${item.functionLabel}:${item.parameterName}:${item.mutationKind}`),
    ["applyProfile:profile:delete", "applyProfile:profile:assignment"]
  );
});

test("does not report untouched functions in the same file", () => {
  const source = `
export function untouchedProfile(profile: AgentProfile) {
  profile.avatar = "old";
}

export function touchedProfile(profile: AgentProfile) {
  profile.avatar = "new";
}
`.trim();

  const violations = collectViolationsForTouchedFunctionParamMutations({
    filePath: "packages/demo/src/profile-utils.ts",
    source,
    addedLines: new Set([5])
  });

  assert.deepEqual(
    violations.map((item) => `${item.functionLabel}:${item.parameterName}:${item.mutationKind}`),
    ["touchedProfile:profile:assignment"]
  );
});

test("ignores class-owned methods even when they mutate parameters", () => {
  const source = `
class ProfileEditor {
  apply(profile: AgentProfile) {
    profile.avatar = "ok";
  }

  patch = (profile: AgentProfile) => {
    delete profile.avatar;
  };
}
`.trim();

  const violations = collectViolationsForTouchedFunctionParamMutations({
    filePath: "packages/demo/src/profile-editor.ts",
    source,
    addedLines: new Set([2])
  });

  assert.equal(violations.length, 0);
});

test("flags high-confidence mutator calls on touched function parameters", () => {
  const source = `
export const updateProviders = (providers: Map<string, string>, names: string[]) => {
  providers.set("primary", "demo");
  names.push("demo");
  Object.assign(providers, { cached: true });
};
`.trim();

  const violations = collectViolationsForTouchedFunctionParamMutations({
    filePath: "packages/demo/src/provider-utils.ts",
    source,
    addedLines: new Set([1])
  });

  assert.deepEqual(
    violations.map((item) => `${item.functionLabel}:${item.parameterName}:${item.mutationKind}`),
    [
      "updateProviders:providers:call:set",
      "updateProviders:names:call:push",
      "updateProviders:providers:call:Object.assign"
    ]
  );
});

test("ignores non-AST-governed source files", () => {
  const source = `
def apply_profile(profile):
    profile["avatar"] = "ok"
`.trim();

  const violations = collectViolationsForTouchedFunctionParamMutations({
    filePath: "packages/demo/src/sitecustomize.py",
    source,
    addedLines: new Set([1])
  });

  assert.equal(violations.length, 0);
});

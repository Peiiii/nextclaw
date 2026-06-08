import assert from "node:assert/strict";
import test from "node:test";

import { collectViolationsForTouchedReactEffects } from "./lint-new-code-react-effects.mjs";

test("flags direct local-state and store-action calls inside a touched effect", () => {
  const source = `
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";

export function Demo({ mode }) {
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    setError(null);
    setPassword("");
    logout();
  }, [mode, logout]);

  return error ?? password;
}
`.trim();

  const violations = collectViolationsForTouchedReactEffects({
    filePath: "apps/demo/src/Demo.tsx",
    source,
    addedLines: new Set([9])
  });

  assert.deepEqual(
    violations.map((item) => `${item.effectHookLabel}:${item.callLabel}:${item.reason}`),
    [
      "useEffect:setError:local state repair",
      "useEffect:setPassword:local state repair",
      "useEffect:logout:store action dispatch"
    ]
  );
});

test("flags direct query and mutation actions inside a touched effect", () => {
  const source = `
import { useEffect } from "react";

export function Demo({ userId }) {
  const saveMutation = useMutation({});
  const shareQuery = useQuery({});
  const queryClient = useQueryClient();

  useEffect(() => {
    saveMutation.mutate({ userId });
    void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    void shareQuery.refetch();
  }, [queryClient, saveMutation, shareQuery, userId]);

  return null;
}
`.trim();

  const violations = collectViolationsForTouchedReactEffects({
    filePath: "apps/demo/src/Demo.tsx",
    source,
    addedLines: new Set([8])
  });

  assert.deepEqual(
    violations.map((item) => `${item.callLabel}:${item.reason}`),
    [
      "saveMutation.mutate:mutation trigger",
      "queryClient.invalidateQueries:query invalidation",
      "shareQuery.refetch:query refetch"
    ]
  );
});

test("ignores boundary-sync effects and nested subscription callbacks", () => {
  const source = `
import React, { useEffect, useState } from "react";

export function Demo({ locale }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    document.documentElement.lang = locale;
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [locale]);

  return width;
}
`.trim();

  const violations = collectViolationsForTouchedReactEffects({
    filePath: "apps/demo/src/Demo.tsx",
    source,
    addedLines: new Set([6])
  });

  assert.equal(violations.length, 0);
});

test("does not report untouched effects in the same file", () => {
  const source = `
import { useEffect, useState } from "react";

export function Demo({ mode }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError("old");
  }, []);

  useEffect(() => {
    setError(mode);
  }, [mode]);

  return error;
}
`.trim();

  const violations = collectViolationsForTouchedReactEffects({
    filePath: "apps/demo/src/Demo.tsx",
    source,
    addedLines: new Set([10])
  });

  assert.deepEqual(
    violations.map((item) => item.callLabel),
    ["setError"]
  );
});

test("skips non-js-ts source files instead of trying to parse them", () => {
  const violations = collectViolationsForTouchedReactEffects({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    source: "def hello():\n    return 'world'\n",
    addedLines: new Set([1])
  });

  assert.deepEqual(violations, []);
});

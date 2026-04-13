import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";

import preferTopLevelContextDestructuringRule from "./prefer-top-level-context-destructuring-rule.mjs";

const lintText = async (code) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts"],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
          }
        },
        plugins: {
          nextclaw: {
            rules: {
              "prefer-top-level-context-destructuring": preferTopLevelContextDestructuringRule
            }
          }
        },
        rules: {
          "nextclaw/prefer-top-level-context-destructuring": [
            "warn",
            {
              objectNames: ["params", "options", "context"],
              minAccesses: 4
            }
          ]
        }
      }
    ]
  });

  const [result] = await eslint.lintText(code, {
    filePath: "packages/demo/helper.ts"
  });
  return result.messages;
};

test("reports repeated params member reads", async () => {
  const messages = await lintText(`
    export function buildThing(params: { a: string; b: string; c: string; d: string }) {
      return params.a + params.b + params.c + params.d;
    }
  `);

  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /Destructure top-level fields from 'params'/);
});

test("allows top-level destructuring before use", async () => {
  const messages = await lintText(`
    export function buildThing(params: { a: string; b: string; c: string; d: string }) {
      const { a, b, c, d } = params;
      return a + b + c + d;
    }
  `);

  assert.equal(messages.length, 0);
});

test("does not flag access counts below the threshold", async () => {
  const messages = await lintText(`
    export function buildThing(params: { a: string; b: string; c: string }) {
      return params.a + params.b + params.c;
    }
  `);

  assert.equal(messages.length, 0);
});

test("supports options and context style parameter names", async () => {
  const messages = await lintText(`
    export const buildThing = (options: { a: string; b: string; c: string; d: string }) => {
      return options.a + options.b + options.c + options.d;
    };
  `);

  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /'options'/);
});

test("ignores other parameter names", async () => {
  const messages = await lintText(`
    export function buildThing(input: { a: string; b: string; c: string; d: string }) {
      return input.a + input.b + input.c + input.d;
    }
  `);

  assert.equal(messages.length, 0);
});

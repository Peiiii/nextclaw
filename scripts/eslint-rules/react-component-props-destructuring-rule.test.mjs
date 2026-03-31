import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";

import reactComponentPropsDestructuringRule from "./react-component-props-destructuring-rule.mjs";

const lintText = async (code) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: {
              jsx: true
            }
          }
        },
        plugins: {
          nextclaw: {
            rules: {
              "react-component-props-destructuring": reactComponentPropsDestructuringRule
            }
          }
        },
        rules: {
          "nextclaw/react-component-props-destructuring": "warn"
        }
      }
    ]
  });

  const [result] = await eslint.lintText(code, {
    filePath: "packages/demo/component.tsx"
  });
  return result.messages;
};

test("reports JSX components that keep reading props.foo", async () => {
  const messages = await lintText(`
    type DemoProps = { label: string };
    export function Demo(props: DemoProps) {
      return <div>{props.label}</div>;
    }
  `);

  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /Destructure component props/);
});

test("allows destructured component props", async () => {
  const messages = await lintText(`
    type DemoProps = { label: string };
    export function Demo({ label }: DemoProps) {
      return <div>{label}</div>;
    }
  `);

  assert.equal(messages.length, 0);
});

test("does not flag non-component helpers", async () => {
  const messages = await lintText(`
    type DemoProps = { label: string };
    export function readLabel(props: DemoProps) {
      return props.label.trim();
    }
  `);

  assert.equal(messages.length, 0);
});

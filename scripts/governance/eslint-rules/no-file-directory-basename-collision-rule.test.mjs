import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";

import noFileDirectoryBasenameCollisionRule from "./no-file-directory-basename-collision-rule.mjs";

const createFixture = (t, { relativeFilePath, createSiblingDirectory = true }) => {
  const tempRoot = fs.mkdtempSync(
    path.join(process.cwd(), ".tmp-no-file-directory-basename-collision-rule-")
  );
  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const filePath = path.join(tempRoot, relativeFilePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (createSiblingDirectory) {
    fs.mkdirSync(path.join(path.dirname(filePath), path.basename(relativeFilePath, path.extname(relativeFilePath))), {
      recursive: true
    });
  }

  return {
    tempRoot,
    filePath
  };
};

const lintText = async (filePath, allowFilePaths = []) => {
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
              "no-file-directory-basename-collision": noFileDirectoryBasenameCollisionRule
            }
          }
        },
        rules: {
          "nextclaw/no-file-directory-basename-collision": [
            "error",
            {
              allowFilePaths
            }
          ]
        }
      }
    ]
  });

  const [result] = await eslint.lintText("export const demo = 1;\n", {
    filePath
  });
  return result.messages;
};

test("reports a sibling directory that reuses the file basename", async (t) => {
  const { filePath } = createFixture(t, {
    relativeFilePath: "packages/demo/chat.ts"
  });

  const messages = await lintText(filePath);

  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /conflicts with directory/);
});

test("allows files without a sibling directory collision", async (t) => {
  const { filePath } = createFixture(t, {
    relativeFilePath: "packages/demo/chat.ts",
    createSiblingDirectory: false
  });

  const messages = await lintText(filePath);

  assert.equal(messages.length, 0);
});

test("allows explicitly grandfathered historical collisions", async (t) => {
  const { tempRoot, filePath } = createFixture(t, {
    relativeFilePath: "packages/demo/chat.ts"
  });

  const messages = await lintText(filePath, [
    path.relative(process.cwd(), filePath),
    path.relative(tempRoot, filePath)
  ]);

  assert.equal(messages.length, 0);
});

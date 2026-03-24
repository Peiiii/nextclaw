import baseConfig from "../../../eslint.config.mjs";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

const tsEslintRecommendedOverrideRules =
  tsEslintPlugin.configs["eslint-recommended"].overrides?.[0]?.rules ?? {};

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsEslintPlugin
    },
    rules: {
      ...tsEslintRecommendedOverrideRules,
      ...tsEslintPlugin.configs.recommended.rules,
      ...prettier.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "max-lines": ["warn", { max: 800, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }
      ]
    }
  }
];

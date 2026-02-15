module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
    "max-lines": ["warn", { "max": 800, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["warn", { "max": 150, "skipBlankLines": true, "skipComments": true, "IIFEs": true }]
  }
};

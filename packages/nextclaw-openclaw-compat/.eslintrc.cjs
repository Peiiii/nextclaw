module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  env: {
    node: true,
    es2022: true
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],
    "max-lines": ["warn", { "max": 800, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["warn", { "max": 150, "skipBlankLines": true, "skipComments": true }]
  },
  ignorePatterns: ["dist", "node_modules"]
};
